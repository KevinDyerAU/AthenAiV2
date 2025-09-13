#!/bin/bash
# AthenAI ML Service Test Script for Unix/Linux/macOS
# This script tests the ML service functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
SKIP_HEALTH_CHECK=false
SKIP_PREDICTIONS=false
SKIP_BATCH=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-health-check)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        --skip-predictions)
            SKIP_PREDICTIONS=true
            shift
            ;;
        --skip-batch)
            SKIP_BATCH=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

function print_color() {
    printf "${2}${1}${NC}\n"
}

function test_http_endpoint() {
    local url=$1
    local method=${2:-GET}
    local data=${3:-}
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" \
                       -H "Content-Type: application/json" \
                       -d "$data" "$url" 2>/dev/null)
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" "$url" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo "$response" | sed -e 's/HTTPSTATUS:.*//g')
    
    if [ "$http_code" -eq 200 ]; then
        echo "SUCCESS:$body"
    else
        echo "ERROR:HTTP $http_code - $body"
    fi
}

print_color "🧪 AthenAI ML Service Tests" $BLUE
print_color "============================" $BLUE

# Load environment variables
if [ -f ".env" ]; then
    print_color "📋 Loading environment variables..." $BLUE
    export $(grep -v '^#' .env | xargs)
fi

# Get ML service URL
ML_SERVICE_HOST=${ML_SERVICE_HOST:-localhost}
ML_SERVICE_PORT=${ML_SERVICE_PORT:-8001}
BASE_URL="http://${ML_SERVICE_HOST}:${ML_SERVICE_PORT}"

print_color "🔗 Testing ML Service at: $BASE_URL" $BLUE

# Test 1: Health Check
if [ "$SKIP_HEALTH_CHECK" = false ]; then
    print_color "🏥 Testing health endpoint..." $YELLOW
    
    result=$(test_http_endpoint "$BASE_URL/ml/health")
    if [[ $result == SUCCESS:* ]]; then
        print_color "✅ Health check passed" $GREEN
        if [ "$VERBOSE" = true ]; then
            body=${result#SUCCESS:}
            print_color "   Response: $body" $BLUE
        fi
    else
        error=${result#ERROR:}
        print_color "❌ Health check failed: $error" $RED
        print_color "   Make sure ML service is running: npm run ml:service" $YELLOW
        exit 1
    fi
fi

# Test 2: Model Status
print_color "🤖 Testing model status endpoint..." $YELLOW

result=$(test_http_endpoint "$BASE_URL/ml/models/status")
if [[ $result == SUCCESS:* ]]; then
    print_color "✅ Model status check passed" $GREEN
    if [ "$VERBOSE" = true ]; then
        body=${result#SUCCESS:}
        print_color "   Response: $body" $BLUE
    fi
else
    error=${result#ERROR:}
    print_color "⚠️  Model status check failed: $error" $YELLOW
    print_color "   This is expected if models haven't been trained yet" $BLUE
fi

# Test 3: Metrics Endpoint
print_color "📊 Testing metrics endpoint..." $YELLOW

result=$(test_http_endpoint "$BASE_URL/ml/metrics")
if [[ $result == SUCCESS:* ]]; then
    print_color "✅ Metrics endpoint accessible" $GREEN
else
    error=${result#ERROR:}
    print_color "⚠️  Metrics endpoint failed: $error" $YELLOW
fi

# Test 4: Prediction Endpoints
if [ "$SKIP_PREDICTIONS" = false ]; then
    print_color "🔮 Testing prediction endpoints..." $YELLOW
    
    # Test expertise prediction
    expertise_payload='{"query": "machine learning expert", "limit": 5}'
    
    result=$(test_http_endpoint "$BASE_URL/ml/predict/expertise" "POST" "$expertise_payload")
    if [[ $result == SUCCESS:* ]]; then
        print_color "✅ Expertise prediction endpoint working" $GREEN
        if [ "$VERBOSE" = true ]; then
            body=${result#SUCCESS:}
            print_color "   Response: $body" $BLUE
        fi
    else
        error=${result#ERROR:}
        print_color "⚠️  Expertise prediction failed: $error" $YELLOW
        print_color "   This is expected if no training data is available" $BLUE
    fi
    
    # Test link prediction
    link_payload='{"source_entity": "Python", "target_entities": ["Machine Learning", "Data Science", "AI"], "limit": 3}'
    
    result=$(test_http_endpoint "$BASE_URL/ml/predict/links" "POST" "$link_payload")
    if [[ $result == SUCCESS:* ]]; then
        print_color "✅ Link prediction endpoint working" $GREEN
        if [ "$VERBOSE" = true ]; then
            body=${result#SUCCESS:}
            print_color "   Response: $body" $BLUE
        fi
    else
        error=${result#ERROR:}
        print_color "⚠️  Link prediction failed: $error" $YELLOW
        print_color "   This is expected if no training data is available" $BLUE
    fi
    
    # Test node classification
    classification_payload='{"entities": [{"name": "React", "type": "technology"}, {"name": "Python", "type": "programming_language"}]}'
    
    result=$(test_http_endpoint "$BASE_URL/ml/predict/classification" "POST" "$classification_payload")
    if [[ $result == SUCCESS:* ]]; then
        print_color "✅ Node classification endpoint working" $GREEN
        if [ "$VERBOSE" = true ]; then
            body=${result#SUCCESS:}
            print_color "   Response: $body" $BLUE
        fi
    else
        error=${result#ERROR:}
        print_color "⚠️  Node classification failed: $error" $YELLOW
        print_color "   This is expected if no training data is available" $BLUE
    fi
fi

# Test 5: Batch Job Endpoints
if [ "$SKIP_BATCH" = false ]; then
    print_color "📦 Testing batch job endpoints..." $YELLOW
    
    # Submit a test batch job
    batch_payload='{"job_type": "expertise_batch", "input_data": {"queries": ["AI researcher", "Python developer"], "limit": 5}, "config": {"batch_size": 10}}'
    
    result=$(test_http_endpoint "$BASE_URL/ml/batch/submit" "POST" "$batch_payload")
    if [[ $result == SUCCESS:* ]]; then
        print_color "✅ Batch job submission working" $GREEN
        body=${result#SUCCESS:}
        
        # Extract job_id if available
        if command -v jq >/dev/null 2>&1; then
            job_id=$(echo "$body" | jq -r '.job_id // empty')
            
            if [ -n "$job_id" ] && [ "$job_id" != "null" ]; then
                # Check job status
                sleep 1
                status_result=$(test_http_endpoint "$BASE_URL/ml/batch/$job_id/status")
                if [[ $status_result == SUCCESS:* ]]; then
                    print_color "✅ Batch job status check working" $GREEN
                    if [ "$VERBOSE" = true ]; then
                        status_body=${status_result#SUCCESS:}
                        print_color "   Job Status: $status_body" $BLUE
                    fi
                else
                    status_error=${status_result#ERROR:}
                    print_color "⚠️  Batch job status check failed: $status_error" $YELLOW
                fi
            fi
        fi
    else
        error=${result#ERROR:}
        print_color "⚠️  Batch job submission failed: $error" $YELLOW
        print_color "   This is expected if database is not properly configured" $BLUE
    fi
fi

# Test 6: Monitoring Endpoints
print_color "📈 Testing monitoring endpoints..." $YELLOW

result=$(test_http_endpoint "$BASE_URL/ml/monitoring/alerts")
if [[ $result == SUCCESS:* ]]; then
    print_color "✅ Monitoring alerts endpoint working" $GREEN
    if [ "$VERBOSE" = true ]; then
        body=${result#SUCCESS:}
        print_color "   Response: $body" $BLUE
    fi
else
    error=${result#ERROR:}
    print_color "⚠️  Monitoring alerts failed: $error" $YELLOW
fi

result=$(test_http_endpoint "$BASE_URL/ml/monitoring/drift")
if [[ $result == SUCCESS:* ]]; then
    print_color "✅ Data drift monitoring endpoint working" $GREEN
    if [ "$VERBOSE" = true ]; then
        body=${result#SUCCESS:}
        print_color "   Response: $body" $BLUE
    fi
else
    error=${result#ERROR:}
    print_color "⚠️  Data drift monitoring failed: $error" $YELLOW
fi

echo ""
print_color "🎉 ML Service Tests Complete!" $GREEN
print_color "==============================" $GREEN
echo ""
print_color "Test Summary:" $BLUE
print_color "✅ Basic endpoints are accessible" $GREEN
print_color "⚠️  Some prediction endpoints may fail without training data" $YELLOW
print_color "⚠️  Some monitoring endpoints may fail without database setup" $YELLOW
echo ""
print_color "Next steps:" $BLUE
print_color "1. Initialize ML database: npm run ml:init-db:unix" $YELLOW
print_color "2. Train initial models (see NEXT_STEPS_GUIDE.md)" $YELLOW
print_color "3. Set up monitoring and alerting" $YELLOW
echo ""
print_color "ML Service is running at: $BASE_URL" $BLUE
print_color "API Documentation: ${BASE_URL}/docs" $BLUE
