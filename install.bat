@echo off
echo Installing Task Manager dependencies...
echo.

echo Step 1: Installing Express...
call npm install express@4.18.2
if %errorlevel% neq 0 (
    echo Failed to install Express
    pause
    exit /b 1
)

echo Step 2: Installing better-sqlite3...
call npm install better-sqlite3@9.2.2
if %errorlevel% neq 0 (
    echo Failed to install better-sqlite3
    pause
    exit /b 1
)

echo Step 3: Installing bcrypt...
call npm install bcrypt@5.1.1
if %errorlevel% neq 0 (
    echo Failed to install bcrypt
    pause
    exit /b 1
)

echo Step 4: Installing express-session...
call npm install express-session@1.17.3
if %errorlevel% neq 0 (
    echo Failed to install express-session
    pause
    exit /b 1
)

echo Step 5: Installing body-parser...
call npm install body-parser@1.20.2
if %errorlevel% neq 0 (
    echo Failed to install body-parser
    pause
    exit /b 1
)

echo.
echo ✅ All dependencies installed successfully!
echo.
echo Next steps:
echo 1. Run: npm run seed
echo 2. Run: npm start
echo 3. Open: http://localhost:3000
echo.
pause
