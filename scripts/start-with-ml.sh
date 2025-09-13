#!/bin/bash
# Start AthenAI with ML Services Enabled

echo "Starting AthenAI with ML Services..."

# Set ML service environment variables
export ENABLE_ML_SERVICE=true
export ML_SERVICE_HOST=ml-service
export ML_SERVICE_PORT=8001
export MLFLOW_TRACKING_URI=http://mlflow:5000

# Start with ML services profile
docker-compose -f docker-compose.simplified.yml --profile ml-services up -d

echo "AthenAI with ML Services started successfully!"
echo "Access points:"
echo "- Main Application: http://localhost:3000"
echo "- ML Service API: http://localhost:8001"
echo "- MLflow UI: http://localhost:5000"
echo "- Document Processing: http://localhost:8080"
