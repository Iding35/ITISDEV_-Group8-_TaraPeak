from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_connection():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5432"),
        dbname=os.environ.get("PGDATABASE", "tarapeak"),
        user=os.environ.get("PGUSER", "postgres"),
        password=os.environ.get("PGPASSWORD", "postgres"),
    )

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT to_regclass('public.mountains')")
    already_initialized = cursor.fetchone()[0] is not None
    if not already_initialized:
        with open('tarapeak.sql', 'r') as f:
            cursor.execute(f.read())
        conn.commit()
    cursor.close()
    conn.close()

# Initialize DB on startup if missing
init_db()

@app.get("/get")
def get_mountains(search: str = Query(None)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if search:
        query = "SELECT * FROM mountains WHERE mountain_name = %s"
        cursor.execute(query, (search,))
    else:
        cursor.execute("SELECT * FROM mountains")

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
