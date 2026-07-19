# Running TaraPeak locally

## Prerequisites

- Python 3.10+
- PostgreSQL, either:
  - Docker Desktop with WSL2 working (`docker compose up -d`), or
  - PostgreSQL installed natively on your machine
- Node.js (to run the frontend dev server)

## 1. Database

**Option A — Docker**

```
docker compose up -d
```

Starts Postgres on `localhost:5432` with database `tarapeak`, user `postgres`, password `postgres`.

**Option B — native PostgreSQL**

Install PostgreSQL, then create the database:

```
createdb -U postgres tarapeak
```

## 2. Backend

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Set connection env vars to match whichever Postgres you're using (defaults shown match Option A above):

```
set PGHOST=localhost
set PGPORT=5432
set PGDATABASE=tarapeak
set PGUSER=postgres
set PGPASSWORD=postgres
```

(or set a single `DATABASE_URL=postgresql://user:pass@host:port/dbname` instead of the five separate vars)

Run the API:

```
python main.py
```

Serves at `http://localhost:8000`. Tables and seed data (3 mountains) are created automatically on first run.

## 3. Frontend

React + TypeScript + Tailwind, built with Vite. From the project root:

```
npm install
npm run dev
```

Opens at `http://localhost:5173` (or the port shown in the terminal).

Note: `src/api.ts` has `API_URL` hardcoded to `http://127.0.0.1:8000`. Keep the backend on port 8000, or update that constant if you run it elsewhere.

To build for production:

```
npm run build
npm run preview
```

## Notes

- Each person running this locally needs their own Postgres instance and their own `backend/.venv` — neither is checked into git (see `.gitignore`).
- `localhost` only resolves to servers running on your own machine; if a groupmate runs their own backend/frontend, they use their own `localhost`, not yours.
