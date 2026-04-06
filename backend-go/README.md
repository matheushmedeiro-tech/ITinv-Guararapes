# ITINV Backend Go

Go backend for the IT inventory application.

## Storage mode

The backend supports two storage modes:

- Render Postgres (recommended): set `DATABASE_URL`
- Local file fallback: uses `STATE_FILE_PATH` (default `data/state.json`) when `DATABASE_URL` is not set

## Required environment variables

- `ADMIN_EMAIL` — login email for the app
- `ADMIN_PASSWORD` — login password for the app

## Optional environment variables

- `PORT` — HTTP port (default `3001`)
- `DATABASE_URL` — PostgreSQL connection string (Render database)
- `STATE_FILE_PATH` — local JSON file path when not using Postgres

## Run locally

```bash
cd ITINV/backend-go
export ADMIN_EMAIL="your-admin-email"
export ADMIN_PASSWORD="your-admin-password"
go mod tidy
go run main.go
```

## Endpoints

- `POST /api/login`
- `GET /api/me`
- `GET /api/app-state`
- `POST /api/app-state`
- `GET /api/health`

## Notes

- If `DATABASE_URL` is configured, data is stored in Postgres table `app_state`.
- If `DATABASE_URL` is missing, the backend persists to local file mode.
