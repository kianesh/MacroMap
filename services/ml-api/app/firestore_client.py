"""Read-only Firestore access for the ML service.

This module only ever *reads* from Firestore (``.get()`` / ``.stream()``).
It never writes. To enforce least privilege, deploy this service with a
service account that has read-only access to the relevant collections
(e.g. a custom IAM role limited to ``datastore.entities.get`` /
``datastore.entities.list``), rather than the default editor role.

Collections consumed:
  * ``meals``   { userId, calories, protein, carbs, fats, timestamp }
  * ``weights`` { userId, weight, date }
  * ``users``   { calorieGoal, protein, carbs, fats, ... }
"""
import json
from typing import Optional, Union

import firebase_admin
import pandas as pd
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from .config import get_settings

_app: Optional[firebase_admin.App] = None

NUTRITION_FIELDS = {"calories", "protein", "carbs", "fats"}


def _resolve_service_account_info() -> Union[dict, str]:
    """Resolve the Firebase service-account credentials from the environment.

    Priority order:
      1. ``FIREBASE_SERVICE_ACCOUNT_JSON`` — the full key as a JSON string,
         parsed into a dict. Use this for cloud deploys (e.g. Railway) where
         shipping a credential file is awkward.
      2. ``FIREBASE_SERVICE_ACCOUNT_JSON_PATH`` — a path to the key file. Use
         this for local development.

    Returns the parsed dict (option 1) or the path string (option 2). Raises
    ``RuntimeError`` if neither is configured.
    """
    settings = get_settings()

    json_str = (settings.firebase_service_account_json or "").strip()
    if json_str:
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "FIREBASE_SERVICE_ACCOUNT_JSON is set but does not contain "
                "valid JSON. Its value must be the full contents of your "
                "service-account key as a (single-line) JSON string. "
                f"JSON parse error: {exc}"
            ) from exc

    if settings.firebase_service_account_json_path:
        return settings.firebase_service_account_json_path

    raise RuntimeError(
        "No Firebase credentials configured. Set FIREBASE_SERVICE_ACCOUNT_JSON "
        "to the full service-account JSON string (recommended for cloud "
        "deploys such as Railway), or FIREBASE_SERVICE_ACCOUNT_JSON_PATH to the "
        "path of a service-account JSON file (recommended for local dev)."
    )


def _build_credential() -> credentials.Base:
    """Build a Firebase Admin credential from env-provided service-account info.

    ``credentials.Certificate`` accepts either a file path or a parsed dict.
    Given the dict from FIREBASE_SERVICE_ACCOUNT_JSON it constructs the
    underlying credential via
    ``google.oauth2.service_account.Credentials.from_service_account_info``;
    given a path it reads the file (the original local-dev behaviour).
    """
    return credentials.Certificate(_resolve_service_account_info())


def _ensure_app() -> firebase_admin.App:
    """Initialise the Firebase Admin app exactly once (lazily)."""
    global _app
    if _app is not None:
        return _app
    if firebase_admin._apps:
        _app = firebase_admin.get_app()
        return _app
    _app = firebase_admin.initialize_app(_build_credential())
    return _app


def _client():
    _ensure_app()
    return firestore.client()


def get_daily_nutrition(user_id: str, metric: str) -> pd.Series:
    """Return a daily-summed series for a nutrition metric.

    The result is a float Series indexed by a daily ``DatetimeIndex`` (one
    entry per day on which the user logged at least one meal).
    """
    if metric not in NUTRITION_FIELDS:
        raise ValueError(f"Unsupported nutrition metric: {metric}")

    db = _client()
    query = db.collection("meals").where(
        filter=FieldFilter("userId", "==", user_id)
    )

    rows: list[tuple[pd.Timestamp, float]] = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        ts = data.get("timestamp")
        value = data.get(metric)
        if ts is None or value is None:
            continue
        # Firestore Timestamps deserialize to datetime subclasses.
        day = pd.Timestamp(ts).tz_localize(None).normalize()
        rows.append((day, float(value)))

    if not rows:
        return pd.Series(dtype=float)

    frame = pd.DataFrame(rows, columns=["date", "value"])
    series = frame.groupby("date")["value"].sum().sort_index()
    series.index = pd.DatetimeIndex(series.index)
    # Nutrition metrics cannot be negative; clip defensively against bad data.
    series = series.clip(lower=0.0)
    return series


def get_weight_history(user_id: str) -> pd.Series:
    """Return a daily weight series (mean per day if multiple weigh-ins)."""
    db = _client()
    query = db.collection("weights").where(
        filter=FieldFilter("userId", "==", user_id)
    )

    rows: list[tuple[pd.Timestamp, float]] = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        date = data.get("date")
        weight = data.get("weight")
        if date is None or weight is None:
            continue
        day = pd.Timestamp(date).tz_localize(None).normalize()
        rows.append((day, float(weight)))

    if not rows:
        return pd.Series(dtype=float)

    frame = pd.DataFrame(rows, columns=["date", "value"])
    series = frame.groupby("date")["value"].mean().sort_index()
    series.index = pd.DatetimeIndex(series.index)
    return series


def get_user_goals(user_id: str) -> dict:
    """Return the user's goals document, or an empty dict if absent."""
    db = _client()
    snapshot = db.collection("users").document(user_id).get()
    return snapshot.to_dict() or {}
