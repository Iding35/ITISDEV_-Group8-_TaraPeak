from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = 'tarapeak.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    with open('tarapeak.sql', 'r') as f:
        cursor.executescript(f.read())
    conn.commit()
    conn.close()

# Initialize DB on startup if missing
if not os.path.exists(DB_PATH):
    init_db()

@app.get("/get")
def get_mountains(search: str = Query(None)):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if search:
        query = "SELECT * FROM mountain WHERE name = ?"
        cursor.execute(query, (search))
    else:
        cursor.execute("SELECT * FROM mountain")
        
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
