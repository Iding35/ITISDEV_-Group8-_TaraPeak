import os
from datetime import date as date_type
from typing import Optional

import requests

FORECAST_URL = "https://weather.googleapis.com/v1/forecast/days:lookup"
MAX_FORECAST_DAYS = 10


def fetch_forecast_for_date(latitude: float, longitude: float, hiking_date: date_type) -> Optional[dict]:
    """Look up the Google Weather API forecast for a specific date at a trail's coordinates.

    Returns None if the date falls outside the provider's forecast window rather than
    raising, since "no forecast yet" is an expected, non-error outcome.
    """
    api_key = os.environ.get("GOOGLE_WEATHER_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_WEATHER_API_KEY is not set")

    days_ahead = (hiking_date - date_type.today()).days
    if days_ahead < 0 or days_ahead >= MAX_FORECAST_DAYS:
        return None

    response = requests.get(
        FORECAST_URL,
        params={
            "key": api_key,
            "location.latitude": latitude,
            "location.longitude": longitude,
            "days": days_ahead + 1,
        },
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()

    for day in data.get("forecastDays", []):
        display = day.get("displayDate") or {}
        if not display:
            continue
        day_date = date_type(display["year"], display["month"], display["day"])
        if day_date != hiking_date:
            continue

        max_temp = (day.get("maxTemperature") or {}).get("degrees")
        min_temp = (day.get("minTemperature") or {}).get("degrees")
        if max_temp is not None and min_temp is not None:
            temperature = round((max_temp + min_temp) / 2, 1)
        else:
            temperature = max_temp if max_temp is not None else min_temp

        daytime = day.get("daytimeForecast") or {}
        humidity = daytime.get("relativeHumidity")
        wind_speed = ((daytime.get("wind") or {}).get("speed") or {}).get("value")

        return {
            "temperature": temperature,
            "humidity": humidity,
            "wind_speed": wind_speed,
        }

    return None
