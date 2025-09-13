#!/bin/bash
# Start AthenAI without ML Services (Basic Mode)

echo "Starting AthenAI in Basic Mode (without ML Services)..."

# Ensure ML service is disabled
export ENABLE_ML_SERVICE=false

# Start without ML services profile (default services only)
docker-compose -f docker-compose.simplified.yml up -d

echo "AthenAI Basic Mode started successfully!"
echo "Access points:"
echo "- Main Application: http://localhost:3000"
echo "- Document Processing: http://localhost:8080"
echo ""
echo "Note: ML Services are disabled. To enable them, use start-with-ml.sh"
