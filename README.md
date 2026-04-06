# ITINV Inventory App

Frontend and backend for the IT inventory management application.

## Project structure

- `ITINV/` — React + Vite frontend
- `ITINV/backend-go` — Go backend API

## Frontend

```bash
cd ITINV
npm install
npm run dev
```

By default the frontend calls `/api`.
For production on Render, configure `VITE_API_BASE_URL` with your backend URL.

## Backend

```bash
cd ITINV/backend-go
export ADMIN_EMAIL="your-admin-email"
export ADMIN_PASSWORD="your-admin-password"
go mod tidy
go run main.go
```

Backend supports:

- `DATABASE_URL` for Postgres (recommended on Render)
- `STATE_FILE_PATH` local JSON fallback (for local/dev)

## Render deploy

A Render Blueprint is provided in `render.yaml` with:

- `itinv-backend` (Go web service)
- `itinv-frontend` (Static site)
- `itinv-db` (Render Postgres)

After creating services, set these env vars in Render:

- Backend: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Frontend: `VITE_API_BASE_URL` (example: `https://itinv-backend.onrender.com`)
