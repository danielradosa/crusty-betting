# 🔮 Sports Numerology API

A complete web service that exposes sports numerology analysis via REST API, with user authentication and API key management.

## Features

- **Numerology Analysis**: Calculate Life Path, Personal Year, Universal Cycles, and Name Expression numbers
- **Match Prediction**: Analyze 1:1 sports matches to predict winners with confidence scores
- **Authentication**: JWT-based web sessions and API key authentication
- **Rate Limiting**: 10 requests/day free tier with usage tracking
- **Dashboard**: Web interface to manage API keys and test the API

## Quick Start

### Prerequisites

- Python 3.8+
- pip

### Installation

1. Clone or navigate to the project:
```bash
cd sports-numerology-api
```

2. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

3. Run the server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/signup` | POST | Create account |
| `/auth/login` | POST | Login |
| `/auth/me` | GET | Get current user |

### API Key Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api-keys` | GET | List API keys |
| `/api-keys` | POST | Create new key |
| `/api-keys/{id}` | DELETE | Delete key |
| `/api-keys/{id}/revoke` | POST | Revoke key |

### Analysis

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/demo-analyze` | POST | None | Demo analysis |
| `/api/v1/analyze-match` | POST | API Key | Full analysis |

## Usage Examples

### Create Account
```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Analyze Match
```bash
curl -X POST http://localhost:8000/api/v1/analyze-match \
  -H "X-API-Key: sn_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "player1_name": "Novak Djokovic",
    "player1_birthdate": "1987-05-22",
    "player2_name": "Carlos Alcaraz",
    "player2_birthdate": "2003-05-05",
    "match_date": "2024-07-14",
    "sport": "tennis"
  }'
```

### Response
```json
{
  "match_date": "2024-07-14",
  "sport": "tennis",
  "universal_year": 8,
  "universal_month": 6,
  "universal_day": 5,
  "player1": {
    "name": "Novak Djokovic",
    "life_path": 7,
    "expression": 4,
    "personal_year": 5,
    "score": 12,
    "reasons": [...]
  },
  "player2": {
    "name": "Carlos Alcaraz",
    "life_path": 4,
    "expression": 9,
    "personal_year": 3,
    "score": 27,
    "reasons": [...]
  },
  "winner_prediction": "Carlos Alcaraz",
  "confidence": "MODERATE",
  "score_difference": 15,
  "recommendation": "Moderate bet on Carlos Alcaraz",
  "bet_size": "1-2% of bankroll",
  "analysis_summary": "..."
}
```

## Web Interface

- **Landing Page**: `http://localhost:8000/` - Try the demo
- **Sign Up**: `http://localhost:8000/signup`
- **Login**: `http://localhost:8000/login`
- **Dashboard**: `http://localhost:8000/dashboard` - Manage API keys

## Docker Deployment

### Using Docker

```bash
# Build image
docker build -t sports-numerology-api .

# Run container
docker run -p 8000:8000 sports-numerology-api
```

### Using Docker Compose

```bash
docker-compose up -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `sqlite:///./sports_numerology.db` |
| `SECRET_KEY` | JWT signing key | Auto-generated |

## Project Structure

```
sports-numerology-api/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── database.py       # SQLAlchemy models
│   ├── auth.py           # Authentication logic
│   ├── numerology.py     # Core numerology calculations
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── index.html        # Landing page
│   ├── login.html        # Login page
│   ├── signup.html       # Sign up page
│   ├── dashboard.html    # User dashboard
│   └── styles.css        # Styles (in static/)
├── static/
│   └── styles.css        # Main stylesheet
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose config
└── README.md             # This file
```

## Numerology Methodology

The analysis uses established numerology principles:

1. **Life Path Number**: Derived from birthdate, represents core personality
2. **Expression Number**: Derived from full name, represents talents/abilities
3. **Personal Year**: Current year cycle based on birthdate
4. **Universal Cycles**: Global energy patterns for specific dates

Scoring considers:
- Direct matches between player cycles and universal cycles (+10 points)
- Harmonious number group alignment (+3 points)
- Personal day alignment (+5 points)

## Sports Supported

- Tennis
- Table Tennis
- Boxing
- MMA
- Basketball
- Football

## License

MIT License

## Disclaimer

This tool is for entertainment purposes only. Sports betting involves risk. Please gamble responsibly.
