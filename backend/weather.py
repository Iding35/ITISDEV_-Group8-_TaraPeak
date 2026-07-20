from datetime import date as date_type
from typing import Optional

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
        f"&daily=temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max"
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

    if not temps or temps[0] is None:
        return None

    return {
        "temperature": round(temps[0], 1),
        "humidity": round(hums[0]),
        "wind_speed": round(winds[0], 1),
    }