# FounderOS — Frontend

React (Vite) frontend for the FounderOS CRM platform. Connects to the FastAPI
backend in [`founderos-backend`](https://github.com/TalentBox-Labs/founderos-backend)
(`runner_api.py`), which this repo is checked out as a git submodule for
local production builds — see that repo's Dockerfile.

## Prerequisites

- Node.js 24 (`nvm use`, or install the version in `.nvmrc`)
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

## Development and release checks

`Main` is the canonical branch. Clone `https://github.com/TalentBox-Labs/founderos-frontend.git`, run `nvm use`, then `npm ci`. Use `npm test` and `npm run build` before opening a pull request. GitHub runs these checks and a dependency audit on every pull request to `Main`.

This repository produces the React bundle served at `/app` by the backend. The backend pins a specific frontend commit as a Git submodule. A frontend merge alone does not update the backend image: promote the reviewed commit by updating the backend's submodule pointer in a separate pull request, and verify the combined image before deploying.

The reorganized local checkout lives under `Documents/FounderOS/repositories/founderos-frontend-c1`. Repository commands use relative paths and work from any checkout location.
