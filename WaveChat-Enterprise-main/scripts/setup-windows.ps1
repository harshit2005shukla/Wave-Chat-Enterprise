$ErrorActionPreference = "Stop"
Write-Host "WaveChat Enterprise setup" -ForegroundColor Green
if (-not (Test-Path "apps/server/.env")) { Copy-Item "apps/server/.env.example" "apps/server/.env" }
if (-not (Test-Path "apps/web/.env")) { Copy-Item "apps/web/.env.example" "apps/web/.env" }
Write-Host "Installing npm dependencies..."
npm install
Write-Host "Starting MongoDB container..."
docker compose up -d mongo
Write-Host "Seeding demo accounts..."
npm run seed
Write-Host "Starting WaveChat..."
npm run dev
