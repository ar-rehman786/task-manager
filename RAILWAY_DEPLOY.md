# 🚀 Deploy to Railway - Quick Guide

Your code is now on GitHub! Let's get it live on Railway.

## GitHub Repository
✅ **https://github.com/ar-rehman786/task-manager**

---

## Deploy to Railway (Recommended - 5 Minutes)

Railway is perfect for this app because it supports SQLite with persistent storage!

### Step 1: Go to Railway
👉 **https://railway.app**

### Step 2: Sign In
- Click **"Login"**
- Choose **"Login with GitHub"**
- Authorize Railway to access your GitHub

### Step 3: Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Find and click **"ar-rehman786/task-manager"**
4. Railway will automatically:
   - ✅ Detect it's a Node.js app
   - ✅ Install dependencies
   - ✅ Start the server
   - ✅ Give you a live URL

### Step 4: Wait for Deployment (2-3 minutes)
- Watch the build logs
- Wait for "Deployment successful" ✅

### Step 5: Get Your Live URL
1. Click on your deployment
2. Go to **"Settings"** tab
3. Scroll to **"Domains"**
4. Click **"Generate Domain"**
5. Copy your URL: `https://task-manager-production-xxxx.up.railway.app`

---

## After Deployment

### 1. Seed the Database

The database will be created automatically on first access. To add sample data:

**Option A: Via Railway CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run seed
railway run node seed.js
```

**Option B: Manually**
Just visit your live URL and use the app - the database will initialize automatically!

### 2. Change Admin Password
🔒 **IMPORTANT**: Change the default password!

1. Visit your live URL
2. Login with: `admin@taskmanager.com` / `admin123`
3. Change the password immediately

### 3. Share with Your Team
1. Share the Railway URL with your team
2. Create accounts for team members (Admin → Team Members)
3. They can access from anywhere!

---

## Your Live URLs

**GitHub Repository:**
https://github.com/ar-rehman786/task-manager

**Railway App (after deployment):**
https://task-manager-production-xxxx.up.railway.app
(Replace xxxx with your actual domain)

---

## Railway Features

✅ **Free Tier**: 500 hours/month (plenty for team use)
✅ **Persistent Storage**: SQLite database persists across deployments
✅ **Automatic HTTPS**: Secure by default
✅ **Auto-Deploy**: Pushes to GitHub auto-deploy
✅ **Environment Variables**: Easy to configure
✅ **Logs**: Real-time monitoring

---

## Troubleshooting

### Build Failed?
- Check Railway logs for errors
- Verify `package.json` has all dependencies
- Make sure Node.js version is compatible

### Can't Access App?
- Check if deployment is "Active"
- Verify domain is generated
- Check Railway logs for runtime errors

### Database Not Working?
- Railway automatically provides persistent storage
- Database file is created on first run
- Check logs if you see database errors

---

## Alternative: Vercel (Requires PostgreSQL)

If you prefer Vercel:
1. Go to https://vercel.com
2. Import your GitHub repo
3. **Note**: You'll need to migrate from SQLite to PostgreSQL
4. See `DEPLOYMENT.md` for PostgreSQL migration guide

---

## 🎉 You're Done!

Once deployed on Railway:
- ✅ Your team can access from anywhere
- ✅ Data persists across deployments
- ✅ Automatic HTTPS security
- ✅ Free hosting (500 hours/month)

**Next**: Share the URL with your team and start collaborating!
