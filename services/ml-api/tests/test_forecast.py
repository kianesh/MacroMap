"""Tests for the forecasting model, anomaly detector, and health endpoint.

Run from the service root:  cd services/ml-api && pytest
These tests use synthetic data and never touch Firestore, so they require no
credentials.
"""
import json

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.auth import require_token
from app.main import app
from app.models.anomalies import detect_anomalies
from app.models.forecast import ForecastResult, fit_and_forecast


def _synthetic_series(n: int = 90, seed: int = 7) -> pd.Series:
    """Daily series with an upward trend + weekly seasonality + noise."""
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    trend = np.linspace(2000.0, 2200.0, n)
    weekly = 150.0 * np.sin(2 * np.pi * idx.dayofweek.to_numpy() / 7.0)
    noise = rng.normal(0.0, 40.0, n)
    return pd.Series(trend + weekly + noise, index=idx)


def test_forecast_produces_valid_output():
    series = _synthetic_series()
    result = fit_and_forecast(series, horizon=7)

    assert isinstance(result, ForecastResult)
    assert len(result.predicted) == 7
    assert len(result.lower) == 7
    assert len(result.upper) == 7
    assert all(np.isfinite(result.predicted))
    # Confidence interval must bracket the point prediction.
    for lo, pred, hi in zip(result.lower, result.predicted, result.upper):
        assert lo <= pred <= hi
    assert result.model in ("SARIMAX", "Holt-Winters")


def test_short_series_falls_back_to_holt_winters():
    # Fewer than two seasonal cycles -> SARIMAX is skipped.
    series = _synthetic_series(n=10)
    result = fit_and_forecast(series, horizon=7)
    assert result.model == "Holt-Winters"
    assert len(result.predicted) == 7


def test_anomaly_detector_flags_injected_outliers():
    series = _synthetic_series()
    spike_idx, drop_idx = 40, 70
    series.iloc[spike_idx] += 1000.0
    series.iloc[drop_idx] -= 900.0

    anomalies = detect_anomalies(series, window=30, threshold=2.0)
    flagged = {a.date for a in anomalies}

    assert series.index[spike_idx].date().isoformat() in flagged
    assert series.index[drop_idx].date().isoformat() in flagged


def test_anomaly_detector_quiet_on_clean_series():
    # A smooth series with no injected outliers should flag nothing.
    idx = pd.date_range("2024-01-01", periods=60, freq="D")
    series = pd.Series(np.linspace(100.0, 110.0, 60), index=idx)
    assert detect_anomalies(series, window=30, threshold=2.0) == []


def test_forecast_response_clips_negative_lower_bounds(monkeypatch):
    """A low-mean, high-variance series yields negative CI bounds from the
    model; the endpoint must clip value/lower to >= 0 in the response."""
    rng = np.random.default_rng(123)
    idx = pd.date_range("2024-01-01", periods=40, freq="D")
    # Low mean (~50) with very high variance (sigma 400) drives the lower CI
    # bound — and likely some point predictions — well below zero pre-clip.
    series = pd.Series(rng.normal(50.0, 400.0, len(idx)), index=idx)

    # Sanity check: the raw model genuinely produces negative lower bounds,
    # so this test is actually exercising the clipping path.
    raw = fit_and_forecast(series, horizon=7)
    assert min(raw.lower) < 0

    from app.routes import forecast as forecast_route

    monkeypatch.setattr(
        forecast_route, "get_daily_nutrition", lambda uid, metric: series
    )
    monkeypatch.setattr(forecast_route, "get_user_goals", lambda uid: {})
    app.dependency_overrides[require_token] = lambda: None
    try:
        client = TestClient(app)
        response = client.post(
            "/forecast-nutrition",
            json={"user_id": "demo-user-123", "metric": "calories"},
            headers={"Authorization": "Bearer test"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert len(body["forecast"]) == 7
        for point in body["forecast"]:
            assert point["lower"] >= 0
            assert point["value"] >= 0
    finally:
        app.dependency_overrides.clear()


# Minimal valid-shaped (but fake) service-account JSON. Passes the resolver's
# JSON-parsing/shape expectations; the dummy private_key obviously won't auth,
# but the resolver under test never constructs a real credential.
_FAKE_SERVICE_ACCOUNT = {
    "type": "service_account",
    "project_id": "macro-map-afa5e",
    "private_key_id": "fakekeyid0000000000000000000000000000000",
    "private_key": (
        "-----BEGIN PRIVATE KEY-----\nFAKEKEYCONTENT\n"
        "-----END PRIVATE KEY-----\n"
    ),
    "client_email": "demo-sa@macro-map-afa5e.iam.gserviceaccount.com",
    "client_id": "123456789012345678901",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
}


def _settings_from_env_only(monkeypatch):
    """Route the resolver at a Settings instance that ignores the local .env
    file, so these tests depend only on monkeypatched environment variables."""
    from app import firestore_client
    from app.config import Settings

    monkeypatch.setattr(
        firestore_client, "get_settings", lambda: Settings(_env_file=None)
    )
    return firestore_client


def test_credential_loader_prefers_json_env_over_path(monkeypatch):
    # Both env vars set: the JSON string must win over the file path.
    monkeypatch.setenv(
        "FIREBASE_SERVICE_ACCOUNT_JSON", json.dumps(_FAKE_SERVICE_ACCOUNT)
    )
    monkeypatch.setenv(
        "FIREBASE_SERVICE_ACCOUNT_JSON_PATH", "/should/not/be/used.json"
    )
    firestore_client = _settings_from_env_only(monkeypatch)

    resolved = firestore_client._resolve_service_account_info()

    # Picked the parsed JSON dict (not the path string) and parsed it correctly.
    assert isinstance(resolved, dict)
    assert resolved == _FAKE_SERVICE_ACCOUNT
    assert resolved["client_email"] == _FAKE_SERVICE_ACCOUNT["client_email"]


def test_credential_loader_raises_when_both_unset(monkeypatch):
    monkeypatch.delenv("FIREBASE_SERVICE_ACCOUNT_JSON", raising=False)
    monkeypatch.delenv("FIREBASE_SERVICE_ACCOUNT_JSON_PATH", raising=False)
    firestore_client = _settings_from_env_only(monkeypatch)

    with pytest.raises(RuntimeError) as excinfo:
        firestore_client._resolve_service_account_info()

    message = str(excinfo.value)
    assert "FIREBASE_SERVICE_ACCOUNT_JSON" in message
    assert "FIREBASE_SERVICE_ACCOUNT_JSON_PATH" in message


def test_health_endpoint_returns_200():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
