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

Copy `.env.example` to `.env` and fill in real values:

```
copy .env.example .env
```

- `DEEPSEEK_API_KEY` — required for the AI difficulty/safety/route-optimization features. Get one from
  [platform.deepseek.com](https://platform.deepseek.com). Without it, everything else works but those
  three AI endpoints will return an error.
- `JWT_SECRET` — required for login/signup. Any random string works locally, e.g.
  `python -c "import secrets; print(secrets.token_hex(32))"`.

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

Once the venv exists and env vars are set (or match the defaults), you can also start the backend from the project root with `npm run dev:backend`.

## 3. Frontend

React + TypeScript + Tailwind, built with Vite. From the project root:

```
npm install
npm run dev
```

Opens at `http://localhost:12345` (configured in `vite.config.ts`).

Note: `src/api.ts` has `API_URL` hardcoded to `http://127.0.0.1:8000`. Keep the backend on port 8000, or update that constant if you run it elsewhere.

To build for production:

```
npm run build
npm run preview
```

## Running both at once

Once each has been set up individually at least once (venv created, deps installed, database created), you can start both frontend and backend together from the project root:

```
npm run dev:all
```

This assumes your Postgres connection matches the defaults in `main.py` (`localhost:5432`, db `tarapeak`, user/password `postgres`). If you need different `PG*` values, set them in your shell before running, or just run `npm run dev` and `npm run dev:backend` in two separate terminals.

## Notes

- Each person running this locally needs their own Postgres instance and their own `backend/.venv` — neither is checked into git (see `.gitignore`).
- `localhost` only resolves to servers running on your own machine; if a groupmate runs their own backend/frontend, they use their own `localhost`, not yours.


## For the Leaflet Map
npm install leaflet react-leaflet --legacy-peer-deps
npm install --save-dev @types/leaflet --legacy-peer-deps
npm install react-leaflet@^4.2.1 leaflet@^1.9.4

cd backend
pip install httpx

create an account in openrouteservice then copy api key to env

npm install recharts