# Start AthenAI with ML Services Enabled (PowerShell)

Write-Host "Starting AthenAI with ML Services..." -ForegroundColor Green

# Set ML service environment variables
$env:ENABLE_ML_SERVICE = "true"
$env:ML_SERVICE_HOST = "ml-service"
$env:ML_SERVICE_PORT = "8001"
$env:MLFLOW_TRACKING_URI = "http://mlflow:5000"

# Start with ML services profile
docker-compose -f docker-compose.simplified.yml --profile ml-services up -d

Write-Host "AthenAI with ML Services started successfully!" -ForegroundColor Green
Write-Host "Access points:" -ForegroundColor Yellow
Write-Host "- Main Application: http://localhost:3000" -ForegroundColor Cyan
Write-Host "- ML Service API: http://localhost:8001" -ForegroundColor Cyan
Write-Host "- MLflow UI: http://localhost:5000" -ForegroundColor Cyan
Write-Host "- Document Processing: http://localhost:8080" -ForegroundColor Cyan
