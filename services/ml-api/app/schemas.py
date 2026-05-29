"""Pydantic request/response models for the public API."""
from typing import List, Literal, Optional

from pydantic import BaseModel

Metric = Literal["calories", "protein", "carbs", "fats", "weight"]


class ForecastRequest(BaseModel):
    """Incoming request body for POST /forecast-nutrition."""

    user_id: str
    metric: Metric


class HistoricalPoint(BaseModel):
    date: str  # ISO date (YYYY-MM-DD)
    value: float


class ForecastPoint(BaseModel):
    date: str
    value: float
    lower: float  # 95% CI lower bound
    upper: float  # 95% CI upper bound


class AnomalyPointOut(BaseModel):
    date: str
    value: float
    z_score: float


class Summary(BaseModel):
    trend: Literal["up", "down", "flat"]
    weekly_avg: float
    vs_goal: float  # percent difference of weekly avg vs the user's goal


class ForecastResponse(BaseModel):
    """Response body for POST /forecast-nutrition.

    ``status`` is "insufficient_data" when the user has fewer than the
    minimum number of days required to fit a model; in that case
    ``forecast``/``anomalies`` are empty and ``message`` explains why.
    """

    status: Literal["ok", "insufficient_data"]
    metric: Metric
    message: Optional[str] = None
    model: Optional[str] = None  # "SARIMAX" or "Holt-Winters"
    historical: List[HistoricalPoint]
    forecast: List[ForecastPoint]
    anomalies: List[AnomalyPointOut]
    summary: Optional[Summary] = None
