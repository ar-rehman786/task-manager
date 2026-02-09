# Task Manager - GitHub & Vercel Deployment

## 🚀 Quick Start Guide

Your Task Manager is ready to deploy! Follow these steps to get it live for your team.

---

## Step 1: Create GitHub Repository

1. **Go to GitHub**: https://github.com/new
2. **Fill in details**:
   - Repository name: `task-manager` (or your choice)
   - Description: "Team Task & Project Manager with Kanban boards"
   - Visibility: **Private** (recommended for team apps)
   - ❌ **DO NOT** check "Add a README file"
   - ❌ **DO NOT** add .gitignore or license (we have them)
3. **Click "Create repository"**

## Step 2: Push to GitHub

Run these commands in your terminal:

```bash
# Set your GitHub username and repository name
git remote add origin https://github.com/YOUR_USERNAME/task-manager.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME`** with your actual GitHub username!

---

## Step 3: Deploy to Vercel

### Option A: Using Vercel Dashboard (Easiest)

1. **Go to Vercel**: https://vercel.com
2. **Sign in** with your GitHub account
3. **Click "Add New..." → "Project"**
4. **Import your repository**:
   - Find `task-manager` in the list
   - Click "Import"
5. **Configure Project**:
   - Framework Preset: **Other**
   - Root Directory: `./` (leave as is)
   - Build Command: (leave empty)
   - Output Directory: (leave empty)
   - Install Command: `yarn install`
6. **Environment Variables** - Click "Add" and set:
   - Name: `NODE_ENV` → Value: `production`
7. **Click "Deploy"**
8. **Wait 2-3 minutes** for deployment to complete

### Option B: Using Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

---

## ⚠️ Important: Database Configuration

**SQLite doesn't work on Vercel** (serverless environment). You need to use a cloud database.

### Recommended: Railway (Easiest for SQLite)

Instead of Vercel, use **Railway** which supports SQLite with persistent storage:

1. **Go to Railway**: https://railway.app
2. **Sign in** with GitHub
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose** your `task-manager` repository
6. **Railway auto-detects** Node.js and deploys
7. **Add environment variable**:
   - `NODE_ENV` = `production`
8. **Done!** Your app is live with SQLite working

Railway provides:
- ✅ Persistent storage (SQLite works)
- ✅ Free tier (500 hours/month)
- ✅ Automatic HTTPS
- ✅ Easy to use

### Alternative: Use PostgreSQL on Vercel

If you prefer Vercel, you'll need to:
1. Convert from SQLite to PostgreSQL
2. Use Vercel Postgres or external DB (Supabase, PlanetScale)
3. Update `database.js` to use PostgreSQL

(See DEPLOYMENT.md for detailed PostgreSQL migration guide)

---

## Step 4: After Deployment

### 1. Get Your Live URL

- **Railway**: `https://task-manager-production-xxxx.up.railway.app`
- **Vercel**: `https://task-manager-xxxx.vercel.app`

### 2. Seed the Database

Visit your live URL and the database will be created automatically on first run.

Then run the seed script:
```bash
# If deployed to Railway
railway run node seed.js

# Or manually create users via the app
```

### 3. Change Admin Password

**CRITICAL**: Change the default admin password!

1. Login with `admin@taskmanager.com` / `admin123`
2. Go to user settings (or update via database)
3. Set a strong password

### 4. Share with Your Team

1. **Share the URL** with your team
2. **Create accounts** for team members (Admin panel → Team Members)
3. **Team members login** and start using!

---

## 📋 Deployment Checklist

Before sharing with your team:

- [ ] Repository pushed to GitHub
- [ ] App deployed to Railway or Vercel
- [ ] Database seeded with initial data
- [ ] Admin password changed from default
- [ ] Test login works
- [ ] Test creating tasks and projects
- [ ] Test access tracking feature
- [ ] Share URL with team

---

## 🔧 Troubleshooting

### "Cannot find module" errors
- Make sure all dependencies are in `package.json`
- Run `yarn install` locally to verify

### Database not persisting
- **On Vercel**: Switch to Railway or use PostgreSQL
- **On Railway**: Should work automatically

### Session/Login issues
- Check that `NODE_ENV=production` is set
- Verify cookies are working (HTTPS required)

### Build failures
- Check deployment logs
- Verify Node.js version (18.x recommended)

---

## 🎯 What You Get

After deployment, your team can:
- ✅ Access from anywhere via web browser
- ✅ Create and manage tasks with Kanban boards
- ✅ Track projects with milestones
- ✅ Manage client access requirements
- ✅ Collaborate in real-time
- ✅ Secure with role-based access

---

## Need Help?

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **GitHub Docs**: https://docs.github.com

---

## 🎉 You're All Set!

Your Task Manager is ready for your team. Enjoy! 🚀
