import os
import re
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import psycopg2.extras
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr

from db import get_connection

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 7

router = APIRouter(prefix="/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    hiker_experience: str = "beginner"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    user_id = int(payload["sub"])

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT user_id, first_name, last_name, username, email, hiker_experience, role "
        "FROM users WHERE user_id = %s",
        (user_id,),
    )
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")

    return dict(user)


def generate_username(cursor, email: str) -> str:
    """Derive a unique username from the email local part.

    Signup does not ask for a username, but invitations can be addressed to
    one, so every account needs a stable handle.
    """
    base = re.sub(r"[^a-z0-9._-]", "", email.split("@")[0].lower()) or "hiker"
    base = base[:40]
    candidate = base
    suffix = 1
    while True:
        cursor.execute("SELECT 1 FROM users WHERE LOWER(username) = %s", (candidate,))
        if not cursor.fetchone():
            return candidate
        suffix += 1
        candidate = f"{base}{suffix}"


@router.post("/signup")
def signup(payload: SignupRequest):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cursor.execute("SELECT user_id FROM users WHERE email = %s", (payload.email,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    hashed = hash_password(payload.password)
    username = generate_username(cursor, payload.email)
    cursor.execute(
        """
        INSERT INTO users (first_name, last_name, username, email, password, hiker_experience)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING user_id, first_name, last_name, username, email, hiker_experience, role
        """,
        (
            payload.first_name,
            payload.last_name,
            username,
            payload.email,
            hashed,
            payload.hiker_experience,
        ),
    )
    user = dict(cursor.fetchone())
    conn.commit()
    cursor.close()
    conn.close()

    token = create_token(user["user_id"])
    return {"token": token, "user": user}


@router.post("/login")
def login(payload: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT user_id, first_name, last_name, username, email, hiker_experience, role, password "
        "FROM users WHERE email = %s",
        (payload.email,),
    )
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    user = dict(user)
    del user["password"]

    token = create_token(user["user_id"])
    return {"token": token, "user": user}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user
