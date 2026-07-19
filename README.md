# TaraPeak

A trail-exploration app for hiking mountains in Benguet, Philippines — browse trails by difficulty, distance, terrain, and hazards, then drill into a trail's details.

## Stack

- **Frontend**: React + TypeScript + Tailwind CSS, built with Vite (`src/`)
- **Backend**: FastAPI (`backend/main.py`)
- **Database**: PostgreSQL

## Running locally

See [RUNNING.md](RUNNING.md) for setup instructions (database, backend, frontend).

## Project structure

```
backend/        FastAPI app + Postgres schema (tarapeak.sql)
src/            React frontend (pages, components, API client)
public/         Static assets served as-is
docker-compose.yml   Local Postgres for development
```
