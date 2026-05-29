# MacroMap ML API

A small FastAPI service that produces **7-day forecasts** and **anomaly
detection** for a MacroMap user's nutrition and weight history. It is deployed
separately from the app's TypeScript Cloud Functions specifically so it can use
the Python scientific stack (`statsmodels`, `scikit-learn`, `pandas`).

---

## Architecture

```
React Native (Expo)
      │  httpsCallable('forecastNutrition')   ← Firebase Auth (user identity)
      ▼
Firebase Cloud Function  (functions/src/ml-proxy.ts)
      │  POST /forecast-nutrition             ← Bearer token (shared secret)
      │  body: { user_id, metric }
      ▼
FastAPI ML service        (this directory, deployed on Railway)
      │  Admin SDK (read-only)
      ▼
Firestore  (meals, weights, users)
```

**Why the proxy?** The client authenticates with Firebase Auth, which the
Cloud Function trusts. The function injects the authenticated `uid` and the
shared bearer token server-side, so the mobile bundle never contains the ML
service secret and a user can only ever request *their own* forecast.

### Request / response

`POST /forecast-nutrition`

```jsonc
// request
{ "user_id": "abc123", "metric": "calories" }  // metric ∈ calories|protein|carbs|fats|weight

// response
{
  "status": "ok",                  // or "insufficient_data"
  "metric": "calories",
  "model": "SARIMAX",              // or "Holt-Winters"
  "historical": [{ "date": "2024-05-01", "value": 2150 }, ...],
  "forecast":   [{ "date": "2024-05-30", "value": 2100, "lower": 1900, "upper": 2300 }, ...],
  "anomalies":  [{ "date": "2024-05-12", "value": 3400, "z_score": 3.1 }],
  "summary":    { "trend": "up", "weekly_avg": 2120.5, "vs_goal": 6.0 }
}
```

If the user has fewer than **14 days** of data, the service returns
`status: "insufficient_data"` with a friendly `message` and empty
`forecast`/`anomalies` instead of fitting a model on too little signal.

---

## Model choices

### Forecasting — SARIMAX with weekly seasonality

`app/models/forecast.py` fits a **SARIMAX** model with
`order=(1,1,1)` and `seasonal_order=(1,1,1,7)`.

- **Why seasonal, period 7?** Human food logs are strongly day-of-week driven
  — weekday routine vs. weekend indulgence, weekly meal-prep cycles. A seasonal
  period of 7 lets the model learn that structure instead of smearing it into
  noise. A plain ARIMA or moving average cannot represent it.
- **Why `(1,1,1)(1,1,1,7)`?** First-order differencing (the middle `1`s) absorbs
  drift and the weekly level shift; one AR and one MA term at both the
  non-seasonal and seasonal level is a robust, low-variance default that rarely
  over-fits short personal series.
- **95% confidence interval** comes directly from the state-space model's
  `get_forecast(...).conf_int(alpha=0.05)`, so the band widens with forecast
  horizon — an honest depiction of growing uncertainty.

**Fallback — Holt-Winters.** SARIMAX can fail to converge on short or very
noisy series. When it raises (or returns non-finite values) we fall back to
Holt-Winters exponential smoothing (`app/models/forecast.py::_holt_winters`),
which is more stable for small *N*. If even that fails, we carry the last
observation forward with a residual-derived band. The chosen model is reported
back in the `model` field.

### Anomaly detection — trailing rolling z-score

`app/models/anomalies.py` flags any day whose value is more than
`threshold = 2.0` standard deviations from a **trailing** 30-day rolling mean.

- **Why a rolling (local) baseline?** A user's "normal" drifts over time
  (bulking, cutting, seasons). A global mean/std would flag an entire cut as
  anomalous; a 30-day rolling window adapts to the current regime.
- **Why trailing, not centred?** A trailing window is causal — it only uses the
  past, mirroring what was knowable in real time, and prevents a spike from
  masking itself by inflating its own window's mean.
- **Why 2.0σ?** Roughly the outer ~5% of a normal distribution — a sensible
  "this day was genuinely unusual" cutoff without drowning the user in flags.

---

## Local development

```bash
cd services/ml-api
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # fill in ML_API_SECRET + service account path
uvicorn app.main:app --reload # http://localhost:8000/health
```

### Tests

```bash
cd services/ml-api
pytest            # synthetic data only — no Firestore credentials needed
```

Covers: SARIMAX produces a valid 7-step forecast on a 90-day synthetic series,
the Holt-Winters fallback triggers on short series, the anomaly detector flags
injected outliers (and stays quiet on clean data), `/health` returns 200, and
the endpoint clips negative `value`/`lower` bounds to 0.

---

## Demo data

Real test accounts are often too sparse for a convincing forecast (a few
scattered meals produce absurdly wide confidence intervals). The seed script
generates a clean, seasonal dataset that SARIMAX fits well.

**1. Create a demo user** in the Firebase console → Authentication → Users →
*Add user* (any email/password). Copy its **UID**.

**2. Run the seed script** from the service root (uses the same
`serviceAccount.json` / `FIREBASE_SERVICE_ACCOUNT_JSON_PATH` as the API):

```bash
cd services/ml-api
python scripts/seed_demo_user.py <DEMO_USER_UID>            # 60 days (default)
python scripts/seed_demo_user.py <DEMO_USER_UID> 90         # custom day count
python scripts/seed_demo_user.py <DEMO_USER_UID> 60 --force # wipe & reseed
```

The script is idempotent: if the user already has meals it refuses to run
unless `--force` is passed (which deletes that user's existing meals first). It
only ever touches documents whose `userId` matches the UID you pass, and rejects
UIDs that contain whitespace or are shorter than 10 characters.

**What gets seeded:** 3 meals/day (breakfast/lunch/dinner at ~08:00/13:00/19:00)
for 60 days ending today. Daily calories average ~2200 on weekdays and ~2600 on
weekends — a deliberate ~20% weekend lift that creates a clear **weekly seasonal
signal** for SARIMAX's `(1,1,1,7)` seasonal term. Protein/carbs/fats are derived
from each meal's calories at a 25/45/30% energy split. `random.seed(42)` makes
the output reproducible. Writes use batched commits (≤400 docs/batch).

---

## Credentials configuration

The service accepts the Firebase service-account credentials in **two ways**,
checked in this priority order:

1. **`FIREBASE_SERVICE_ACCOUNT_JSON`** — the *full contents* of the
   service-account key file as a single-line JSON string. Use this for cloud
   deploys (e.g. Railway) where shipping a file is awkward. When set and
   non-empty it takes priority.
2. **`FIREBASE_SERVICE_ACCOUNT_JSON_PATH`** — a path to the key file on disk.
   Use this for local development (unchanged from before).

If neither is set, the service raises a clear `RuntimeError` at startup naming
both variables. See `.env.example` for both forms.

---

## Deployment (Railway)

1. **Create the service** from this subdirectory. Railway will detect the
   `Dockerfile` (`builder = "dockerfile"` in `railway.toml`).
2. **Environment variables** (Railway → Variables):
   - `ML_API_SECRET` — a long random string (`openssl rand -hex 32`). Must match
     the value set on the Cloud Function.
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — **paste the full contents of your
     `serviceAccount.json` file here** as the variable value (a single JSON
     string). This is the recommended way to supply credentials on Railway; you
     do *not* need to mount a file or set `FIREBASE_SERVICE_ACCOUNT_JSON_PATH`.
     **Use a read-only key** — see Security below.
3. **Healthcheck** is preconfigured at `/health` in `railway.toml`.
4. **Wire up the Cloud Function.** Set these on the Firebase Functions
   environment (`functions/.env`):
   - `ML_API_URL` — the Railway public URL (e.g. `https://macromap-ml.up.railway.app`)
   - `ML_API_SECRET` — same secret as step 2
   Then redeploy functions: `cd functions && npm run deploy`.

---

## Security notes

- **Read-only by design.** This service only calls `.get()` / `.stream()`. It
  never writes to Firestore. Provision its service account with a custom IAM
  role limited to read operations (e.g. `datastore.entities.get` /
  `datastore.entities.list`) rather than the default Editor role, so a
  compromise of the Railway host cannot mutate user data.
- **Secret never reaches the client.** Only the Cloud Function holds
  `ML_API_SECRET`; the React Native bundle authenticates with Firebase Auth.
- **Per-user isolation.** The proxy forwards the *authenticated* `uid`; clients
  cannot request another user's data.
