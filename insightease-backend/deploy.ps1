# InsightEase Deploy Script (PowerShell)

Write-Host "InsightEase Backend Deploy Script" -ForegroundColor Green
Write-Host "================================"

# Check Docker
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Docker not found" -ForegroundColor Red
    exit 1
}

if (!(Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Docker Compose not found" -ForegroundColor Red
    exit 1
}

Write-Host "Docker check passed" -ForegroundColor Green

# Check .env file
if (!(Test-Path ".env")) {
    Write-Host "Warning: .env not found, copying from template..." -ForegroundColor Yellow
    if (Test-Path ".env.production") {
        Copy-Item .env.production .env
        Write-Host "Please edit .env file with your database password!" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "Error: .env.production template not found" -ForegroundColor Red
        exit 1
    }
}

# Create directories
Write-Host "Creating data directories..."
New-Item -ItemType Directory -Force -Path data\uploads | Out-Null
New-Item -ItemType Directory -Force -Path data\reports | Out-Null
New-Item -ItemType Directory -Force -Path ssl | Out-Null

# Stop old containers
Write-Host "Stopping old containers..."
docker-compose down --remove-orphans 2>$null

# Build image
Write-Host "Building Docker image..."
docker-compose build --no-cache

# Start services
Write-Host "Starting services..."
docker-compose up -d

# Health check
Write-Host "Waiting for service to start..."
Start-Sleep -Seconds 5

$maxRetry = 10
$retry = 0
$success = $false

while ($retry -lt $maxRetry) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/" -Method GET -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $success = $true
            break
        }
    } catch {
        $retry++
        Write-Host "Retry $retry/$maxRetry..."
        Start-Sleep -Seconds 3
    }
}

if ($success) {
    Write-Host "Service started successfully!" -ForegroundColor Green
} else {
    Write-Host "Service failed to start, check logs:" -ForegroundColor Red
    Write-Host "  docker-compose logs -f backend"
    exit 1
}

Write-Host ""
Write-Host "Deploy Success!" -ForegroundColor Green
Write-Host "================================"
Write-Host "API: http://localhost:8000"
Write-Host "Docs: http://localhost:8000/docs"
Write-Host ""
Write-Host "Commands:"
Write-Host "  docker-compose logs -f backend"
Write-Host "  docker-compose down"
Write-Host "  docker-compose restart"
Write-Host "================================"
