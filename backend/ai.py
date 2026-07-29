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
    
def analyze_difficulty(mountain: dict, current_user: dict) -> str:
    try:
        hiker_experience = current_user.get('hiker_experience', 'beginner') if current_user else 'beginner'
        
        system_prompt = (
            "You are a hiking guide analyzing trail difficulty for the TaraPeak app. "
            "Your response MUST start with an explicit Difficulty Level assessment formatted exactly as: "
            "**Difficulty:** [Easy / Moderate / Challenging / Hard / Critical] on the very first line. "
            "**Analysis:** Give a concise, practical difficulty analysis in 3-4 short paragraphs or bullet points. "
            "Specifically evaluate how this trail's terrain, distance, and hazards match up against the user's stated experience level, "
            "what makes it uniquely hard or manageable for someone at that specific level, "
            "and **Tip:** Provide one concrete, tailored tip to help them successfully manage the route. "
            "Do not just repeat the raw stats back verbatim."
            "STRICT RULES: Do not use em dashes (—) anywhere in your response. "
            "Keep your analysis balanced: avoid generic platitudes like 'stay safe and drink water,' "
            "but avoid overly specific micro-details or trivial facts. Focus on practical, trail-specific factors "
            "that directly affect a hiker with the user's experience level."
        )
        user_prompt = (
            f"Mountain: {mountain.get('mountain_name', '')} ({mountain.get('location', '')})\n"
            f"Listed difficulty: {mountain.get('difficulty', '')}\n"
            f"Distance: {mountain.get('distance', '')} km\n"
            f"Estimated time: {mountain.get('estimated_time', '')} hours\n"
            f"Terrain: {mountain.get('terrain', '')}\n"
            f"Known hazards: {mountain.get('hazards', '')}\n"
            f"User Hiking Experience: {hiker_experience}\n"
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


def optimize_route(mountain: dict, waypoints: list, user_experience: str = None) -> str:
    try:
        system_prompt = (
        "You are an expert hiking route strategist and pacing analyst for the TaraPeak app. "
    "Each waypoint represents a possible trail destination that a user may choose to hike toward. "
    "The user may not necessarily complete the entire mountain route. "
    "Recommend the single best waypoint based on the user's hiking experience, mountain difficulty, terrain, elevation, distance, and estimated hiking time. "
    "Limit all analysis to the recommended waypoint and the route leading to it. "
    "Do not analyze or reference trail sections beyond the recommended waypoint.\n\n"

    "Your response MUST follow this structure:\n\n"

    "1. **Recommended Trail:** State the single recommended waypoint.\n\n"

    "2. **Pacing Level:** Classify the pace as "
    "[Beginner-Friendly / Moderate Pace / Demanding / Expert Stride].\n\n"

    "3. **Route Optimization & Analysis:** Explain why this waypoint is the best destination for the user. "
    "Discuss terrain, elevation, distance, pacing efficiency, and suitability for the user's hiking experience. "
    "Base the analysis only on the trail leading to this waypoint, not the remainder of the mountain.\n"

    "4. **Pacing Strategy:** Recommend how the user should manage their pace while hiking toward the recommended waypoint.\n\n"

    "5. **Rest Timing:** Recommend appropriate rest timing before reaching the recommended waypoint based on elapsed hiking time and terrain.")
        
        waypoint_lines = "\n".join(
            f"{w['sequence_order']}. {w['name']} — {w.get('distance_from_start_km', 0)} km from start, "
            f"{w.get('elevation_m', 0)}m elevation. {w.get('description', '')}"
            for w in waypoints
        )
        
        total_dist = waypoints[-1].get('distance_from_start_km', mountain.get('distance', 'N/A')) if waypoints else mountain.get('distance', 'N/A')
        
        user_prompt = (
            f"Mountain: {mountain.get('mountain_name', '')}\n"
            f"Hiking Experience: {user_experience or 'Not specified'}\n"
            f"Total distance: {total_dist} km\n"
            f"Estimated total time: {mountain.get('estimated_time', 'N/A')} hours\n"
            f"Difficulty: {mountain.get('difficulty', 'N/A')}\n"
            f"Waypoints in order:\n{waypoint_lines}\n"
        )
        return _chat(system_prompt, user_prompt)
    except Exception as e:
        print(f"[AI Fallback] DeepSeek API error: {e}. Generating local fallback pacing/route optimization plan.")
        return _generate_fallback_pacing(mountain, waypoints)


# ---------------------------------------------------------------------------
# Diagnostic analysis: trail selection frequency vs. categorical attributes
# ---------------------------------------------------------------------------


def _format_group_rows(rows: list, label_key: str) -> str:
    lines = []
    for r in rows:
        label = r.get(label_key) or "Unspecified"
        rating = r.get("avg_rating")
        rating_str = f"{rating}/5" if rating is not None else "no ratings yet"
        lines.append(
            f"- {label}: selected {r.get('times_selected', 0)} time(s), "
            f"average rating {rating_str} ({r.get('report_count', 0)} reports)"
        )
    return "\n".join(lines) if lines else "- No data recorded yet."


def _generate_fallback_diagnostic(stats: dict) -> dict:
    """Rule-based diagnostic summary: picks the highest- and lowest-selected
    group in each dimension and states the comparison plainly, without
    claiming statistical correlation the data can't support.
    """
    findings = []
    for dimension, rows in (
        ("difficulty", stats.get("by_difficulty", [])),
        ("terrain", stats.get("by_terrain", [])),
        ("accessibility", stats.get("by_accessibility", [])),
    ):
        ranked = sorted(rows, key=lambda r: r.get("times_selected") or 0, reverse=True)
        if len(ranked) < 2:
            continue
        top, bottom = ranked[0], ranked[-1]
        if (top.get("times_selected") or 0) == (bottom.get("times_selected") or 0):
            continue
        top_label = top.get(dimension) or "Unspecified"
        bottom_label = bottom.get(dimension) or "Unspecified"
        findings.append(
            f"By {dimension}, {top_label} trails are hiked most often "
            f"({top.get('times_selected', 0)} plans, avg rating "
            f"{top.get('avg_rating') if top.get('avg_rating') is not None else 'n/a'}), "
            f"while {bottom_label} trails are hiked least "
            f"({bottom.get('times_selected', 0)} plans)."
        )

    if not findings:
        findings.append(
            "Not enough plan history yet to compare selection frequency across groups."
        )

    return {"narrative": " ".join(findings), "source": "fallback"}


def diagnose_trail_patterns(stats: dict) -> dict:
    """Agentic diagnostic step: takes trail-selection frequency grouped by
    difficulty, terrain, and accessibility (each paired with average trail
    rating), and identifies/articulates the patterns.

    This does not compute a Pearson correlation — the groups are categorical
    labels, not continuous variables, so a correlation coefficient would be
    meaningless. Instead the model is given the grouped counts/ratings
    directly and asked to name the real relationships they show (which
    categories dominate selection, whether popularity tracks with rating,
    where they diverge) — the standard, honest reading of categorical
    diagnostic data. Falls back to a rule-based comparison if the model is
    unreachable.
    """
    try:
        system_prompt = (
            "You are a diagnostic analytics agent for the TaraPeak hiking app. "
            "You are given how often trails were selected for a hike plan, and their "
            "average hiker rating, grouped by three categorical attributes: difficulty, "
            "terrain type, and accessibility. Identify concrete patterns: which "
            "categories dominate selection, whether popularity tracks with rating or "
            "diverges from it, and one actionable implication for trip planning or trail "
            "promotion. Do not describe this as a statistical correlation coefficient — "
            "these are categorical groups, not continuous variables. Reference actual "
            "numbers from the data. 3-4 short paragraphs or bullet points, concise and "
            "concrete, no generic filler."
        )
        user_prompt = (
            f"Selection frequency and rating by DIFFICULTY:\n"
            f"{_format_group_rows(stats.get('by_difficulty', []), 'difficulty')}\n\n"
            f"Selection frequency and rating by TERRAIN:\n"
            f"{_format_group_rows(stats.get('by_terrain', []), 'terrain')}\n\n"
            f"Selection frequency and rating by ACCESSIBILITY:\n"
            f"{_format_group_rows(stats.get('by_accessibility', []), 'accessibility')}\n"
        )
        narrative = _chat(system_prompt, user_prompt, max_tokens=700)
        return {"narrative": narrative, "source": "ai"}
    except Exception as e:
        print(f"[AI Fallback] Diagnostic agent error: {e}. Generating rule-based comparison.")
        return _generate_fallback_diagnostic(stats)


# ---------------------------------------------------------------------------
# Prescriptive decision support: unified security index + gear/action checklist
# ---------------------------------------------------------------------------

# Condition strings that indicate a hazard, matched against recent trail_reports.
# Keep in sync with the CONDITIONS list on the trail-report form (Dashboard.tsx).
_ADVERSE_CONDITIONS = {
    "Muddy / Slippery",
    "Foggy / Low Visibility",
    "Steep Sections",
    "River Crossing",
    "Rocky Terrain",
}


def compute_security_index(context: dict) -> dict:
    """Deterministic 0-100 safety score (100 = safest) from real-time
    conditions, recent safety reports, and the trail's structural profile.

    Kept separate from the LLM call on purpose: a numeric index used for a
    go/no-go decision needs to be reproducible and auditable, not something
    that can vary between identical requests. The model's job (below) is to
    turn this score and the signals behind it into human guidance, not to
    invent the number itself.
    """
    score = 100
    reasons = []

    weather = context.get("weather") or {}
    temp = weather.get("temperature")
    wind = weather.get("wind_speed")
    precip = weather.get("precipitation_mm")

    if temp is not None:
        if temp < 5:
            score -= 20
            reasons.append(f"Near-freezing forecast ({temp}°C) raises hypothermia risk.")
        elif temp < 10:
            score -= 10
            reasons.append(f"Cold forecast ({temp}°C) calls for insulating layers.")
        elif temp > 32:
            score -= 10
            reasons.append(f"High heat forecast ({temp}°C) raises heat-exhaustion risk.")

    if wind is not None:
        if wind > 40:
            score -= 20
            reasons.append(f"Severe wind forecast ({wind} km/h) is dangerous on exposed ridgelines.")
        elif wind > 25:
            score -= 10
            reasons.append(f"Strong wind forecast ({wind} km/h) affects footing on exposed sections.")

    if precip is not None:
        if precip > 30:
            score -= 20
            reasons.append(f"Heavy rainfall forecast ({precip} mm) raises landslide/flash-flood risk.")
        elif precip > 10:
            score -= 10
            reasons.append(f"Moderate rainfall forecast ({precip} mm) will make the trail slick.")

    trail = context.get("trail") or {}
    difficulty = (trail.get("difficulty") or "").strip().lower()
    if difficulty == "hard":
        score -= 15
        reasons.append("Trail is rated Hard, raising baseline physical risk.")
    elif difficulty == "moderate":
        score -= 5

    elevation = trail.get("elevation_m") or 0
    if elevation and elevation >= 2500:
        score -= 10
        reasons.append(f"Peak elevation {elevation} m carries altitude-related risk.")

    reports = context.get("reports") or []
    adverse_hits = [r for r in reports if r.get("condition") in _ADVERSE_CONDITIONS]
    if adverse_hits:
        penalty = min(20, 5 * len(adverse_hits))
        score -= penalty
        seen = ", ".join(sorted({r["condition"] for r in adverse_hits}))
        reasons.append(f"Recent hiker reports flagged: {seen}.")

    ratings = [r.get("rating") for r in reports if r.get("rating") is not None]
    if ratings:
        avg_rating = sum(ratings) / len(ratings)
        if avg_rating < 3:
            score -= 10
            reasons.append(f"Recent reports average only {avg_rating:.1f}/5.")

    score = max(0, min(100, score))
    if score >= 80:
        label = "Low Risk"
    elif score >= 60:
        label = "Moderate Risk"
    elif score >= 40:
        label = "Elevated Risk"
    else:
        label = "High Risk"

    return {"security_index": score, "risk_label": label, "reasons": reasons}


def _generate_fallback_checklist(context: dict) -> list:
    """Rule-based checklist used when the model is unreachable. Mirrors the
    signals compute_security_index() already read, so it stays consistent
    with the numeric score even offline.
    """
    weather = context.get("weather") or {}
    trail = context.get("trail") or {}
    items = [
        {"item": "Trail map or GPS track downloaded offline", "reason": "Cell coverage is unreliable on most Cordillera trails.", "is_critical": True},
        {"item": "First aid kit", "reason": "Standard for any hike, especially on rated trails with reported hazards.", "is_critical": True},
        {"item": "Headlamp with spare batteries", "reason": "Covers any delay that pushes the hike past daylight.", "is_critical": True},
    ]
    if (weather.get("temperature") or 20) < 10:
        items.append({"item": "Insulating layer and gloves", "reason": f"Forecast of {weather.get('temperature')}°C.", "is_critical": True})
    if (weather.get("precipitation_mm") or 0) > 10:
        items.append({"item": "Rain shell and dry bag", "reason": f"{weather.get('precipitation_mm')} mm of rain forecast.", "is_critical": True})
    if (weather.get("wind_speed") or 0) > 25:
        items.append({"item": "Windproof outer layer", "reason": f"{weather.get('wind_speed')} km/h wind forecast.", "is_critical": False})
    if (trail.get("elevation_m") or 0) >= 2500:
        items.append({"item": "Electrolytes and a conservative pace", "reason": f"Peak elevation {trail.get('elevation_m')} m.", "is_critical": False})
    if (trail.get("difficulty") or "").lower() == "hard":
        items.append({"item": "Trekking poles", "reason": "Trail is rated Hard.", "is_critical": False})
    for r in (context.get("reports") or [])[:3]:
        if r.get("condition") in _ADVERSE_CONDITIONS:
            items.append({
                "item": f"Extra caution: {r['condition'].lower()}",
                "reason": f"Reported by a recent hiker: \"{r.get('comment', '')[:80]}\"",
                "is_critical": False,
            })
    return items


def generate_prescriptive_safety(context: dict) -> dict:
    """Prescriptive step: compute the deterministic security index, then ask
    the model to explain it and produce a checklist array. Falls back to a
    rule-based checklist (still keyed off the same computed index) if the
    model is unreachable.
    """
    index_result = compute_security_index(context)

    try:
        mountain = context.get("mountain") or {}
        trail = context.get("trail") or {}
        weather = context.get("weather") or {}
        reports = context.get("reports") or []

        system_prompt = (
            "You are a prescriptive safety-planning agent for the TaraPeak hiking app. "
            "You are given a pre-computed security index (0-100, 100 = safest) and the "
            "reasons behind it. Do not recompute or contradict the index. Return ONLY a "
            "JSON object, no prose, no code fence, shaped as:\n"
            '{"summary": "<2-3 sentence explanation of the index in plain language>", '
            '"checklist": [{"item": "...", "reason": "...", "is_critical": true}]}\n'
            "Return 6-10 checklist items. is_critical true only for items whose absence "
            "could end the hike or endanger the hiker. Every reason must cite a specific "
            "signal from the input (a forecast number, a reported condition, the trail's "
            "own difficulty/elevation) — never generic advice."
        )
        user_prompt = (
            f"Mountain: {mountain.get('mountain_name', '')}\n"
            f"Trail: {trail.get('name', '')} — {trail.get('difficulty', '')}, "
            f"{trail.get('elevation_m', '?')} m elevation\n"
            f"Known hazards: {mountain.get('hazards', '')}\n"
            f"Forecast: {weather.get('temperature', '?')}°C, {weather.get('wind_speed', '?')} km/h wind, "
            f"{weather.get('precipitation_mm', '?')} mm precipitation\n"
            f"Security index: {index_result['security_index']}/100 ({index_result['risk_label']})\n"
            f"Reasons: {'; '.join(index_result['reasons']) or 'No adverse signals detected.'}\n"
            f"Recent reports: {'; '.join(r.get('condition', '') for r in reports[:5]) or 'None'}\n"
        )
        parsed = _extract_json(_chat(system_prompt, user_prompt, max_tokens=1200, json_mode=True))
        checklist = parsed.get("checklist") if isinstance(parsed, dict) else None
        if not isinstance(checklist, list) or not checklist:
            raise ValueError("Prescriptive agent returned no usable checklist")

        clean_checklist = []
        for entry in checklist:
            if not isinstance(entry, dict) or not entry.get("item"):
                continue
            clean_checklist.append({
                "item": str(entry["item"]).strip()[:150],
                "reason": str(entry.get("reason") or "").strip(),
                "is_critical": bool(entry.get("is_critical", False)),
            })
        if not clean_checklist:
            raise ValueError("Prescriptive agent returned no usable checklist items")

        return {
            **index_result,
            "summary": str(parsed.get("summary") or "").strip(),
            "checklist": clean_checklist,
            "source": "ai",
        }
    except Exception as e:
        print(f"[AI Fallback] Prescriptive agent error: {e}. Generating rule-based checklist.")
        return {
            **index_result,
            "summary": (
                f"Security index {index_result['security_index']}/100 ({index_result['risk_label']}). "
                + (" ".join(index_result["reasons"]) or "No significant adverse signals detected.")
            ),
            "checklist": _generate_fallback_checklist(context),
            "source": "fallback",
        }


# ---------------------------------------------------------------------------
# Chatbot: grounded Q&A over the app's own trail data
# ---------------------------------------------------------------------------

CHAT_HISTORY_LIMIT = 12  # most recent turns kept, oldest trimmed first
CHAT_SYSTEM_PROMPT = (
    "You are TaraPeak's trail assistant. Help hikers find mountains and trails, compare "
    "difficulty/distance/duration, understand hazards, and figure out what to bring. "
    "Answer ONLY from the CURRENT TRAIL DATA block below — it is the full, current list of "
    "every mountain and trail in the app. If something isn't in that data (a mountain not "
    "listed, a live weather number, availability), say TaraPeak doesn't have that rather than "
    "guessing. Keep answers short and conversational — 2-4 sentences unless the hiker asks for "
    "a list. Do not invent trail names, distances, or hazards not present in the data."
)


def _generate_fallback_chat_reply(message: str) -> str:
    """Used only when the model is unreachable — a chatbot can't run its
    normal rule-based fallback the way a single-shot analysis can, since the
    reply has to address whatever the hiker actually typed. This is honest
    about that limit rather than pretending to answer.
    """
    return (
        "The AI assistant is temporarily unavailable, so I can't answer that right now. "
        "In the meantime, the Explore page lists every mountain with its terrain and hazards, "
        "and each trail's detail page has difficulty, distance, and duration."
        + (f" (Your question: \"{message.strip()[:200]}\")" if message.strip() else "")
    )


def chat_reply(message: str, history: list, trail_data_snapshot: str) -> dict:
    """One turn of the trail-assistant chatbot.

    Stateless by design: the caller (frontend) holds the conversation and
    resends it each turn, same pattern as every other AI endpoint in this
    file. `trail_data_snapshot` is a compact text dump of every mountain and
    trail, rebuilt fresh per request so the assistant is always grounded in
    the database's current contents rather than the model's training data.
    """
    try:
        trimmed_history = history[-CHAT_HISTORY_LIMIT:]
        messages = [
            {"role": "system", "content": f"{CHAT_SYSTEM_PROMPT}\n\nCURRENT TRAIL DATA:\n{trail_data_snapshot}"},
        ]
        for turn in trimmed_history:
            role = turn.get("role")
            content = turn.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})

        client = get_client()
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            temperature=0.4,
            max_tokens=400,
        )
        return {"reply": response.choices[0].message.content.strip(), "source": "ai"}
    except Exception as e:
        print(f"[AI Fallback] Chat agent error: {e}. Returning unavailability notice.")
        return {"reply": _generate_fallback_chat_reply(message), "source": "fallback"}
