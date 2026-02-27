"""
Sports Numerology Core Logic
"""
from datetime import datetime
import unicodedata
import re


# ---------------- NORMALIZATION ----------------

def normalize_name(name: str) -> str:
    """
    Normalize name for numerology calculations:
    - Remove diacritics: Peréz -> Perez, Vaško -> Vasko
    - Keep letters + spaces only
    - Collapse multiple spaces
    """
    if not name:
        return ""

    # Normalize to decomposed form and drop diacritics
    s = unicodedata.normalize("NFKD", name)
    s = s.encode("ascii", "ignore").decode("ascii")

    # Keep only letters and spaces
    s = re.sub(r"[^A-Za-z\s]", " ", s)

    # Collapse spaces and trim
    s = re.sub(r"\s+", " ", s).strip()

    return s


# ---------------- DATE / CYCLES ----------------

def calculate_life_path(birthdate):
    """Calculate Life Path from YYYY-MM-DD"""
    digits = ''.join(c for c in birthdate if c.isdigit())
    total = sum(int(d) for d in digits)
    while total > 9 and total not in [11, 22, 33]:
        total = sum(int(d) for d in str(total))
    return total


def calculate_personal_year(birthdate, year):
    """Calculate Personal Year for given year"""
    month = int(birthdate.split('-')[1])
    day = int(birthdate.split('-')[2])
    total = month + day + sum(int(d) for d in str(year))
    while total > 9:
        total = sum(int(d) for d in str(total))
    return total


def calculate_personal_day(birthdate, date):
    """Calculate Personal Day for specific date"""
    py = calculate_personal_year(birthdate, date.year)
    month = date.month
    day_num = date.day
    total = py + month + day_num
    while total > 9:
        total = sum(int(d) for d in str(total))
    return total


def calculate_universal_year(year):
    """Calculate Universal Year"""
    total = sum(int(d) for d in str(year))
    while total > 9:
        total = sum(int(d) for d in str(total))
    return total


def calculate_universal_month(year, month):
    """Calculate Universal Month"""
    uy = calculate_universal_year(year)
    total = uy + month
    while total > 9:
        total = sum(int(d) for d in str(total))
    return total


def calculate_universal_day(year, month, day):
    """Calculate Universal Day"""
    um = calculate_universal_month(year, month)
    total = um + day
    while total > 9:
        total = sum(int(d) for d in str(total))
    return total


# ---------------- NAME NUMEROLOGY ----------------

def name_to_number(name: str):
    """Convert name to numerology number (accent-insensitive)."""
    name = normalize_name(name)

    chart = {
        'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8, 'I': 9,
        'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'O': 6, 'P': 7, 'Q': 8, 'R': 9,
        'S': 1, 'T': 2, 'U': 3, 'V': 4, 'W': 5, 'X': 6, 'Y': 7, 'Z': 8
    }

    total = sum(chart.get(c.upper(), 0) for c in name if c.isalpha())
    while total > 9 and total not in [11, 22, 33]:
        total = sum(int(d) for d in str(total))
    return total


def get_harmonious_groups():
    """Return harmonious number groups"""
    return [{1, 3, 5, 7, 9}, {2, 4, 6, 8}]


def numbers_compatible(n1, n2):
    """Check if two numbers are in harmonious group"""
    groups = get_harmonious_groups()
    for group in groups:
        if n1 in group and n2 in group:
            return True
    return False


# ---------------- SCORING ----------------

def calculate_match_score(athlete_profile, match_date):
    """
    Calculate numerology score for athlete on match date
    Returns: score (int), reasons (list)
    """
    score = 0
    reasons = []

    # Calculate match date cycles
    uy = calculate_universal_year(match_date.year)
    um = calculate_universal_month(match_date.year, match_date.month)
    ud = calculate_universal_day(match_date.year, match_date.month, match_date.day)

    # Calculate athlete cycles on match date
    py = calculate_personal_year(athlete_profile['birthdate'], match_date.year)
    pd = calculate_personal_day(athlete_profile['birthdate'], match_date)

    # Scoring logic
    if athlete_profile['life_path'] == uy:
        score += 10
        reasons.append(f"Life Path {athlete_profile['life_path']} matches Universal Year {uy} (+10)")

    if py == uy:
        score += 10
        reasons.append(f"Personal Year {py} matches Universal Year {uy} (+10)")

    if pd == ud:
        score += 5
        reasons.append(f"Personal Day {pd} matches Universal Day {ud} (+5)")

    if athlete_profile['expression'] == um:
        score += 5
        reasons.append(f"Expression {athlete_profile['expression']} matches Universal Month {um} (+5)")

    # Harmonious bonuses
    if numbers_compatible(athlete_profile['life_path'], uy):
        score += 3
        reasons.append(f"Life Path {athlete_profile['life_path']} harmonizes with Universal Year {uy} (+3)")

    if numbers_compatible(py, uy):
        score += 3
        reasons.append(f"Personal Year {py} harmonizes with Universal Year {uy} (+3)")

    return score, reasons


# ---------------- MAIN ANALYSIS ----------------

def analyze_match(player1_name, player1_birthdate, player2_name, player2_birthdate, match_date_str, sport="tennis"):
    """
    Main analysis function
    Returns structured result
    """
    match_date = datetime.strptime(match_date_str, '%Y-%m-%d')

    # Keep originals for display
    player1_name_original = (player1_name or "").strip()
    player2_name_original = (player2_name or "").strip()

    # Normalize for calculations
    player1_name_calc = normalize_name(player1_name_original)
    player2_name_calc = normalize_name(player2_name_original)

    # Build profiles (CALC names used for expression)
    player1 = {
        'name': player1_name_calc,
        'birthdate': player1_birthdate,
        'life_path': calculate_life_path(player1_birthdate),
        'expression': name_to_number(player1_name_calc),
    }

    player2 = {
        'name': player2_name_calc,
        'birthdate': player2_birthdate,
        'life_path': calculate_life_path(player2_birthdate),
        'expression': name_to_number(player2_name_calc),
    }

    # Calculate scores
    score1, reasons1 = calculate_match_score(player1, match_date)
    score2, reasons2 = calculate_match_score(player2, match_date)

    # Determine recommendation
    diff = abs(score1 - score2)

    if score1 > score2:
        winner = player1_name_original
        winner_score = score1
        loser_score = score2
    elif score2 > score1:
        winner = player2_name_original
        winner_score = score2
        loser_score = score1
    else:
        winner = "TIE"
        winner_score = score1
        loser_score = score2

    if diff >= 20:
        confidence = "STRONG"
        recommendation = f"Strong bet on {winner}"
        bet_size = "3-5% of bankroll"
    elif diff >= 10:
        confidence = "MODERATE"
        recommendation = f"Moderate bet on {winner}"
        bet_size = "1-2% of bankroll"
    else:
        confidence = "LOW"
        recommendation = "Avoid / No bet"
        bet_size = "Skip this match"

    return {
        "match_date": match_date_str,
        "sport": sport,
        "universal_year": calculate_universal_year(match_date.year),
        "universal_month": calculate_universal_month(match_date.year, match_date.month),
        "universal_day": calculate_universal_day(match_date.year, match_date.month, match_date.day),
        "player1": {
            "name": player1_name_original,   # display original (with accents)
            "life_path": player1['life_path'],
            "expression": player1['expression'],  # computed from normalized name
            "personal_year": calculate_personal_year(player1_birthdate, match_date.year),
            "score": score1,
            "reasons": reasons1
        },
        "player2": {
            "name": player2_name_original,   # display original (with accents)
            "life_path": player2['life_path'],
            "expression": player2['expression'],  # computed from normalized name
            "personal_year": calculate_personal_year(player2_birthdate, match_date.year),
            "score": score2,
            "reasons": reasons2
        },
        "winner_prediction": winner,
        "confidence": confidence,
        "score_difference": diff,
        "recommendation": recommendation,
        "bet_size": bet_size,
        "analysis_summary": f"{winner} has numerological advantage ({winner_score} vs {loser_score}) on {match_date_str}"
    }