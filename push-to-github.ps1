# Pokédex Push to GitHub Script
# This will initialize your local project and push it to the cloud.

$RepoUrl = "https://github.com/aalokjose-a11y/pokedex.git"

Write-Host "--- Initializing Pokédex Git ---" -ForegroundColor Cyan

# 1. Check for Git
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Git is not installed. Please download it from https://git-scm.com/" -ForegroundColor Red
    exit
}

# 2. Setup Local Repo
git init
git add .
git commit -m "Initial Pokédex Mobile Build with Cloud Action"

# 3. Setup Remote
git remote add origin $RepoUrl
git branch -M main

# 4. Push to Cloud
Write-Host "Pushing code to GitHub..." -ForegroundColor Yellow
git push -u origin main

Write-Host "--- DONE! ---" -ForegroundColor Green
Write-Host "1. Check your GitHub Actions tab."
Write-Host "2. Wait for the 'Build Android APK' job to finish."
Write-Host "3. Download your APK from the artifacts!"
