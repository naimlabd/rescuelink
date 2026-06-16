# RescueLink Python Backend

This backend replaces the n8n workflow in `backend_workflow.json` with a Python codebase that exposes the same webhook-style endpoints:

- `POST /webhook/incident-report`
- `GET /webhook/incidents/active`
- `POST /webhook/incident/respond`
- `GET /webhook/incident/status?incident_id=...`

For convenience, the same handlers are also mounted without the `/webhook` prefix:

- `POST /incident-report`
- `GET /incidents/active`
- `POST /incident/respond`
- `GET /incident/status`

## What it replaces

The original n8n workflow handled:

- webhook input parsing
- AI-style triage
- Airtable persistence
- worker response updates
- citizen status lookups
- notification fan-out

This Python backend keeps the same business flow, but replaces external workflow nodes with:

- SQLite persistence
- deterministic Python triage heuristics
- JSONL notification logs
- built-in CORS support for browser clients

## Run

```powershell
cd G:\rescuelink_-main\backend
python app.py
```

The API will start on `http://127.0.0.1:8000`.

## Tests

```powershell
cd G:\rescuelink_-main\backend
python -m unittest discover -s tests -v
```

## Frontend integration

Your frontend can call this backend at:

- `http://127.0.0.1:8000/webhook/incident-report`
- `http://127.0.0.1:8000/webhook/incidents/active`
- `http://127.0.0.1:8000/webhook/incident/respond`
- `http://127.0.0.1:8000/webhook/incident/status`

For the React app in `G:\rescuelink_-main\src`:

- local dev can use the Vite proxy with no extra config if this backend is running on `127.0.0.1:8000`
- if the frontend is hosted separately, set `VITE_API_BASE_URL` to the Python backend origin
