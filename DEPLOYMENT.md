# Deployment Guide (Render & GitHub)

This guide walks you through pushing your repository to GitHub and deploying all services on **Render.com**.

---

## 1. Push Repository to GitHub

Initialize your git repository locally and push to GitHub:

```bash
# Initialize git
git init

# Add all files (secrets are excluded by .gitignore)
git add .

# Create initial commit
git commit -m "feat: complete trading signal platform MVP"

# Set main branch
git branch -M main

# Add your GitHub remote repository URL
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git

# Push to GitHub
git push -u origin main
```

---

## 2. Deploying on Render.com

You can deploy the entire stack using Render's Infrastructure-as-Code (`render.yaml`) or manually create the services.

### Option A: Automatic Deployment via `render.yaml` (Recommended)

This repository includes a `render.yaml` blueprint.
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **Blueprints** $\rightarrow$ **New Blueprint Instance**.
3. Select your connected GitHub repository.
4. Render will automatically provision:
   - **PostgreSQL Database** (`trading_platform`)
   - **Redis Cache & Queues**
   - **Backend Web Service** (Dockerfile: `docker/backend.Dockerfile`)
   - **ML Web Service** (Dockerfile: `docker/ml.Dockerfile`)
   - **Frontend Web Service** (Dockerfile: `docker/frontend.Dockerfile`)

---

### Option B: Manual Setup on Render

If creating services manually:

#### 1. PostgreSQL Database
- In Render Dashboard, click **New +** $\rightarrow$ **PostgreSQL**.
- Name: `trading-db`
- Database: `trading_platform`
- User: `trading`
- Plan: Free or Starter
- Save the `Internal Database URL`.

#### 2. Redis Instance
- In Render Dashboard, click **New +** $\rightarrow$ **Redis**.
- Name: `trading-redis`
- Plan: Free or Starter
- Save the `Internal Redis URL`.

#### 3. ML Web Service (Python FastAPI)
- Click **New +** $\rightarrow$ **Web Service**.
- Connect your GitHub repository.
- Root Directory: `.`
- Runtime: **Docker**
- Dockerfile Path: `docker/ml.Dockerfile`
- Environment Variables:
  - `DATABASE_URL`: Your Render Internal Database URL
  - `REDIS_URL`: Your Render Internal Redis URL
  - `PORT`: `8000`
- Save the generated service URL (e.g. `https://trading-ml.onrender.com`).

#### 4. Backend Web Service (Node.js Fastify)
- Click **New +** $\rightarrow$ **Web Service**.
- Connect your GitHub repository.
- Runtime: **Docker**
- Dockerfile Path: `docker/backend.Dockerfile`
- Environment Variables:
  - `DATABASE_URL`: Your Render Internal Database URL
  - `REDIS_URL`: Your Render Internal Redis URL
  - `ML_SERVICE_URL`: URL of your deployed ML service
  - `JWT_SECRET`: Generate a secure random string (at least 64 chars)
  - `JWT_REFRESH_SECRET`: Generate another secure random string
  - `TELEGRAM_BOT_TOKEN`: Your Telegram Bot API token (optional)
  - `MARKET_DATA_PROVIDER`: `demo` (or `twelvedata` with `MARKET_DATA_API_KEY`)
  - `NEWS_PROVIDER`: `demo` (or `newsapi` with `NEWS_API_KEY`)
  - `LIVE_TRADING_ENABLED`: `false`
- Save the backend service URL (e.g. `https://trading-backend.onrender.com`).

#### 5. Frontend Web Service (React SPA)
- Click **New +** $\rightarrow$ **Web Service**.
- Runtime: **Docker**
- Dockerfile Path: `docker/frontend.Dockerfile`
- Environment Variables:
  - `VITE_API_URL`: URL of your backend service

---

## 3. Database Migration on Render

After provisioning the database:
1. Open the **Backend** service shell in Render Dashboard.
2. Run migrations:
   ```bash
   pnpm --filter backend migrate
   pnpm --filter backend seed:demo
   ```
