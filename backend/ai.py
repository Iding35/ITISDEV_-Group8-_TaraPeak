import os
from typing import Optional

from openai import OpenAI

_client: Optional[OpenAI] = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not set")
        _client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    return _client


def _chat(system_prompt: str, user_prompt: str) -> str:
    client = get_client()
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
        max_tokens=500,
    )
    return response.choices[0].message.content.strip()


def analyze_difficulty(mountain: dict) -> str:
    system_prompt = (
        "You are a hiking guide analyzing trail difficulty for the TaraPeak app. "
        "Give a concise, practical difficulty analysis in 3-4 short paragraphs or bullet points. "
        "Cover: who this trail suits (beginner/intermediate/experienced), what makes it hard or easy, "
        "and one concrete tip to manage the difficulty. Do not just repeat the raw stats back verbatim."
    )
    user_prompt = (
        f"Mountain: {mountain['mountain_name']} ({mountain['location']})\n"
        f"Listed difficulty: {mountain['difficulty']}\n"
        f"Distance: {mountain['distance']} km\n"
        f"Estimated time: {mountain['estimated_time']} hours\n"
        f"Terrain: {mountain['terrain']}\n"
        f"Known hazards: {mountain['hazards']}\n"
    )
    return _chat(system_prompt, user_prompt)


def analyze_safety(mountain: dict, weather: Optional[dict]) -> str:
    system_prompt = (
        "You are a mountain safety advisor for the TaraPeak app. "
        "Give a concise safety analysis in 3-4 short paragraphs or bullet points, covering the trail's "
        "known hazards, how the forecast weather affects safety on this specific date if provided, "
        "and 2-3 concrete precautions a hiker should take. Be direct and specific, not generic."
    )
    weather_line = "No weather forecast is available for the selected date."
    if weather:
        weather_line = (
            f"Forecast for {weather['hiking_date']}: {weather['temperature']}C, "
            f"{weather['humidity']}% humidity, {weather['wind_speed']} km/h wind."
        )
    user_prompt = (
        f"Mountain: {mountain['mountain_name']} ({mountain['location']})\n"
        f"Difficulty: {mountain['difficulty']}\n"
        f"Terrain: {mountain['terrain']}\n"
        f"Known hazards: {mountain['hazards']}\n"
        f"{weather_line}\n"
    )
    return _chat(system_prompt, user_prompt)


def optimize_route(mountain: dict, waypoints: list) -> str:
    system_prompt = (
        "You are a trail pacing expert for the TaraPeak app. Mountain trails are linear (one path up, "
        "the same path back), so 'optimizing the route' means recommending pacing and timing, not "
        "reordering waypoints. Given the ordered waypoints with distance and elevation, produce: a "
        "suggested start time, a rough time budget between each waypoint, and 1-2 notes on where to be "
        "cautious (steep elevation gain between waypoints, etc). Keep it concise and practical."
    )
    waypoint_lines = "\n".join(
        f"{w['sequence_order']}. {w['name']} — {w['distance_from_start_km']} km from start, "
        f"{w['elevation_m']}m elevation. {w['description']}"
        for w in waypoints
    )
    user_prompt = (
        f"Mountain: {mountain['mountain_name']}\n"
        f"Total distance: {mountain['distance']} km\n"
        f"Estimated total time: {mountain['estimated_time']} hours\n"
        f"Difficulty: {mountain['difficulty']}\n"
        f"Waypoints in order:\n{waypoint_lines}\n"
    )
    return _chat(system_prompt, user_prompt)
