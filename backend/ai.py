import json
import os
import re
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


def _chat(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 500,
    json_mode: bool = False,
) -> str:
    """Single chat completion.

    `max_tokens` is worth raising for structured replies — a truncated JSON
    body is unparseable, so a too-small budget silently forces the fallback
    path. `json_mode` asks the provider to guarantee well-formed JSON.
    """
    client = get_client()
    kwargs = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = client.chat.completions.create(**kwargs)
    return response.choices[0].message.content.strip()


def _generate_fallback_difficulty(mountain: dict) -> str:
    mountain_name = mountain.get('mountain_name', 'the mountain')
    location = mountain.get('location', 'local site')
    difficulty = mountain.get('difficulty', 'moderate')
    distance = mountain.get('distance', 'N/A')
    estimated_time = mountain.get('estimated_time', 'N/A')
    terrain = mountain.get('terrain', 'varied')
    hazards = mountain.get('hazards', 'general hiking risks')
    
    return (
        f"**Suitability & Overview**\n"
        f"The trail on **{mountain_name}** ({location}) is listed as **{difficulty}**. "
        f"It is best suited for hikers with matching preparation for a {distance} km hike "
        f"taking approximately {estimated_time} hours. Beginners should hike with an experienced companion.\n\n"
        f"**Terrain & Key Challenges**\n"
        f"The route features {terrain} terrain. Path quality can vary; steep incline sections require good leg endurance. "
        f"Known hazards include: \"{hazards}\". Focus on step placement to avoid fatigue.\n\n"
        f"**Pacing Tip**\n"
        f"Maintain a steady, slow cadence from the start. Taking regular 5-minute standing breaks every 30 minutes "
        f"helps prevent premature lactic acid build-up on the ascent."
    )

def get_weather_condition_label(code: Optional[int]) -> str:
    if code is None:
        return "Unknown"
    if code == 0:
        return "Clear Sky"
    if code in (1, 2):
        return "Partly Cloudy"
    if code == 3:
        return "Overcast"
    if 51 <= code <= 55:
        return "Drizzle"
    if 61 <= code <= 65:
        return "Rain"
    if 80 <= code <= 82:
        return "Rain Showers"
    if code >= 95:
        return "Thunderstorm"
    return "Fair / Clear"

def _generate_fallback_safety(mountain: dict, weather: Optional[dict]) -> str:
    mountain_name = mountain.get('mountain_name', 'the mountain')
    difficulty = mountain.get('difficulty', 'moderate')
    terrain = mountain.get('terrain', 'varied')
    hazards = mountain.get('hazards', 'general hiking hazards')
    
    if weather:
        w_temp = weather.get('temperature', 'N/A')
        w_hum = weather.get('humidity', 'N/A')
        w_wind = weather.get('wind_speed', 'N/A')
        w_date = weather.get('hiking_date', 'your selected date')
        weather_info = (
            f"**Weather Advisory for {w_date}**\n"
            f"The forecast shows {w_temp}°C, {w_hum}% humidity, and {w_wind} km/h wind. "
            f"These outdoor parameters mean you should prepare for thermal regulation (adequate clothing layer options) "
            f"and ensure you have adequate hydration."
        )
    else:
        weather_info = (
            f"**Weather Advisory**\n"
            f"No specific weather forecast is loaded for your selected date. Check the morning weather forecast "
            f"before departing, and look out for unexpected afternoon wind or rain."
        )
        
    return (
        f"**Hazard & Terrain Brief**\n"
        f"On {mountain_name}, you'll encounter {terrain} terrain. Registered hazards: **{hazards}** "
        f"require constant focus. Do not deviate from the marked trails.\n\n"
        f"{weather_info}\n\n"
        f"**Safety Action Steps**\n"
        f"1. **Gear check:** Wear sturdy trail shoes with strong traction; bring a physical map or ensure your phone is fully charged.\n"
        f"2. **Communication:** Inform a contact person of your planned route and expected return time.\n"
        f"3. **Dehydration prevention:** Carry a minimum of 2.0L of water and high-energy snacks."
    )


def _generate_fallback_pacing(mountain: dict, waypoints: list) -> str:
    mountain_name = mountain.get('mountain_name', 'the mountain')
    estimated_time = mountain.get('estimated_time', 'N/A')
    
    waypoint_lines = []
    if waypoints:
        current_time_minutes = 60 * 6.5 # Start at 06:30 AM
        for i, w in enumerate(waypoints):
            name = w.get('name', 'Waypoint')
            seq = w.get('sequence_order', i + 1)
            dist = w.get('distance_from_start_km', 0)
            elev = w.get('elevation_m', 0)
            
            hours = int(current_time_minutes // 60)
            minutes = int(current_time_minutes % 60)
            ampm = "AM" if hours < 12 else "PM"
            time_str = f"{hours if hours <= 12 else hours - 12:02d}:{minutes:02d} {ampm}"
            
            waypoint_lines.append(f"- **{time_str}** | {seq}. **{name}** — Reach at {dist} km mark (elevation: {elev}m).")
            # estimate 45 minutes between waypoints
            current_time_minutes += 45
    else:
        waypoint_lines.append("- **06:30 AM**: Trailhead departure\n- **10:30 AM**: Summit/turn-back checkpoint\n- **02:30 PM**: Return to trailhead")
        
    waypoint_schedule = "\n".join(waypoint_lines)
    
    return (
        f"**Recommended Pacing Schedule**\n"
        f"For a target time budget of {estimated_time} hours, we suggest departing at **6:30 AM** "
        f"to utilize early light and cooler temperatures:\n\n"
        f"{waypoint_schedule}\n\n"
        f"**Key Rest Stop Advice**\n"
        f"Spend no more than 10-15 minutes at each waypoint to stay on schedule. "
        f"Use rest stops specifically to adjust layers, re-tie shoes, and check your map alignment."
    )


def analyze_difficulty(mountain: dict) -> str:
    try:
        system_prompt = (
            "You are a hiking guide analyzing trail difficulty for the TaraPeak app. "
            "Your response MUST start with an explicit Difficulty Level assessment formatted exactly as: "
            "**Difficulty:** [Easy / Moderate / Challenging / Hard / Critical]' on the very first line. "
            "Give a concise, practical difficulty analysis in 3-4 short paragraphs or bullet points. "
            "Cover: who this trail suits (beginner/intermediate/experienced), what makes it hard or easy, "
            "and one concrete tip to manage the difficulty. Do not just repeat the raw stats back verbatim."
        )
        user_prompt = (
            f"Mountain: {mountain.get('mountain_name', '')} ({mountain.get('location', '')})\n"
            f"Listed difficulty: {mountain.get('difficulty', '')}\n"
            f"Distance: {mountain.get('distance', '')} km\n"
            f"Estimated time: {mountain.get('estimated_time', '')} hours\n"
            f"Terrain: {mountain.get('terrain', '')}\n"
            f"Known hazards: {mountain.get('hazards', '')}\n"
        )
        return _chat(system_prompt, user_prompt)
    except Exception as e:
        print(f"[AI Fallback] DeepSeek API error: {e}. Generating local fallback analysis.")
        return _generate_fallback_difficulty(mountain)


def analyze_safety(mountain: dict, weather: Optional[dict]) -> str:
    try:
        system_prompt = (
            "You are a mountain safety advisor for the TaraPeak app. "
            "Your response MUST start with an explicit Safety Level assessment formatted exactly as: "
            "**Safety Level:** [Low Risk / Moderate Risk / High Risk / Dangerous]' on the very first line. "
            "**Analysis:** Give a concise safety analysis in 3-4 short paragraphs or bullet points, covering the trail's "
            "known hazards, how the forecast weather affects safety on this specific date if provided,"
            "and 2-3 concrete precautions a hiker should take. Be direct and specific, not generic."
            "CRITICAL RULE: If the Safety Level is 'Dangerous', you MUST append a clear warning banner "
            "at the VERY END of your response, strongly recommending that the hiker select a different hiking date."
        )
        weather_line = "No weather forecast is available for the selected date."
        if weather:
            condition_text = get_weather_condition_label(weather.get('weather_code'))
            weather_line = (
                f"Forecast for {weather.get('hiking_date')}: {weather.get('temperature')}c, "
                f"{weather.get('humidity')}% humidity, {weather.get('wind_speed')} km/h wind, "
                f"{weather.get('precipitation_mm', 0.0)} mm precipitation, condition: {condition_text}."
            )

        user_prompt = (
            f"Mountain: {mountain.get('mountain_name', '')} ({mountain.get('location', '')})\n"
            f"Difficulty: {mountain.get('difficulty', '')}\n"
            f"Terrain: {mountain.get('terrain', '')}\n"
            f"Known hazards: {mountain.get('hazards', '')}\n"
            f"{weather_line}\n"
        )
        return _chat(system_prompt, user_prompt)
    except Exception as e:
        print(f"[AI Fallback] DeepSeek API error: {e}. Generating local fallback safety advisory.")
        return _generate_fallback_safety(mountain, weather)


# ---------------------------------------------------------------------------
# Gear recommendation agent
# ---------------------------------------------------------------------------

GEAR_CATEGORIES = ["Clothing", "Footwear", "Navigation", "Safety", "Hydration", "Nutrition", "Shelter", "Other"]


def _extract_json(raw: str):
    """Pull a JSON array/object out of a model reply that may be fenced or prosey."""
    fenced = re.search(r"```(?:json)?\s*(.+?)\s*```", raw, re.DOTALL)
    if fenced:
        raw = fenced.group(1)
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Fall back to the outermost bracketed span.
    for opener, closer in (("[", "]"), ("{", "}")):
        start, end = raw.find(opener), raw.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise ValueError("Model reply contained no parseable JSON")


def _build_condition_brief(context: dict) -> str:
    """Step 1 of the agent: turn raw plan data into an explicit conditions assessment."""
    mountain = context.get("mountain") or {}
    trail = context.get("trail") or {}
    weather = context.get("weather")
    reports = context.get("reports") or []

    weather_line = "No forecast available for the selected date."
    if weather:
        weather_line = (
            f"{weather.get('temperature')}C, {weather.get('humidity')}% humidity, "
            f"{weather.get('wind_speed')} km/h wind."
        )

    report_lines = "\n".join(
        f"- {r.get('condition')} (rated {r.get('rating')}/5): {r.get('comment')}" for r in reports[:5]
    ) or "- No recent hiker reports for this trail."

    system_prompt = (
        "You are the conditions-assessment stage of a hiking gear agent for the TaraPeak app. "
        "Do NOT list gear yet. In at most 120 words, state the decisive conditions a packing list "
        "must answer for: temperature band, precipitation/moisture risk, wind exposure, altitude, "
        "trip duration (day hike vs overnight), terrain underfoot, and how the hiker's experience "
        "level changes the margin for error. Be concrete."
    )
    user_prompt = (
        f"Mountain: {mountain.get('mountain_name', '')} ({mountain.get('location', '')})\n"
        f"Terrain: {mountain.get('terrain', '')}\n"
        f"Known hazards: {mountain.get('hazards', '')}\n"
        f"Trail: {trail.get('name', '')} — {trail.get('difficulty', '')}, "
        f"{trail.get('distance_from_start_km', '?')} km, ~{trail.get('estimated_time', '?')} hours, "
        f"peak elevation {trail.get('elevation_m', '?')} m\n"
        f"Hiking date: {context.get('date', 'unspecified')}\n"
        f"Forecast: {weather_line}\n"
        f"Hiker experience level: {context.get('experience', 'beginner')}\n"
        f"Recent trail reports:\n{report_lines}\n"
    )
    return _chat(system_prompt, user_prompt)


def _select_gear(context: dict, brief: str) -> dict:
    """Step 2 of the agent: convert the conditions brief into a structured packing list."""
    trail = context.get("trail") or {}
    system_prompt = (
        "You are the packing-list stage of a hiking gear agent for the TaraPeak app. "
        "Given a conditions brief, return ONLY a JSON object, no prose, no code fence, shaped as:\n"
        '{"summary": "<2-sentence packing strategy>", "items": [{"gear_name": "...", '
        '"category": "...", "is_required": true, "reason": "<why THIS trip needs it>"}]}\n'
        f"category must be one of: {', '.join(GEAR_CATEGORIES)}.\n"
        "Return 8-14 items. Mark is_required true only for gear whose absence would end the hike "
        "or endanger the hiker; comfort and convenience items are false. Every reason must cite a "
        "specific condition from the brief — never generic advice."
    )
    user_prompt = (
        f"Conditions brief:\n{brief}\n\n"
        f"Trip length: ~{trail.get('estimated_time', '?')} hours, "
        f"{trail.get('distance_from_start_km', '?')} km.\n"
        f"Hiker experience level: {context.get('experience', 'beginner')}\n"
    )
    parsed = _extract_json(_chat(system_prompt, user_prompt, max_tokens=2000, json_mode=True))

    if isinstance(parsed, list):
        parsed = {"summary": "", "items": parsed}
    if not isinstance(parsed, dict) or not isinstance(parsed.get("items"), list):
        raise ValueError("Gear agent returned an unexpected JSON shape")

    items = []
    for entry in parsed["items"]:
        if not isinstance(entry, dict) or not entry.get("gear_name"):
            continue
        category = str(entry.get("category") or "Other").strip().title()
        items.append(
            {
                "gear_name": str(entry["gear_name"]).strip()[:100],
                "category": category if category in GEAR_CATEGORIES else "Other",
                "is_required": bool(entry.get("is_required", True)),
                "reason": str(entry.get("reason") or "").strip(),
            }
        )
    if not items:
        raise ValueError("Gear agent returned no usable items")

    return {"summary": str(parsed.get("summary") or "").strip(), "items": items, "source": "ai"}


def _generate_fallback_gear(context: dict) -> dict:
    """Rule-based packing list used when the model is unavailable.

    Reads the same signals as the agent so the offline result still reacts to
    cold, wind, altitude, trip length, and hiker experience.
    """
    mountain = context.get("mountain") or {}
    trail = context.get("trail") or {}
    weather = context.get("weather") or {}
    experience = str(context.get("experience") or "beginner").lower()

    temperature = weather.get("temperature")
    wind = weather.get("wind_speed")
    humidity = weather.get("humidity")
    elevation = trail.get("elevation_m") or 0
    hours = trail.get("estimated_time") or 0
    distance = trail.get("distance_from_start_km") or 0
    terrain = (mountain.get("terrain") or "").lower()

    is_cold = temperature is not None and float(temperature) <= 12
    is_windy = wind is not None and float(wind) >= 20
    is_damp = humidity is not None and int(humidity) >= 80
    is_high = float(elevation or 0) >= 2000
    is_long = float(hours or 0) >= 6
    is_overnight = float(hours or 0) >= 10

    items = [
        {
            "gear_name": "Broken-in trail shoes with aggressive tread",
            "category": "Footwear",
            "is_required": True,
            "reason": f"{distance} km over {terrain or 'mixed'} terrain punishes soft-soled shoes.",
        },
        {
            "gear_name": "Headlamp with spare batteries",
            "category": "Safety",
            "is_required": True,
            "reason": "A ~%s hour day leaves little daylight buffer if you fall behind schedule." % (hours or "long"),
        },
        {
            "gear_name": "First aid kit with blister care",
            "category": "Safety",
            "is_required": True,
            "reason": f"Hazards on this route: {mountain.get('hazards') or 'trail injuries and long evacuation times'}.",
        },
        {
            "gear_name": "Offline map and compass",
            "category": "Navigation",
            "is_required": True,
            "reason": "Phone signal is unreliable across the Cordillera ridgelines.",
        },
        {
            "gear_name": "%s L of water" % ("3" if is_long else "2"),
            "category": "Hydration",
            "is_required": True,
            "reason": "Refill points are scarce on a %s km route." % distance,
        },
        {
            "gear_name": "High-energy trail snacks",
            "category": "Nutrition",
            "is_required": True,
            "reason": "Sustains output across the %s hour time budget." % (hours or "full-day"),
        },
        {
            "gear_name": "Rain shell / packable poncho",
            "category": "Clothing",
            "is_required": True,
            "reason": "Cordillera weather turns fast, and wet clothing accelerates heat loss.",
        },
        {
            "gear_name": "Sun protection (hat, SPF 50, sunglasses)",
            "category": "Clothing",
            "is_required": True,
            "reason": "Exposed ridge and grassland sections give almost no shade.",
        },
        {
            "gear_name": "Trekking poles",
            "category": "Other",
            "is_required": False,
            "reason": "Cuts knee load on the descent and steadies footing on loose ground.",
        },
    ]

    if is_cold:
        items.append(
            {
                "gear_name": "Insulating mid-layer (fleece or synthetic puffy)",
                "category": "Clothing",
                "is_required": True,
                "reason": f"Forecast is {temperature}C — below the 12C threshold where hypothermia risk climbs.",
            }
        )
        items.append(
            {
                "gear_name": "Beanie and insulated gloves",
                "category": "Clothing",
                "is_required": True,
                "reason": f"Extremities lose heat first at {temperature}C, especially before sunrise.",
            }
        )
    if is_windy:
        items.append(
            {
                "gear_name": "Windproof outer layer",
                "category": "Clothing",
                "is_required": True,
                "reason": f"{wind} km/h winds drive the effective temperature well below the air reading.",
            }
        )
    if is_damp:
        items.append(
            {
                "gear_name": "Dry bag for spare clothes and electronics",
                "category": "Other",
                "is_required": True,
                "reason": f"{humidity}% humidity keeps everything damp; a dry change is your hypothermia reserve.",
            }
        )
    if is_high:
        items.append(
            {
                "gear_name": "Altitude-aware pacing plan and electrolytes",
                "category": "Safety",
                "is_required": True,
                "reason": f"The route tops out near {elevation} m, where altitude sickness becomes a real risk.",
            }
        )
    if is_overnight:
        items.append(
            {
                "gear_name": "4-season tent and sleeping bag rated to 0C",
                "category": "Shelter",
                "is_required": True,
                "reason": f"At ~{hours} hours this is a multi-day trek requiring an overnight camp.",
            }
        )
    if experience.startswith("beginner"):
        items.append(
            {
                "gear_name": "Registered guide contact and emergency whistle",
                "category": "Safety",
                "is_required": True,
                "reason": "Recommended for a beginner-level hiker on an unfamiliar route.",
            }
        )

    conditions = []
    if is_cold:
        conditions.append(f"cold ({temperature}C)")
    if is_windy:
        conditions.append(f"windy ({wind} km/h)")
    if is_damp:
        conditions.append(f"damp ({humidity}% humidity)")
    if is_high:
        conditions.append(f"high altitude ({elevation} m)")
    condition_text = ", ".join(conditions) if conditions else "moderate conditions"

    summary = (
        f"Packing for {condition_text} on {trail.get('name') or 'this trail'} "
        f"({distance} km, ~{hours} hours). Prioritise layering you can shed on the ascent "
        f"and a dry reserve you never hike in."
    )
    return {"summary": summary, "items": items, "source": "fallback"}


def recommend_gear(context: dict) -> dict:
    """Two-stage gear agent: assess conditions, then select gear against that assessment.

    `context` carries mountain, trail, weather, date, experience, and recent
    trail reports. Falls back to a deterministic rule-based list whenever the
    model is unreachable or returns something unparseable, so the endpoint
    never hard-fails on a missing API key.
    """
    try:
        brief = _build_condition_brief(context)
        result = _select_gear(context, brief)
        result["conditions_brief"] = brief
        return result
    except Exception as e:
        print(f"[AI Fallback] Gear agent error: {e}. Generating rule-based packing list.")
        return _generate_fallback_gear(context)


def optimize_route(mountain: dict, waypoints: list) -> str:
    try:
        system_prompt = (
            "You are a trail pacing expert for the TaraPeak app. Mountain trails are linear (one path up, "
            "the same path back), so 'optimizing the route' means recommending pacing and timing, not "
            "reordering waypoints. Given the ordered waypoints with distance and elevation, produce: a "
            "suggested start time, a rough time budget between each waypoint, and 1-2 notes on where to be "
            "cautious (steep elevation gain between waypoints, etc). Keep it concise and practical."
        )
        
        waypoint_lines = "\n".join(
            f"{w['sequence_order']}. {w['name']} — {w.get('distance_from_start_km', 0)} km from start, "
            f"{w.get('elevation_m', 0)}m elevation. {w.get('description', '')}"
            for w in waypoints
        )
        
        total_dist = waypoints[-1].get('distance_from_start_km', mountain.get('distance', 'N/A')) if waypoints else mountain.get('distance', 'N/A')
        
        user_prompt = (
            f"Mountain: {mountain.get('mountain_name', '')}\n"
            f"Total distance: {total_dist} km\n"
            f"Estimated total time: {mountain.get('estimated_time', 'N/A')} hours\n"
            f"Difficulty: {mountain.get('difficulty', 'N/A')}\n"
            f"Waypoints in order:\n{waypoint_lines}\n"
        )
        return _chat(system_prompt, user_prompt)
    except Exception as e:
        print(f"[AI Fallback] DeepSeek API error: {e}. Generating local fallback pacing/route optimization plan.")
        return _generate_fallback_pacing(mountain, waypoints)
