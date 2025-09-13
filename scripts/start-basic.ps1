# Start AthenAI without ML Services (Basic Mode) - PowerShell

Write-Host "Starting AthenAI in Basic Mode (without ML Services)..." -ForegroundColor Green

# Ensure ML service is disabled
$env:ENABLE_ML_SERVICE = "false"

# Start without ML services profile (default services only)
docker-compose -f docker-compose.simplified.yml up -d

Write-Host "AthenAI Basic Mode started successfully!" -ForegroundColor Green
Write-Host "Access points:" -ForegroundColor Yellow
Write-Host "- Main Application: http://localhost:3000" -ForegroundColor Cyan
Write-Host "- Document Processing: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: ML Services are disabled. To enable them, use start-with-ml.ps1" -ForegroundColor Yellow
