# Pokédex Mobile Build Script
# This script automates the Capacitor setup for your Android App.

Write-Host "--- Starting Pokédex Mobile Build ---" -ForegroundColor Cyan

# 1. Check for Node.js
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed. Please download it from https://nodejs.org/" -ForegroundColor Red
    exit
}

# 2. Install Capacitor Dependencies
Write-Host "Installing Capacitor..." -ForegroundColor Yellow
npm install @capacitor/core @capacitor/cli @capacitor/android

# 3. Initialize Android Project
Write-Host "Adding Android platform..." -ForegroundColor Yellow
npx cap add android

# 4. Sync Web Assets
Write-Host "Syncing files to Android..." -ForegroundColor Yellow
npx cap sync android

# 5. Open Android Studio
if (Get-Command studio64.exe -ErrorAction SilentlyContinue) {
    Write-Host "Opening Android Studio for final build..." -ForegroundColor Green
    npx cap open android
} else {
    Write-Host "--- SETUP COMPLETE ---" -ForegroundColor Green
    Write-Host "1. Open Android Studio manually."
    Write-Host "2. Import the folder: ./android"
    Write-Host "3. Go to Build > Build Bundle(s) / APK(s) > Build APK(s)"
}
