"""POST /forecast-nutrition route."""
from datetime import timedelta

import pandas as pd
from fastapi import APIRouter, Depends

from ..auth import require_token
from ..firestore_client import (
    get_daily_nutrition,
    get_user_goals,
    get_weight_history,
)
from ..models.anomalies import detect_anomalies
from ..models.forecast import fit_and_forecast
from ..schemas import (
    AnomalyPointOut,
    ForecastPoint,
    ForecastRequest,
    ForecastResponse,
    HistoricalPoint,
    Summary,
)

router = APIRouter()

# Minimum days of history before we attempt to fit a model.
MIN_DAYS = 14
HORIZON = 7

# Maps a nutrition metric to its goal field on the users/{uid} document.
GOAL_FIELD = {
    "calories": "calorieGoal",
    "protein": "protein",
    "carbs": "carbs",
    "fats": "fats",
}


def _load_series(user_id: str, metric: str) -> pd.Series:
    if metric == "weight":
        return get_weight_history(user_id)
    return get_daily_nutrition(user_id, metric)


def _build_summary(series: pd.Series, metric: str, user_id: str) -> Summary:
    """Compute trend, last-7-day average, and percent-vs-goal."""
    s = series.astype(float).sort_index()
    last7 = s.tail(7)
    weekly_avg = float(last7.mean())

    # Trend: compare the most recent 7-day mean to the prior 7-day mean.
    trend = "flat"
    prev7 = s.iloc[-14:-7]
    if len(prev7) > 0:
        prev_mean = float(prev7.mean())
        scale = abs(prev_mean) or 1.0
        rel_change = (weekly_avg - prev_mean) / scale
        if rel_change > 0.05:
            trend = "up"
        elif rel_change < -0.05:
            trend = "down"

    # vs_goal only applies to nutrition metrics (weight has no daily goal).
    vs_goal = 0.0
    if metric != "weight":
        goal = get_user_goals(user_id).get(GOAL_FIELD[metric])
        if goal:
            vs_goal = (weekly_avg / float(goal) - 1.0) * 100.0

    return Summary(
        trend=trend,
        weekly_avg=round(weekly_avg, 2),
        vs_goal=round(vs_goal, 2),
    )


@router.post(
    "/forecast-nutrition",
    response_model=ForecastResponse,
    dependencies=[Depends(require_token)],
)
def forecast_nutrition(req: ForecastRequest) -> ForecastResponse:
    """Forecast a metric 7 days out, with anomalies and a summary."""
    series = _load_series(req.user_id, req.metric)

    historical = [
        HistoricalPoint(
            date=pd.Timestamp(idx).date().isoformat(),
            value=float(val),
        )
        for idx, val in series.items()
    ]

    if len(series) < MIN_DAYS:
        return ForecastResponse(
            status="insufficient_data",
            metric=req.metric,
            message=(
                f"Need at least {MIN_DAYS} days of data to forecast — "
                f"you have {len(series)}. Keep logging!"
            ),
            historical=historical,
            forecast=[],
            anomalies=[],
            summary=None,
        )

    result = fit_and_forecast(series, horizon=HORIZON)

    last_date = pd.Timestamp(series.index.max())
    # None of the supported metrics (calories/protein/carbs/fats/weight) can be
    # physically negative, so clip point predictions and lower CI bounds at 0.
    # The upper bound is left untouched.
    forecast = [
        ForecastPoint(
            date=(last_date + timedelta(days=k + 1)).date().isoformat(),
            value=round(max(0.0, pred), 2),
            lower=round(max(0.0, lo), 2),
            upper=round(hi, 2),
        )
        for k, (pred, lo, hi) in enumerate(
            zip(result.predicted, result.lower, result.upper)
        )
    ]

    anomalies = [
        AnomalyPointOut(date=a.date, value=a.value, z_score=a.z_score)
        for a in detect_anomalies(series)
    ]

    return ForecastResponse(
        status="ok",
        metric=req.metric,
        model=result.model,
        historical=historical,
        forecast=forecast,
        anomalies=anomalies,
        summary=_build_summary(series, req.metric, req.user_id),
    )
