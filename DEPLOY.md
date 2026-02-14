# MTIMS — Deployment Guide (Render + MongoDB Atlas)

This guide walks through deploying the full application:

| Component | Platform | Plan |
|-----------|----------|------|
| **Backend API** | Render Web Service | Free |
| **Frontend** | Render Static Site | Free |
| **Database** | MongoDB Atlas | Free (M0) |

---

## 1. Set Up MongoDB Atlas (Database)

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com) and create a free account (or log in).
2. **Create a Cluster** → choose the **M0 Free Tier** and a region close to `Oregon` (to match Render).
3. Under **Database Access**, create a database user:
   - Username: `mtims`
   - Password: generate a strong password — **copy it**.
4. Under **Network Access**, click **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`).
   > This is required because Render's free tier uses dynamic IPs.
5. Go to **Databases** → **Connect** → **Drivers** and copy the connection string. It looks like:
   ```
   mongodb+srv://mtims:<password>@cluster0.xxxxx.mongodb.net/mtims?retryWrites=true&w=majority
   ```
   Replace `<password>` with the password you created in step 3.

---

## 2. Push Code to GitHub

Render deploys from a Git repository. If you haven't already:

```bash
cd MTIMS
git init
git add .
git commit -m "Prepare for Render deployment"
```

Create a repository on GitHub and push:

```bash
git remote add origin https://github.com/<your-username>/mtims.git
git branch -M main
git push -u origin main
```

---

## 3. Deploy with Render Blueprint (Recommended)

The repo includes a `render.yaml` file that defines both services.

1. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in.
2. Click **New** → **Blueprint**.
3. Connect your GitHub repo.
4. Render will detect `render.yaml` and show:
   - **mtims-api** (Web Service)
   - **mtims-client** (Static Site)
5. Set the environment variable prompted:
   - `MONGODB_URI` → paste the Atlas connection string from Step 1.
6. Click **Apply** — Render builds and deploys both services.

---

## 3b. Manual Deploy (Alternative)

### Backend — Web Service

1. **New** → **Web Service** → connect your repo.
2. Settings:
   - **Name**: `mtims-api`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
3. Environment Variables:
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `mongodb+srv://mtims:<password>@cluster0.xxxxx.mongodb.net/mtims?retryWrites=true&w=majority` |
   | `JWT_SECRET` | *(generate a random 64-char string)* |
   | `JWT_EXPIRES_IN` | `24h` |
   | `CLIENT_URL` | `https://mtims-client.onrender.com` *(update after frontend deploys)* |
4. Click **Create Web Service**.

### Frontend — Static Site

1. **New** → **Static Site** → connect your repo.
2. Settings:
   - **Name**: `mtims-client`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
3. Add a **Rewrite Rule**: `/*` → `/index.html` (for React Router client-side routing).
4. Environment Variables:
   | Key | Value |
   |-----|-------|
   | `REACT_APP_API_URL` | `https://mtims-api.onrender.com/api` |
   | `REACT_APP_SOCKET_URL` | `https://mtims-api.onrender.com` |
5. Click **Create Static Site**.

### Update Backend CORS

After both deploy, copy the frontend URL (e.g., `https://mtims-client.onrender.com`) and set it as `CLIENT_URL` in the backend environment variables on Render.

---

## 4. Seed the Database (Optional)

To populate demo data, open your backend service's **Shell** tab on Render and run:

```bash
node src/seed.js
```

Or run locally against the Atlas connection string:

```bash
cd server
MONGODB_URI="mongodb+srv://mtims:...@cluster0.xxxxx.mongodb.net/mtims" node src/seed.js
```

---

## 5. Verify

| Check | URL |
|-------|-----|
| Health endpoint | `https://mtims-api.onrender.com/api/health` |
| Frontend | `https://mtims-client.onrender.com` |

You should see `{ "status": "ok" }` from the health check and the login page on the frontend.

---

## Environment Variable Reference

### Server (`mtims-api`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | No | Render sets this automatically |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Random secret for signing JWTs |
| `JWT_EXPIRES_IN` | No | Token expiry (default: `24h`) |
| `CLIENT_URL` | Yes | Frontend URL for CORS (comma-separated for multiple) |

### Client (`mtims-client`)

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | Yes | Backend URL + `/api` |
| `REACT_APP_SOCKET_URL` | Yes | Backend URL (no `/api`) |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **CORS errors** | Ensure `CLIENT_URL` on the backend matches the exact frontend URL (no trailing slash) |
| **MongoDB connection fails** | Check Atlas Network Access has `0.0.0.0/0`, and the URI password has no special chars unescaped |
| **502 on first request** | Render free tier spins down after inactivity — first request takes ~30 s to cold-start |
| **WebSocket fails** | Ensure `REACT_APP_SOCKET_URL` points to the backend URL (not the API path) |
| **React routes return 404** | Ensure the Static Site has the rewrite rule: `/* → /index.html` |

---

## Notes on Render Free Tier

- Services spin down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds.
- 750 free hours/month across all services.
- For always-on services, upgrade to the **Starter** plan ($7/month per service).
