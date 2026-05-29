"""Seed a demo user's `meals` collection with realistic, seasonal data.

This produces a clean dataset for demoing the forecast endpoint: ~60 days of
3 meals/day with a clear weekday/weekend (weekly) calorie pattern that SARIMAX
fits well, instead of the sparse real test account.

Schema is taken directly from app/firestore_client.py::get_daily_nutrition,
which the forecast endpoint reads. It must match exactly or the endpoint won't
find the seeded data:
    collection : "meals"
    user field : "userId"
    metrics    : "calories", "protein", "carbs", "fats"
    timestamp  : "timestamp"  (a Firestore Timestamp -> Python datetime)

Usage:
    python scripts/seed_demo_user.py <uid> [days] [--force]

  <uid>     Firebase Auth UID of the demo user (required).
  [days]    Number of days to seed, ending today. Default 60.
  --force   If the user already has meals, delete them first, then reseed.

Credentials: uses the SAME service-account key as the FastAPI app, resolved
from FIREBASE_SERVICE_ACCOUNT_JSON_PATH in services/ml-api/.env
(default: ./serviceAccount.json).

This script ONLY writes/deletes documents whose userId == <uid>.
"""
from __future__ import annotations

import os
import random
import sys
from datetime import datetime, time, timedelta
from pathlib import Path

from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

# --- Paths / config -------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
SERVICE_ROOT = SCRIPT_DIR.parent  # services/ml-api/

# Schema constants — keep in sync with app/firestore_client.py.
COLLECTION = "meals"
USER_FIELD = "userId"
TIMESTAMP_FIELD = "timestamp"

# Generation parameters.
SEED = 42
DEFAULT_DAYS = 60
WEEKDAY_BASE = 2200.0
WEEKEND_BASE = 2600.0  # ~20% weekend lift -> weekly seasonal signal
DAILY_NOISE_SIGMA = 180.0
DAILY_FLOOR = 1200.0
MEAL_NOISE_SIGMA = 30.0
MEAL_SPLIT = {"breakfast": 0.30, "lunch": 0.40, "dinner": 0.30}
MEAL_HOURS = {"breakfast": 8, "lunch": 13, "dinner": 19}

# Macro energy ratios of total calories; grams via kcal-per-gram.
PROTEIN_RATIO, CARBS_RATIO, FATS_RATIO = 0.25, 0.45, 0.30
KCAL_PER_G = {"protein": 4.0, "carbs": 4.0, "fats": 9.0}

# Firestore write batch limit is 500; commit before reaching it.
BATCH_COMMIT_SIZE = 400


def _fail(message: str) -> "NoReturn":  # type: ignore[name-defined]
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def _parse_args(argv: list[str]) -> tuple[str, int, bool]:
    force = "--force" in argv
    positional = [a for a in argv[1:] if a != "--force"]

    if not positional:
        _fail(
            "missing demo user UID.\n"
            "Usage: python scripts/seed_demo_user.py <uid> [days] [--force]"
        )

    uid = positional[0]
    # Safety: refuse whitespace or suspiciously short UIDs so we never seed
    # against a malformed/blank target.
    if any(ch.isspace() for ch in uid):
        _fail("UID must not contain whitespace.")
    if len(uid) < 10:
        _fail(f"UID '{uid}' is too short (<10 chars); refusing for safety.")

    days = DEFAULT_DAYS
    if len(positional) > 1:
        try:
            days = int(positional[1])
        except ValueError:
            _fail(f"days must be an integer, got '{positional[1]}'.")
        if days <= 0:
            _fail("days must be a positive integer.")

    return uid, days, force


def _resolve_credentials() -> Path:
    """Resolve the service-account key the FastAPI app uses."""
    load_dotenv(SERVICE_ROOT / ".env")
    raw = os.environ.get(
        "FIREBASE_SERVICE_ACCOUNT_JSON_PATH", "serviceAccount.json"
    )
    path = Path(raw)
    if not path.is_absolute():
        path = SERVICE_ROOT / path
    if not path.exists():
        _fail(
            f"service account key not found at {path}. Set "
            "FIREBASE_SERVICE_ACCOUNT_JSON_PATH in services/ml-api/.env."
        )
    return path


def _macros_from_calories(calories: float) -> tuple[float, float, float]:
    protein = (PROTEIN_RATIO * calories) / KCAL_PER_G["protein"]
    carbs = (CARBS_RATIO * calories) / KCAL_PER_G["carbs"]
    fats = (FATS_RATIO * calories) / KCAL_PER_G["fats"]
    return round(protein, 1), round(carbs, 1), round(fats, 1)


def _existing_docs(db, uid: str) -> list:
    query = db.collection(COLLECTION).where(
        filter=FieldFilter(USER_FIELD, "==", uid)
    )
    return list(query.stream())


def _delete_docs(db, docs: list) -> None:
    batch = db.batch()
    pending = 0
    for doc in docs:
        batch.delete(doc.reference)
        pending += 1
        if pending == BATCH_COMMIT_SIZE:
            batch.commit()
            batch = db.batch()
            pending = 0
    if pending:
        batch.commit()


def _build_meal_docs(uid: str, days: int) -> list[dict]:
    """Generate meal documents for the most recent `days` days, ending today."""
    today = datetime.now().date()
    start = today - timedelta(days=days - 1)

    docs: list[dict] = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        is_weekend = day.weekday() >= 5  # Sat=5, Sun=6
        base = WEEKEND_BASE if is_weekend else WEEKDAY_BASE
        daily_total = max(
            DAILY_FLOOR, base + random.gauss(0, DAILY_NOISE_SIGMA)
        )

        for name, fraction in MEAL_SPLIT.items():
            meal_cal = max(
                50.0, daily_total * fraction + random.gauss(0, MEAL_NOISE_SIGMA)
            )
            protein, carbs, fats = _macros_from_calories(meal_cal)
            ts = datetime.combine(
                day,
                time(hour=MEAL_HOURS[name], minute=random.randint(0, 59)),
            )
            docs.append(
                {
                    USER_FIELD: uid,
                    "name": name,
                    "calories": round(meal_cal, 1),
                    "protein": protein,
                    "carbs": carbs,
                    "fats": fats,
                    TIMESTAMP_FIELD: ts,
                }
            )
    return docs


def _write_docs(db, docs: list[dict]) -> None:
    batch = db.batch()
    pending = 0
    for doc in docs:
        ref = db.collection(COLLECTION).document()
        batch.set(ref, doc)
        pending += 1
        if pending == BATCH_COMMIT_SIZE:
            batch.commit()
            batch = db.batch()
            pending = 0
    if pending:
        batch.commit()


def main(argv: list[str]) -> None:
    uid, days, force = _parse_args(argv)
    random.seed(SEED)

    cred_path = _resolve_credentials()
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(cred_path)))
    db = firestore.client()

    # Idempotency: never silently duplicate. Only ever inspect THIS user's docs.
    existing = _existing_docs(db, uid)
    if existing:
        if not force:
            _fail(
                f"user {uid} already has {len(existing)} meal docs. "
                "Re-run with --force to delete and reseed."
            )
        print(f"--force: deleting {len(existing)} existing meal docs for {uid}…")
        _delete_docs(db, existing)

    docs = _build_meal_docs(uid, days)
    _write_docs(db, docs)

    print(f"Seeded {len(docs)} meals across {days} days for user {uid}")


if __name__ == "__main__":
    main(sys.argv)
