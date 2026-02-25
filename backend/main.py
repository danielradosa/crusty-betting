from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List, Optional
import os
from collections import defaultdict

from database import create_tables, get_db, User, APIKey, DemoUsage, Player
from auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, get_api_key_user, generate_api_key, 
    check_rate_limit, log_usage
)
from numerology import analyze_match

def get_client_ip(req: Request) -> str:
    """Extract client IP from request"""
    # Try X-Forwarded-For first (for proxies/load balancers)
    forwarded = req.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    # Try X-Real-IP
    real_ip = req.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    # Fall back to direct connection
    if req.client:
        return req.client.host
    return "unknown"

def check_demo_rate_limit_db(client_ip: str, db: Session) -> tuple[bool, int, int, datetime]:
    """
    Check if client has exceeded demo rate limit using PostgreSQL
    Returns: (allowed, current_count, remaining, reset_time)
    """
    now = datetime.utcnow()
    
    # Get or create entry for this IP
    usage = db.query(DemoUsage).filter(DemoUsage.client_ip == client_ip).first()
    
    if not usage:
        # Create new entry
        reset_time = now + timedelta(days=1)
        usage = DemoUsage(
            client_ip=client_ip,
            count=0,
            reset_time=reset_time
        )
        db.add(usage)
        db.commit()
    
    # Reset if day has passed
    if now > usage.reset_time:
        usage.count = 0
        usage.reset_time = now + timedelta(days=1)
        db.commit()
    
    # Check limit (max 5 per day)
    if usage.count >= 5:
        return False, usage.count, 0, usage.reset_time
    
    # Increment count
    usage.count += 1
    usage.updated_at = now
    db.commit()
    
    remaining = 5 - usage.count
    
    return True, usage.count, remaining, usage.reset_time

# Create app
app = FastAPI(
    title="Sports Numerology API",
    description="Analyze sports matches using numerology principles",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    created_at: str
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class APIKeyCreate(BaseModel):
    name: Optional[str] = "Default Key"

class APIKeyResponse(BaseModel):
    id: int
    name: Optional[str]
    api_key: str
    created_at: str
    last_used: Optional[str]
    active: bool
    request_count: int
    
    class Config:
        from_attributes = True

class MatchAnalysisRequest(BaseModel):
    player1_name: str = Field(..., min_length=1, max_length=100)
    player1_birthdate: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    player2_name: str = Field(..., min_length=1, max_length=100)
    player2_birthdate: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    match_date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    sport: str = Field(default="tennis", pattern=r'^(tennis|table-tennis|boxing|mma|basketball|football)$')

class MatchAnalysisResponse(BaseModel):
    match_date: str
    sport: str
    universal_year: int
    universal_month: int
    universal_day: int
    player1: dict
    player2: dict
    winner_prediction: str
    confidence: str
    score_difference: int
    recommendation: str
    bet_size: str
    analysis_summary: str
    demo: Optional[bool] = None
    note: Optional[str] = None
    remaining_tries: Optional[int] = None
    used_today: Optional[int] = None

class DemoRequest(BaseModel):
    player1_name: str = Field(..., min_length=1, max_length=100)
    player1_birthdate: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    player2_name: str = Field(..., min_length=1, max_length=100)
    player2_birthdate: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    match_date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    sport: str = Field(default="tennis", pattern=r'^(tennis|table-tennis|boxing|mma|basketball|football)$')

# Startup event
@app.on_event("startup")
async def startup_event():
    try:
        create_tables()
        print("Database tables created successfully")
    except Exception as e:
        print(f"Warning: Database initialization error: {e}")
        # Continue anyway - might be first deploy

# Health check
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "sports-numerology-api",
        "version": "1.0.0",
        "frontend_path": frontend_path,
        "static_path": static_path,
        "frontend_exists": os.path.exists(frontend_path),
        "static_exists": os.path.exists(static_path)
    }

# Authentication endpoints
@app.post("/auth/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    try:
        # Check if user exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Debug logging
        print(f"Signup attempt for: {user_data.email}")
        print(f"Password length: {len(user_data.password)} chars, {len(user_data.password.encode('utf-8'))} bytes")
        
        # Create user
        try:
            hashed_password = get_password_hash(user_data.password)
            print(f"Password hashed successfully")
        except Exception as e:
            print(f"Password hash error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Password processing failed: {str(e)}"
            )
        
        new_user = User(
            email=user_data.email,
            password_hash=hashed_password
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create default API key
        api_key = generate_api_key()
        new_api_key = APIKey(
            user_id=new_user.id,
            api_key=api_key,
            name="Default Key"
        )
        db.add(new_api_key)
        db.commit()
        
        # Generate token
        access_token = create_access_token(data={"sub": new_user.email})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": new_user.id,
                "email": new_user.email,
                "created_at": new_user.created_at.isoformat()
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Signup error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@app.post("/auth/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "created_at": user.created_at.isoformat()
        }
    }

@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "created_at": current_user.created_at.isoformat()
    }

# API Key management endpoints
@app.post("/api-keys", response_model=APIKeyResponse)
def create_api_key(
    key_data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_key = generate_api_key()
    new_key = APIKey(
        user_id=current_user.id,
        api_key=api_key,
        name=key_data.name
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    return {
        "id": new_key.id,
        "name": new_key.name,
        "api_key": new_key.api_key,
        "created_at": new_key.created_at.isoformat(),
        "last_used": new_key.last_used.isoformat() if new_key.last_used else None,
        "active": new_key.active,
        "request_count": new_key.request_count
    }

@app.get("/api-keys", response_model=List[APIKeyResponse])
def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    keys = db.query(APIKey).filter(APIKey.user_id == current_user.id).all()
    return [
        {
            "id": key.id,
            "name": key.name,
            "api_key": key.api_key[:8] + "..." + key.api_key[-4:] if len(key.api_key) > 12 else key.api_key,
            "created_at": key.created_at.isoformat(),
            "last_used": key.last_used.isoformat() if key.last_used else None,
            "active": key.active,
            "request_count": key.request_count
        }
        for key in keys
    ]

@app.delete("/api-keys/{key_id}")
def delete_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.user_id == current_user.id
    ).first()
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    db.delete(key)
    db.commit()
    
    return {"message": "API key deleted successfully"}

@app.post("/api-keys/{key_id}/revoke")
def revoke_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.user_id == current_user.id
    ).first()
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    key.active = False
    db.commit()
    
    return {"message": "API key revoked successfully"}

# Protected API endpoint
@app.post("/api/v1/analyze-match", response_model=MatchAnalysisResponse)
def analyze_match_endpoint(
    request: MatchAnalysisRequest,
    current_user: User = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    # Check rate limit
    check_rate_limit(current_user.id, db)
    
    try:
        result = analyze_match(
            player1_name=request.player1_name,
            player1_birthdate=request.player1_birthdate,
            player2_name=request.player2_name,
            player2_birthdate=request.player2_birthdate,
            match_date_str=request.match_date,
            sport=request.sport
        )
        
        # Log successful usage
        log_usage(
            user_id=current_user.id,
            endpoint="/api/v1/analyze-match",
            success=True,
            db=db
        )
        
        return result
        
    except Exception as e:
        # Log failed usage
        log_usage(
            user_id=current_user.id,
            endpoint="/api/v1/analyze-match",
            success=False,
            error_message=str(e),
            db=db
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )

# Demo endpoint (no auth required, max 5 per IP per day)
@app.post("/api/v1/demo-analyze")
def demo_analyze(request: DemoRequest, req: Request, db: Session = Depends(get_db)):
    """Demo endpoint - max 5 uses per IP per day"""
    # Get client IP
    client_ip = get_client_ip(req)
    
    # Check rate limit using database
    allowed, count, remaining, reset_time = check_demo_rate_limit_db(client_ip, db)
    
    if not allowed:
        # Calculate time until reset
        now = datetime.utcnow()
        time_until_reset = reset_time - now
        hours = int(time_until_reset.total_seconds() // 3600)
        minutes = int((time_until_reset.total_seconds() % 3600) // 60)
        
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Demo limit reached (5 per day).",
                "reset_in_hours": hours,
                "reset_in_minutes": minutes,
                "reset_time": reset_time.isoformat(),
                "suggestion": "Sign up for unlimited access."
            }
        )
    
    try:
        result = analyze_match(
            player1_name=request.player1_name,
            player1_birthdate=request.player1_birthdate,
            player2_name=request.player2_name,
            player2_birthdate=request.player2_birthdate,
            match_date_str=request.match_date,
            sport=request.sport
        )
        # Add disclaimer for demo
        result["demo"] = True
        result["note"] = f"This is a demo ({remaining} free tries remaining today). Sign up for unlimited access."
        result["remaining_tries"] = remaining
        result["used_today"] = count
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )

# Check demo rate limit status (no auth required)
@app.get("/api/v1/demo-status")
def demo_status(req: Request, db: Session = Depends(get_db)):
    """Check current demo rate limit status for this IP"""
    client_ip = get_client_ip(req)
    
    usage = db.query(DemoUsage).filter(DemoUsage.client_ip == client_ip).first()
    now = datetime.utcnow()
    
    if not usage:
        return {
            "used": 0,
            "remaining": 5,
            "limit": 5,
            "reset_time": (now + timedelta(days=1)).isoformat(),
            "limited": False
        }
    
    # Reset if day has passed
    if now > usage.reset_time:
        return {
            "used": 0,
            "remaining": 5,
            "limit": 5,
            "reset_time": (now + timedelta(days=1)).isoformat(),
            "limited": False
        }
    
    remaining = max(0, 5 - usage.count)
    limited = usage.count >= 5
    
    # Calculate time until reset
    time_until_reset = usage.reset_time - now
    hours = int(time_until_reset.total_seconds() // 3600)
    minutes = int((time_until_reset.total_seconds() % 3600) // 60)
    
    return {
        "used": usage.count,
        "remaining": remaining,
        "limit": 5,
        "reset_time": usage.reset_time.isoformat(),
        "reset_in_hours": hours,
        "reset_in_minutes": minutes,
        "limited": limited
    }

# Get user usage statistics
@app.get("/api/v1/usage-stats")
def get_usage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get real usage statistics for the authenticated user"""
    from datetime import date
    
    now = datetime.utcnow()
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    # This month
    month_start = datetime.combine(today.replace(day=1), datetime.min.time())
    
    # Count requests
    today_count = db.query(UsageLog).filter(
        UsageLog.user_id == current_user.id,
        UsageLog.timestamp >= today_start,
        UsageLog.timestamp <= today_end,
        UsageLog.success == True
    ).count()
    
    month_count = db.query(UsageLog).filter(
        UsageLog.user_id == current_user.id,
        UsageLog.timestamp >= month_start,
        UsageLog.timestamp <= today_end,
        UsageLog.success == True
    ).count()
    
    total_count = db.query(UsageLog).filter(
        UsageLog.user_id == current_user.id,
        UsageLog.success == True
    ).count()
    
    return {
        "today": today_count,
        "this_month": month_count,
        "total": total_count,
        "limit": 10,
        "reset_time": today_end.isoformat()
    }

# Player database endpoints
@app.get("/api/v1/players")
def search_players(
    q: str = "",
    sport: str = "",
    db: Session = Depends(get_db)
):
    """Search players by name (autocomplete)"""
    query = db.query(Player)
    
    if q:
        query = query.filter(Player.name.ilike(f"%{q}%"))
    
    if sport:
        query = query.filter(Player.sport == sport)
    
    players = query.limit(10).all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "birthdate": p.birthdate,
            "sport": p.sport,
            "country": p.country
        }
        for p in players
    ]

@app.get("/api/v1/players/{player_id}")
def get_player(player_id: int, db: Session = Depends(get_db)):
    """Get a specific player by ID"""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    return {
        "id": player.id,
        "name": player.name,
        "birthdate": player.birthdate,
        "sport": player.sport,
        "country": player.country
    }

# Seed players data (run once)
@app.post("/admin/seed-players")
def seed_players(db: Session = Depends(get_db)):
    """Seed initial player database (tennis and table tennis)"""
    # Check if already seeded
    existing = db.query(Player).first()
    if existing:
        return {"message": "Already seeded", "count": db.query(Player).count()}
    
    players = [
        # Tennis - ATP Top 100 + more
        {"name": "Novak Djokovic", "birthdate": "1987-05-22", "sport": "tennis", "country": "Serbia"},
        {"name": "Carlos Alcaraz", "birthdate": "2003-05-05", "sport": "tennis", "country": "Spain"},
        {"name": "Jannik Sinner", "birthdate": "2001-08-16", "sport": "tennis", "country": "Italy"},
        {"name": "Daniil Medvedev", "birthdate": "1996-02-11", "sport": "tennis", "country": "Russia"},
        {"name": "Alexander Zverev", "birthdate": "1997-04-20", "sport": "tennis", "country": "Germany"},
        {"name": "Rafael Nadal", "birthdate": "1986-06-03", "sport": "tennis", "country": "Spain"},
        {"name": "Andrey Rublev", "birthdate": "1997-10-20", "sport": "tennis", "country": "Russia"},
        {"name": "Holger Rune", "birthdate": "2003-04-29", "sport": "tennis", "country": "Denmark"},
        {"name": "Hubert Hurkacz", "birthdate": "1997-02-11", "sport": "tennis", "country": "Poland"},
        {"name": "Casper Ruud", "birthdate": "1998-12-22", "sport": "tennis", "country": "Norway"},
        {"name": "Stefanos Tsitsipas", "birthdate": "1998-08-12", "sport": "tennis", "country": "Greece"},
        {"name": "Taylor Fritz", "birthdate": "1997-10-28", "sport": "tennis", "country": "USA"},
        {"name": "Grigor Dimitrov", "birthdate": "1991-05-16", "sport": "tennis", "country": "Bulgaria"},
        {"name": "Tommy Paul", "birthdate": "1997-05-17", "sport": "tennis", "country": "USA"},
        {"name": "Karen Khachanov", "birthdate": "1996-05-21", "sport": "tennis", "country": "Russia"},
        {"name": "Ben Shelton", "birthdate": "2002-10-09", "sport": "tennis", "country": "USA"},
        {"name": "Frances Tiafoe", "birthdate": "1998-01-20", "sport": "tennis", "country": "USA"},
        {"name": "Frances Tiafoe", "birthdate": "1998-01-20", "sport": "tennis", "country": "USA"},
        {"name": "Felix Auger-Aliassime", "birthdate": "2000-08-08", "sport": "tennis", "country": "Canada"},
        {"name": "Ugo Humbert", "birthdate": "1998-06-26", "sport": "tennis", "country": "France"},
        {"name": "Sebastian Korda", "birthdate": "2000-07-05", "sport": "tennis", "country": "USA"},
        {"name": "Adrian Mannarino", "birthdate": "1988-06-29", "sport": "tennis", "country": "France"},
        {"name": "Nicolas Jarry", "birthdate": "1995-10-11", "sport": "tennis", "country": "Chile"},
        {"name": "Tallon Griekspoor", "birthdate": "1996-07-02", "sport": "tennis", "country": "Netherlands"},
        {"name": "Lorenzo Musetti", "birthdate": "2002-03-03", "sport": "tennis", "country": "Italy"},
        {"name": "Francisco Cerundolo", "birthdate": "1998-08-12", "sport": "tennis", "country": "Argentina"},
        {"name": "Alejandro Davidovich Fokina", "birthdate": "1999-06-05", "sport": "tennis", "country": "Spain"},
        {"name": "Jordan Thompson", "birthdate": "1994-04-20", "sport": "tennis", "country": "Australia"},
        {"name": "Jiri Lehecka", "birthdate": "2001-11-08", "sport": "tennis", "country": "Czech Republic"},
        {"name": "Sebastian Baez", "birthdate": "2001-12-28", "sport": "tennis", "country": "Argentina"},
        {"name": "Roman Safiullin", "birthdate": "1997-08-07", "sport": "tennis", "country": "Russia"},
        {"name": "Gael Monfils", "birthdate": "1986-09-01", "sport": "tennis", "country": "France"},
        {"name": "Valentin Vacherot", "birthdate": "1996-04-05", "sport": "tennis", "country": "Monaco"},
        {"name": "Kei Nishikori", "birthdate": "1989-12-29", "sport": "tennis", "country": "Japan"},
        {"name": "Milos Raonic", "birthdate": "1990-12-27", "sport": "tennis", "country": "Canada"},
        {"name": "Denis Shapovalov", "birthdate": "1999-04-15", "sport": "tennis", "country": "Canada"},
        {"name": "Roberto Bautista Agut", "birthdate": "1988-04-14", "sport": "tennis", "country": "Spain"},
        {"name": "Marcos Giron", "birthdate": "1993-07-24", "sport": "tennis", "country": "USA"},
        {"name": "Christopher Eubanks", "birthdate": "1996-05-05", "sport": "tennis", "country": "USA"},
        {"name": "Mackenzie McDonald", "birthdate": "1995-04-16", "sport": "tennis", "country": "USA"},
        {"name": "Arthur Fils", "birthdate": "2004-06-12", "sport": "tennis", "country": "France"},
        {"name": "Giovanni Mpetshi Perricard", "birthdate": "2003-07-08", "sport": "tennis", "country": "France"},
        
        # Tennis - WTA Top Players
        {"name": "Iga Swiatek", "birthdate": "2001-05-31", "sport": "tennis", "country": "Poland"},
        {"name": "Aryna Sabalenka", "birthdate": "1998-05-05", "sport": "tennis", "country": "Belarus"},
        {"name": "Coco Gauff", "birthdate": "2004-03-13", "sport": "tennis", "country": "USA"},
        {"name": "Elena Rybakina", "birthdate": "1999-06-17", "sport": "tennis", "country": "Kazakhstan"},
        {"name": "Jessica Pegula", "birthdate": "1994-02-24", "sport": "tennis", "country": "USA"},
        {"name": "Marketa Vondrousova", "birthdate": "1999-06-28", "sport": "tennis", "country": "Czech Republic"},
        {"name": "Maria Sakkari", "birthdate": "1995-07-25", "sport": "tennis", "country": "Greece"},
        {"name": "Ons Jabeur", "birthdate": "1994-08-28", "sport": "tennis", "country": "Tunisia"},
        {"name": "Barbora Krejcikova", "birthdate": "1995-12-18", "sport": "tennis", "country": "Czech Republic"},
        {"name": "Jelena Ostapenko", "birthdate": "1997-06-08", "sport": "tennis", "country": "Latvia"},
        {"name": "Beatriz Haddad Maia", "birthdate": "1996-05-30", "sport": "tennis", "country": "Brazil"},
        {"name": "Liudmila Samsonova", "birthdate": "1998-11-11", "sport": "tennis", "country": "Russia"},
        {"name": "Victoria Azarenka", "birthdate": "1989-07-31", "sport": "tennis", "country": "Belarus"},
        {"name": "Veronika Kudermetova", "birthdate": "1997-04-24", "sport": "tennis", "country": "Russia"},
        {"name": "Petra Kvitova", "birthdate": "1990-03-08", "sport": "tennis", "country": "Czech Republic"},
        {"name": "Elina Svitolina", "birthdate": "1994-09-12", "sport": "tennis", "country": "Ukraine"},
        {"name": "Anastasia Pavlyuchenkova", "birthdate": "1991-07-03", "sport": "tennis", "country": "Russia"},
        {"name": "Donna Vekic", "birthdate": "1996-06-28", "sport": "tennis", "country": "Croatia"},
        {"name": "Linda Noskova", "birthdate": "2004-11-17", "sport": "tennis", "country": "Czech Republic"},
        {"name": "Martina Trevisan", "birthdate": "1993-11-03", "sport": "tennis", "country": "Italy"},
        {"name": "Elise Mertens", "birthdate": "1994-11-17", "sport": "tennis", "country": "Belgium"},
        {"name": "Karolina Muchova", "birthdate": "1996-08-21", "sport": "tennis", "country": "Czech Republic"},
        {"name": "Madison Keys", "birthdate": "1995-02-17", "sport": "tennis", "country": "USA"},
        {"name": " Danielle Collins", "birthdate": "1993-12-13", "sport": "tennis", "country": "USA"},
        {"name": "Qinwen Zheng", "birthdate": "2002-10-08", "sport": "tennis", "country": "China"},
        {"name": "Anna Kalinskaya", "birthdate": "1998-12-02", "sport": "tennis", "country": "Russia"},
        {"name": "Sorana Cirstea", "birthdate": "1990-04-07", "sport": "tennis", "country": "Romania"},
        {"name": "Anhelina Kalinina", "birthdate": "1997-02-07", "sport": "tennis", "country": "Ukraine"},
        {"name": "Varvara Gracheva", "birthdate": "2000-08-02", "sport": "tennis", "country": "France"},
        {"name": "Mirra Andreeva", "birthdate": "2007-04-29", "sport": "tennis", "country": "Russia"},
        
        # Table Tennis - Men's Top 100
        {"name": "Fan Zhendong", "birthdate": "1997-01-22", "sport": "table-tennis", "country": "China"},
        {"name": "Ma Long", "birthdate": "1988-10-20", "sport": "table-tennis", "country": "China"},
        {"name": "Wang Chuqin", "birthdate": "2000-05-11", "sport": "table-tennis", "country": "China"},
        {"name": "Tomokazu Harimoto", "birthdate": "2003-06-27", "sport": "table-tennis", "country": "Japan"},
        {"name": "Lin Shidong", "birthdate": "2005-04-20", "sport": "table-tennis", "country": "China"},
        {"name": "Liang Jingkun", "birthdate": "1996-10-20", "sport": "table-tennis", "country": "China"},
        {"name": "Hugo Calderano", "birthdate": "1996-06-22", "sport": "table-tennis", "country": "Brazil"},
        {"name": "Felix Lebrun", "birthdate": "2006-09-12", "sport": "table-tennis", "country": "France"},
        {"name": "Alexis Lebrun", "birthdate": "2003-08-27", "sport": "table-tennis", "country": "France"},
        {"name": "Dimitrij Ovtcharov", "birthdate": "1988-09-02", "sport": "table-tennis", "country": "Germany"},
        {"name": "Lin Gaoyuan", "birthdate": "1995-03-19", "sport": "table-tennis", "country": "China"},
        {"name": "Darko Jorgic", "birthdate": "1998-07-30", "sport": "table-tennis", "country": "Slovenia"},
        {"name": "Truls Moregard", "birthdate": "2002-02-16", "sport": "table-tennis", "country": "Sweden"},
        {"name": "Patrick Franziska", "birthdate": "1992-06-11", "sport": "table-tennis", "country": "Germany"},
        {"name": "Quadri Aruna", "birthdate": "1988-08-09", "sport": "table-tennis", "country": "Nigeria"},
        {"name": "Marcos Freitas", "birthdate": "1986-04-08", "sport": "table-tennis", "country": "Portugal"},
        {"name": "Anton Kallberg", "birthdate": "1997-08-16", "sport": "table-tennis", "country": "Sweden"},
        {"name": "Omar Assar", "birthdate": "1991-07-22", "sport": "table-tennis", "country": "Egypt"},
        {"name": "Simon Gauzy", "birthdate": "1994-10-25", "sport": "table-tennis", "country": "France"},
        {"name": "Kristian Karlsson", "birthdate": "1991-08-06", "sport": "table-tennis", "country": "Sweden"},
        {"name": "Mattias Falck", "birthdate": "1991-09-07", "sport": "table-tennis", "country": "Sweden"},
        {"name": "Jonathan Groth", "birthdate": "1992-11-07", "sport": "table-tennis", "country": "Denmark"},
        {"name": "Liam Pitchford", "birthdate": "1993-07-12", "sport": "table-tennis", "country": "England"},
        {"name": "Andrej Gacina", "birthdate": "1986-05-21", "sport": "table-tennis", "country": "Croatia"},
        {"name": "Wong Chun Ting", "birthdate": "1991-09-28", "sport": "table-tennis", "country": "Hong Kong"},
        {"name": "Ho Kwan Kit", "birthdate": "1997-04-20", "sport": "table-tennis", "country": "Hong Kong"},
        {"name": "Lee Sang Su", "birthdate": "1990-08-13", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Jang Woojin", "birthdate": "1995-09-10", "sport": "table-tennis", "country": "South Korea"},
        {"name": "An Jaehyun", "birthdate": "1999-12-25", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Cho Seungmin", "birthdate": "1998-08-21", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Lim Jonghoon", "birthdate": "1997-01-22", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Chuang Chih-Yuan", "birthdate": "1981-04-02", "sport": "table-tennis", "country": "Taiwan"},
        {"name": "Lin Yun-Ju", "birthdate": "2001-08-17", "sport": "table-tennis", "country": "Taiwan"},
        {"name": "Kao Cheng-Jui", "birthdate": "2000-06-14", "sport": "table-tennis", "country": "Taiwan"},
        {"name": "Yoshimura Maharu", "birthdate": "1993-08-03", "sport": "table-tennis", "country": "Japan"},
        {"name": "Niwa Koki", "birthdate": "1994-12-10", "sport": "table-tennis", "country": "Japan"},
        {"name": "Mizutani Jun", "birthdate": "1989-06-09", "sport": "table-tennis", "country": "Japan"},
        {"name": "Togami Shunsuke", "birthdate": "2001-08-24", "sport": "table-tennis", "country": "Japan"},
        {"name": "Sato Hiromi", "birthdate": "2001-10-04", "sport": "table-tennis", "country": "Japan"},
        {"name": "Oikawa Mizuki", "birthdate": "1996-04-22", "sport": "table-tennis", "country": "Japan"},
        {"name": "Kizukuri Yuto", "birthdate": "2000-08-22", "sport": "table-tennis", "country": "Japan"},
        {"name": "Uda Yukiya", "birthdate": "2001-11-02", "sport": "table-tennis", "country": "Japan"},
        {"name": "Yoshiyama Ryoichi", "birthdate": "2004-03-14", "sport": "table-tennis", "country": "Japan"},
        {"name": "Ishiyama Takuto", "birthdate": "1996-10-21", "sport": "table-tennis", "country": "Japan"},
        
        # Table Tennis - Women's Top 100
        {"name": "Sun Yingsha", "birthdate": "2000-11-04", "sport": "table-tennis", "country": "China"},
        {"name": "Chen Meng", "birthdate": "1994-01-15", "sport": "table-tennis", "country": "China"},
        {"name": "Wang Manyu", "birthdate": "1999-02-09", "sport": "table-tennis", "country": "China"},
        {"name": "Wang Yidi", "birthdate": "1997-02-14", "sport": "table-tennis", "country": "China"},
        {"name": "Chen Xingtong", "birthdate": "1997-05-27", "sport": "table-tennis", "country": "China"},
        {"name": "Qian Tianyi", "birthdate": "2000-01-23", "sport": "table-tennis", "country": "China"},
        {"name": "Zhang Rui", "birthdate": "1997-01-23", "sport": "table-tennis", "country": "China"},
        {"name": "Kuai Man", "birthdate": "2004-02-07", "sport": "table-tennis", "country": "China"},
        {"name": "He Zhuojia", "birthdate": "1998-10-23", "sport": "table-tennis", "country": "China"},
        {"name": "Shi Xunyao", "birthdate": "2001-09-17", "sport": "table-tennis", "country": "China"},
        {"name": "Fan Siqi", "birthdate": "1999-12-21", "sport": "table-tennis", "country": "China"},
        {"name": "Liu Weishan", "birthdate": "1999-03-10", "sport": "table-tennis", "country": "China"},
        {"name": "Mima Ito", "birthdate": "2000-10-21", "sport": "table-tennis", "country": "Japan"},
        {"name": "Hina Hayata", "birthdate": "2000-07-07", "sport": "table-tennis", "country": "Japan"},
        {"name": "Miu Hirano", "birthdate": "2000-04-14", "sport": "table-tennis", "country": "Japan"},
        {"name": "Kasumi Ishikawa", "birthdate": "1993-02-23", "sport": "table-tennis", "country": "Japan"},
        {"name": "Sakura Mori", "birthdate": "1996-04-10", "sport": "table-tennis", "country": "Japan"},
        {"name": "Saki Shibata", "birthdate": "1997-06-05", "sport": "table-tennis", "country": "Japan"},
        {"name": "Hitomi Sato", "birthdate": "1997-04-18", "sport": "table-tennis", "country": "Japan"},
        {"name": "Miyu Kato", "birthdate": "1999-04-14", "sport": "table-tennis", "country": "Japan"},
        {"name": "Jeoung Youngsik", "birthdate": "1992-01-20", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Shin Yubin", "birthdate": "2004-07-05", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Jeon Jihee", "birthdate": "1992-10-28", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Choi Hyojoo", "birthdate": "1998-06-11", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Lee ZIon", "birthdate": "1995-12-14", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Yang Haeun", "birthdate": "1994-02-25", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Kim Hayeong", "birthdate": "2003-09-12", "sport": "table-tennis", "country": "South Korea"},
        {"name": "Cheng I-Ching", "birthdate": "1992-02-15", "sport": "table-tennis", "country": "Taiwan"},
        {"name": "Chen Szu-Yu", "birthdate": "1997-08-01", "sport": "table-tennis", "country": "Taiwan"},
        {"name": "Cheng Hsien-Tzu", "birthdate": "1993-09-29", "sport": "table-tennis", "country": "Taiwan"},
        {"name": "Liu Hsing-Yin", "birthdate": "1992-10-06", "sport": "table-tennis", "country": "Taiwan"},
        {"name": "Lee Ho Ching", "birthdate": "1992-11-24", "sport": "table-tennis", "country": "Hong Kong"},
        {"name": "Doo Hoi Kem", "birthdate": "1996-11-27", "sport": "table-tennis", "country": "Hong Kong"},
        {"name": "Ng Wing Nam", "birthdate": "1992-08-17", "sport": "table-tennis", "country": "Hong Kong"},
        {"name": "Zhu Chengzhu", "birthdate": "1997-07-31", "sport": "table-tennis", "country": "Hong Kong"},
        {"name": "Soo Wai Yam Minnie", "birthdate": "1998-06-17", "sport": "table-tennis", "country": "Hong Kong"},
        {"name": "Liu Jia", "birthdate": "1982-02-09", "sport": "table-tennis", "country": "Austria"},
        {"name": "Sofia Polcanova", "birthdate": "1994-09-03", "sport": "table-tennis", "country": "Austria"},
        {"name": "Han Ying", "birthdate": "1983-04-29", "sport": "table-tennis", "country": "Germany"},
        {"name": "Nina Mittelham", "birthdate": "1996-11-23", "sport": "table-tennis", "country": "Germany"},
        {"name": "Sabine Winter", "birthdate": "1992-09-27", "sport": "table-tennis", "country": "Germany"},
        {"name": "Petrissa Solja", "birthdate": "1994-03-11", "sport": "table-tennis", "country": "Germany"},
        {"name": "Shan Xiaona", "birthdate": "1989-02-12", "sport": "table-tennis", "country": "Germany"},
        {"name": "Yuan Wan", "birthdate": "1997-11-23", "sport": "table-tennis", "country": "Germany"},
        {"name": "Bernadette Szocs", "birthdate": "1995-03-05", "sport": "table-tennis", "country": "Romania"},
        {"name": "Elizabeta Samara", "birthdate": "1989-04-15", "sport": "table-tennis", "country": "Romania"},
        {"name": "Daniela Dodean", "birthdate": "1988-01-13", "sport": "table-tennis", "country": "Romania"},
        {"name": "Ivor Martina Ema", "birthdate": "1995-06-05", "sport": "table-tennis", "country": "Romania"},
        {"name": "Georgina Pota", "birthdate": "1985-01-13", "sport": "table-tennis", "country": "Hungary"},
        {"name": "Dora Madarasz", "birthdate": "1993-03-03", "sport": "table-tennis", "country": "Hungary"},
        {"name": "Maria Dolgikh", "birthdate": "1989-03-24", "sport": "table-tennis", "country": "Russia"},
        {"name": "Polina Mikhailova", "birthdate": "1986-08-31", "sport": "table-tennis", "country": "Russia"},
        {"name": "Yana Noskova", "birthdate": "1996-09-18", "sport": "table-tennis", "country": "Russia"},
        {"name": "Valeria Shcherbatykh", "birthdate": "1996-05-01", "sport": "table-tennis", "country": "Russia"},
        {"name": "Olga Vorobeva", "birthdate": "1990-05-05", "sport": "table-tennis", "country": "Russia"},
        {"name": "Sun Yingsha", "birthdate": "2000-11-04", "sport": "table-tennis", "country": "China"},
        {"name": "Chen Meng", "birthdate": "1994-01-15", "sport": "table-tennis", "country": "China"},
        {"name": "Wang Manyu", "birthdate": "1999-02-09", "sport": "table-tennis", "country": "China"},
        {"name": "Mima Ito", "birthdate": "2000-10-21", "sport": "table-tennis", "country": "Japan"},
        {"name": "Hina Hayata", "birthdate": "2000-07-07", "sport": "table-tennis", "country": "Japan"},
    ]
    
    for p in players:
        player = Player(**p)
        db.add(player)
    
    db.commit()
    
    return {"message": "Players seeded successfully", "count": len(players)}

# Static files and frontend
# Handle both local dev and Docker container paths
base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_path = os.path.join(base_path, "frontend")
static_path = os.path.join(base_path, "static")

# Fallback for Railway deployment structure
if not os.path.exists(frontend_path):
    frontend_path = "/app/frontend"
if not os.path.exists(static_path):
    static_path = "/app/static"

# Mount static files
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")
    print(f"Static files mounted from: {static_path}")
else:
    print(f"Warning: Static path not found: {static_path}")

@app.get("/")
def serve_landing():
    try:
        return FileResponse(os.path.join(frontend_path, "index.html"))
    except Exception as e:
        print(f"Error serving index.html: {e}")
        return {"message": "Sports Numerology API", "status": "running", "frontend_path": frontend_path}

@app.get("/dashboard")
def serve_dashboard():
    try:
        return FileResponse(os.path.join(frontend_path, "dashboard.html"))
    except Exception as e:
        print(f"Error serving dashboard.html: {e}")
        return {"error": "Dashboard not available", "path": frontend_path}

@app.get("/login")
def serve_login():
    try:
        return FileResponse(os.path.join(frontend_path, "login.html"))
    except Exception as e:
        print(f"Error serving login.html: {e}")
        return {"error": "Login page not available", "path": frontend_path}

@app.get("/signup")
def serve_signup():
    try:
        return FileResponse(os.path.join(frontend_path, "signup.html"))
    except Exception as e:
        print(f"Error serving signup.html: {e}")
        return {"error": "Signup page not available", "path": frontend_path}

# Also serve .html versions for direct links
@app.get("/login.html")
def serve_login_html():
    return serve_login()

@app.get("/signup.html")
def serve_signup_html():
    return serve_signup()

@app.get("/dashboard.html")
def serve_dashboard_html():
    return serve_dashboard()

@app.get("/index.html")
def serve_index_html():
    return serve_landing()

@app.get("/docs")
def serve_docs():
    return FileResponse(os.path.join(frontend_path, "docs.html"))

# Railway provides PORT env var, fallback to 8000
port = int(os.getenv("PORT", 8000))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=port)
