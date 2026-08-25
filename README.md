# WorkCrew CRM — Frontend

React (Vite) frontend for the WorkCrew CRM platform. Connects to the FastAPI
backend in [`founderos-backend`](https://github.com/TalentBox-Labs/founderos-backend)
(`runner_api.py`), which this repo is checked out as a git submodule for
local production builds — see that repo's Dockerfile.

## Prerequisites

- Node.js 18+ (`node --version`)
- The backend running (see `founderos-backend`'s README):
  `python3 -m uvicorn runner_api:app --host 127.0.0.1 --port 8000`

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 — you'll see the CRM with:

- **Dashboard** — overview stats + live backend/analytics status
- **Contacts** — contact list with an add-contact form
- **Deals** — pipeline view with stages and win rate
- **Analytics** — dashboard templates loaded live from the API

API calls are proxied through Vite (`/api` → `http://localhost:8000`), so no
CORS configuration is needed in development.

## Configuration

Optional environment variables (create `frontend/.env.local`):

```
VITE_API_BASE=/api          # or a full URL for a hosted backend
VITE_API_KEY=demo-key       # bearer token sent to the API
```

## Build for production

```bash
npm run build     # outputs static files to frontend/dist
npm run preview   # serve the production build locally
```
