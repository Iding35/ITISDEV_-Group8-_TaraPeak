from datetime import date as date_type
from typing import Optional

import calendar
import datetime
import requests

def fetch_forecast_for_date(latitude: float, longitude: float, hiking_date: datetime.date):
    date_str = hiking_date.strftime("%Y-%m-%d")
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}"
        f"&longitude={longitude}"
        f"&start_date={date_str}"
        f"&end_date={date_str}"
        f"&daily=temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum,weather_code"
        f"&timezone=Asia%2FSingapore"
    )

    response = requests.get(url, timeout=10)
    if response.status_code != 200:
        raise Exception(f"Open-Meteo API error: {response.status_code}")

    data = response.json()
    daily = data.get("daily", {})

    temps = daily.get("temperature_2m_mean", [])
    hums = daily.get("relative_humidity_2m_mean", [])
    winds = daily.get("wind_speed_10m_max", [])
    precipitation = daily.get("precipitation_sum", [])
    weather_codes = daily.get("weather_code", [])

    if not temps or temps[0] is None:
        return None

    return {
        "temperature": round(temps[0], 1),
        "humidity": round(hums[0]) if hums and hums[0] is not None else None,
        "wind_speed": round(winds[0], 1) if winds and winds[0] is not None else None,
        "precipitation_mm": round(precipitation[0], 1) if precipitation and precipitation[0] is not None else 0.0,
        "weather_code": weather_codes[0] if weather_codes and weather_codes[0] is not None else None,
    }


def fetch_historical_month_average(latitude: float, longitude: float, year: int, month: int) -> Optional[dict]:
    """One year's worth of a calendar month, averaged to a single data point.

    Uses Open-Meteo's free historical archive (a different host/dataset than
    the near-term forecast above — the forecast API only carries a rolling
    ~16-day window and has no past data). Returns None if the archive has
    nothing for that span (e.g. a still-in-progress month with too few days).
    """
    last_day = calendar.monthrange(year, month)[1]
    start_str = f"{year}-{month:02d}-01"
    end_str = f"{year}-{month:02d}-{last_day:02d}"
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={latitude}"
        f"&longitude={longitude}"
        f"&start_date={start_str}"
        f"&end_date={end_str}"
        f"&daily=temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum"
        f"&timezone=Asia%2FSingapore"
    )

    response = requests.get(url, timeout=15)
    if response.status_code != 200:
        raise Exception(f"Open-Meteo archive API error: {response.status_code}")

    daily = response.json().get("daily", {})
    temps = [v for v in daily.get("temperature_2m_mean", []) if v is not None]
    hums = [v for v in daily.get("relative_humidity_2m_mean", []) if v is not None]
    winds = [v for v in daily.get("wind_speed_10m_max", []) if v is not None]
    precs = [v for v in daily.get("precipitation_sum", []) if v is not None]

    if not temps:
        return None

    return {
        "avg_temperature": round(sum(temps) / len(temps), 1),
        "avg_humidity": round(sum(hums) / len(hums)) if hums else None,
        "avg_wind_speed": round(sum(winds) / len(winds), 1) if winds else None,
        "avg_precipitation": round(sum(precs) / len(precs), 1) if precs else 0.0,
    }