# Deployment Guide

## Quick Deploy to Vercel

### Prerequisites
- GitHub account
- Vercel account (free tier works)

### Step 1: Push to GitHub

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Task Manager application"
   ```

2. **Create GitHub Repository**:
   - Go to https://github.com/new
   - Name: `task-manager` (or your preferred name)
   - Keep it Private (recommended for team apps)
   - Don't initialize with README (we already have files)
   - Click "Create repository"

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/task-manager.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

#### Option A: Vercel Dashboard (Recommended)

1. **Go to Vercel**: https://vercel.com
2. **Sign in** with your GitHub account
3. **Click "Add New Project"**
4. **Import** your `task-manager` repository
5. **Configure Project**:
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: (leave empty)
   - Output Directory: (leave empty)
   - Install Command: `yarn install`
6. **Environment Variables** (Add these):
   - `NODE_ENV` = `production`
7. **Click "Deploy"**

#### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Step 3: Database Setup

**Important**: SQLite doesn't work well on Vercel (serverless). You have two options:

#### Option 1: Use Vercel Postgres (Recommended)

1. In Vercel Dashboard, go to your project
2. Click "Storage" tab
3. Create "Postgres" database
4. Copy the connection details
5. Update `database.js` to use PostgreSQL instead of SQLite

#### Option 2: Use External Database

Use a service like:
- **Supabase** (PostgreSQL) - Free tier available
- **PlanetScale** (MySQL) - Free tier available
- **MongoDB Atlas** - Free tier available

### Step 4: Update Database Configuration

For PostgreSQL (recommended for Vercel):

```bash
# Install PostgreSQL driver
yarn add pg
```

Update `database.js`:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Update all db.prepare() calls to use pool.query()
```

### Step 5: Seed Production Database

After deploying:

1. **Create seed endpoint** (admin only):
   ```javascript
   app.post('/api/admin/seed', requireAdmin, async (req, res) => {
     // Run seed logic
   });
   ```

2. **Call it once** after deployment to populate data

### Step 6: Configure Team Access

1. **Share the URL** with your team (e.g., `https://task-manager.vercel.app`)
2. **Create team accounts** using the admin panel
3. **Set strong admin password** (change from default!)

## Alternative: Deploy to Railway

If you prefer Railway (better for SQLite):

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will auto-detect Node.js
6. Add environment variables if needed
7. Deploy!

Railway supports persistent storage, so SQLite will work.

## Alternative: Deploy to Render

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - Name: task-manager
   - Environment: Node
   - Build Command: `yarn install`
   - Start Command: `node server.js`
5. Add environment variables
6. Create Web Service

Render also supports persistent disks for SQLite.

## Security Checklist

Before going live:

- [ ] Change default admin password
- [ ] Set strong session secret (not the default)
- [ ] Enable HTTPS (Vercel does this automatically)
- [ ] Review user permissions
- [ ] Set up backups for database
- [ ] Add rate limiting (optional)
- [ ] Configure CORS if needed

## Troubleshooting

### Database Connection Issues
- Check environment variables are set
- Verify database URL is correct
- Ensure SSL settings match your provider

### Build Failures
- Check Node.js version (use 18.x or higher)
- Verify all dependencies are in package.json
- Check build logs for specific errors

### Session Issues
- Set SESSION_SECRET environment variable
- Ensure cookies are configured for production domain

## Monitoring

After deployment:
- Check Vercel Analytics for usage
- Monitor error logs in Vercel dashboard
- Set up alerts for downtime (optional)

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
