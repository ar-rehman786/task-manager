# TROUBLESHOOTING: npm Installation Failures

## The Problem
Your system is experiencing persistent npm installation errors. This is likely due to one of the following:

1. **Network/Firewall Issues**: Corporate firewall or antivirus blocking npm
2. **Permissions**: Insufficient permissions to install packages
3. **npm Cache Corruption**: Corrupted npm cache
4. **Node/npm Version**: Incompatible versions

## Quick Fixes to Try

### Option 1: Run as Administrator
1. Right-click PowerShell or Command Prompt
2. Select "Run as Administrator"
3. Navigate to the project folder:
   ```
   cd "c:\Users\TRONYX\Downloads\Antigravity testing\Task manager"
   ```
4. Try installing again:
   ```
   npm install
   ```

### Option 2: Use Different Registry
```powershell
npm config set registry https://registry.npmjs.org/
npm cache clean --force
npm install
```

### Option 3: Disable Strict SSL (if behind corporate proxy)
```powershell
npm config set strict-ssl false
npm install
```

### Option 4: Install with Different Flags
```powershell
npm install --force
```

### Option 5: Use Yarn Instead
```powershell
# Install yarn globally
npm install -g yarn

# Use yarn to install packages
yarn install
```

### Option 6: Manual Package Download
If all else fails, you can manually download and extract packages:

1. Go to https://www.npmjs.com/
2. Search for each package:
   - express
   - better-sqlite3
   - bcrypt
   - express-session
   - body-parser
3. Download the tarballs
4. Extract to `node_modules` folder

## Alternative: Use Online IDE

If local installation continues to fail, you can use an online IDE:

### Replit (Recommended)
1. Go to https://replit.com
2. Create a new Node.js Repl
3. Upload all your project files
4. Run `npm install` in the Replit terminal
5. Run `npm run seed` then `npm start`

### CodeSandbox
1. Go to https://codesandbox.io
2. Create a new Node.js sandbox
3. Upload your files
4. Dependencies install automatically

## Check Your Environment

Run these commands to diagnose:

```powershell
# Check Node version (should be 14+)
node --version

# Check npm version
npm --version

# Check npm configuration
npm config list

# Check for proxy settings
npm config get proxy
npm config get https-proxy

# Check registry
npm config get registry
```

## If You're Behind a Corporate Proxy

```powershell
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

## Nuclear Option: Reinstall Node.js

1. Uninstall Node.js completely
2. Download latest LTS from https://nodejs.org
3. Install as Administrator
4. Try again

## Contact Your IT Department

If you're on a work computer, your IT department may have:
- Blocked npm registry
- Restricted package installations
- Required specific proxy settings

They can help configure npm to work with your company's network.

---

**Once npm install works, run:**
```
npm run seed
npm start
```

Then open http://localhost:3000
