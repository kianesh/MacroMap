"""Time-series forecasting.

Primary model: SARIMAX with weekly seasonality. Nutrition and weight series
logged by humans show strong day-of-week structure (e.g. weekend overeating,
weekday routine), so a seasonal model with period 7 captures behaviour that a
plain ARIMA or moving average would miss. The ``(1,1,1)(1,1,1,7)`` order is a
sensible, well-behaved default: first differencing handles drift/trend, and the
seasonal component models the weekly cycle.

Fallback: when SARIMAX fails to converge (common on short, noisy series),
we fall back to Holt-Winters exponential smoothing, which is more robust for
small N. If even that fails we carry the last observation forward.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass
from typing import List

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX

SEASONAL_PERIOD = 7
_Z_95 = 1.959963984540054  # two-sided 95% normal quantile


@dataclass
class ForecastResult:
    """Forecast output: point predictions plus a 95% confidence interval."""

    predicted: List[float]
    lower: List[float]
    upper: List[float]
    model: str  # "SARIMAX" or "Holt-Winters"


def _prepare(series: pd.Series) -> pd.Series:
    """Coerce to a clean, gap-free daily series.

    SARIMAX requires a regular frequency. We collapse duplicate timestamps,
    resample to daily, and fill missing days by time interpolation so the
    seasonal structure stays aligned to real calendar days.
    """
    s = series.astype(float).sort_index()
    s = s[~s.index.duplicated(keep="last")]
    s = s.asfreq("D")
    s = s.interpolate(method="time").ffill().bfill()
    return s


def fit_and_forecast(series: pd.Series, horizon: int = 7) -> ForecastResult:
    """Fit SARIMAX (with Holt-Winters fallback) and forecast ``horizon`` days."""
    s = _prepare(series)

    # SARIMAX with a seasonal term needs at least two full seasonal cycles.
    if len(s) >= 2 * SEASONAL_PERIOD:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = SARIMAX(
                    s,
                    order=(1, 1, 1),
                    seasonal_order=(1, 1, 1, SEASONAL_PERIOD),
                    enforce_stationarity=False,
                    enforce_invertibility=False,
                )
                res = model.fit(disp=False, maxiter=200)
            forecast = res.get_forecast(steps=horizon)
            mean = forecast.predicted_mean
            conf = forecast.conf_int(alpha=0.05)
            if np.all(np.isfinite(mean.to_numpy())):
                return ForecastResult(
                    predicted=[float(x) for x in mean],
                    lower=[float(x) for x in conf.iloc[:, 0]],
                    upper=[float(x) for x in conf.iloc[:, 1]],
                    model="SARIMAX",
                )
        except Exception:  # noqa: BLE001 - any fit failure -> fallback
            pass

    return _holt_winters(s, horizon)


def _holt_winters(s: pd.Series, horizon: int) -> ForecastResult:
    """Robust fallback for short/non-converging series."""
    has_season = len(s) >= 2 * SEASONAL_PERIOD
    try:
        model = ExponentialSmoothing(
            s,
            trend="add",
            seasonal="add" if has_season else None,
            seasonal_periods=SEASONAL_PERIOD if has_season else None,
            initialization_method="estimated",
        )
        res = model.fit()
        mean = np.asarray(res.forecast(horizon), dtype=float)
        resid = np.asarray(res.resid, dtype=float)
        resid_std = float(np.nanstd(resid)) if resid.size else float(s.std())
    except Exception:  # noqa: BLE001 - degrade to last-value carry-forward
        last = float(s.iloc[-1])
        mean = np.full(horizon, last, dtype=float)
        resid_std = float(s.std()) if len(s) > 1 else 0.0

    if not np.isfinite(resid_std):
        resid_std = 0.0

    margin = _Z_95 * resid_std
    return ForecastResult(
        predicted=[float(x) for x in mean],
        lower=[float(x - margin) for x in mean],
        upper=[float(x + margin) for x in mean],
        model="Holt-Winters",
    )
