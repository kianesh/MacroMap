"""Rolling z-score anomaly detection.

We flag days whose value deviates more than ``threshold`` standard deviations
from a trailing rolling mean. A *trailing* (causal) window is used rather than a
centred one so the detector mirrors what would have been knowable in real time
and doesn't let a future spike mask itself. The default 30-day window captures
roughly a month of personal baseline, and 2.0 sigma corresponds to ~the outer
~5% of a normal distribution — a reasonable "this day was unusual" cutoff for
nutrition logs.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np
import pandas as pd


@dataclass
class AnomalyPoint:
    date: str  # ISO date (YYYY-MM-DD)
    value: float
    z_score: float


def detect_anomalies(
    series: pd.Series,
    window: int = 30,
    threshold: float = 2.0,
) -> List[AnomalyPoint]:
    """Return points where |rolling z-score| exceeds ``threshold``."""
    s = series.astype(float).sort_index()
    s = s[~s.index.duplicated(keep="last")]
    if len(s) < 3:
        return []

    # Allow early points to be scored once a small baseline exists, while
    # still preferring the full window once enough history is available.
    min_periods = min(window, max(3, len(s) // 2))
    roll = s.rolling(window=window, min_periods=min_periods)
    mean = roll.mean()
    std = roll.std(ddof=0)

    # Avoid divide-by-zero on flat stretches.
    z = (s - mean) / std.replace(0.0, np.nan)

    anomalies: List[AnomalyPoint] = []
    for idx, score in z.items():
        if pd.notna(score) and abs(score) > threshold:
            anomalies.append(
                AnomalyPoint(
                    date=pd.Timestamp(idx).date().isoformat(),
                    value=float(s.loc[idx]),
                    z_score=round(float(score), 3),
                )
            )
    return anomalies
