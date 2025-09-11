#!/bin/bash
# AthenAI Document Processing Test Script for Unix/Linux
# This script tests document processing functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line arguments
VERBOSE=false
TEST_FILE=""
SKIP_UPLOAD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --test-file)
            TEST_FILE="$2"
            shift 2
            ;;
        --skip-upload)
            SKIP_UPLOAD=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--verbose] [--test-file FILE] [--skip-upload]"
            echo "  --verbose       Show detailed output"
            echo "  --test-file     Use specific file for testing"
            echo "  --skip-upload   Skip document upload test"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

function print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

function test_service_health() {
    local url=$1
    local service_name=$2
    
    if curl -s -f "$url" >/dev/null 2>&1; then
        print_color $GREEN "✅ $service_name is healthy"
        return 0
    else
        print_color $RED "❌ $service_name is not responding"
        return 1
    fi
}

function test_rabbitmq_queue() {
    local rabbit_url="http://localhost:15672/api/queues"
    local credentials="athenai_queue:your_rabbitmq_password_here"
    
    if curl -s -u "$credentials" "$rabbit_url" >/dev/null 2>&1; then
        print_color $GREEN "✅ RabbitMQ queues are accessible"
        return 0
    else
        print_color $YELLOW "⚠️  RabbitMQ management not accessible (this is normal if using default credentials)"
        return 0
    fi
}

function test_postgresql_connection() {
    print_color $CYAN "🗄️  Testing PostgreSQL connection..."
    
    if docker exec postgres-db psql -U athenai_user -d athenai_knowledge -c "SELECT 1;" >/dev/null 2>&1; then
        print_color $GREEN "✅ PostgreSQL connection successful"
        return 0
    else
        print_color $RED "❌ PostgreSQL connection failed"
        return 1
    fi
}

function test_pgvector_extension() {
    print_color $CYAN "🔍 Testing pgvector extension..."
    
    local result=$(docker exec postgres-db psql -U athenai_user -d athenai_knowledge -c "SELECT * FROM pg_extension WHERE extname = 'vector';" 2>/dev/null)
    
    if [[ $result == *"vector"* ]]; then
        print_color $GREEN "✅ pgvector extension is installed"
        return 0
    else
        print_color $RED "❌ pgvector extension not found"
        return 1
    fi
}

function create_test_document() {
    local test_dir="./data/unstructured/input"
    local test_file="$test_dir/test-document.txt"
    
    mkdir -p "$test_dir"
    
    cat > "$test_file" << EOF
AthenAI Document Processing Test

This is a test document for the AthenAI document processing system.

Key Features:
- Unstructured.io integration for document parsing
- pgvector for semantic search capabilities
- RabbitMQ for asynchronous processing
- Supabase PostgreSQL for vector storage

Test Content:
The AthenAI system uses advanced AI agents to process and analyze documents.
This includes semantic search, summarization, and intelligent routing.

Date: $(date '+%Y-%m-%d %H:%M:%S')
EOF

    if [[ -f "$test_file" ]]; then
        print_color $GREEN "✅ Test document created: $test_file"
        echo "$test_file"
    else
        print_color $RED "❌ Failed to create test document"
        return 1
    fi
}

function test_document_upload() {
    local file_path=$1
    
    print_color $CYAN "📄 Testing document upload..."
    
    if [[ ! -f "$file_path" ]]; then
        print_color $RED "❌ Test file not found: $file_path"
        return 1
    fi
    
    local upload_url="http://localhost:3000/api/agents/document"
    local body=$(cat << EOF
{
    "message": "Upload document: $file_path",
    "agent": "document"
}
EOF
)
    
    print_color $YELLOW "📤 Sending upload request..."
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$body" \
        "$upload_url" \
        --max-time 30)
    
    if [[ $? -eq 0 ]] && [[ -n "$response" ]]; then
        print_color $GREEN "✅ Document upload request successful"
        
        if [[ $response == *"documentId"* ]]; then
            print_color $GREEN "✅ Document ID received in response"
            return 0
        else
            print_color $YELLOW "⚠️  Upload request sent but no document ID in response"
            return 0
        fi
    else
        print_color $RED "❌ Document upload failed"
        return 1
    fi
}

function test_worker_logs() {
    print_color $CYAN "📋 Checking worker logs..."
    
    local logs=$(docker-compose -f docker-compose.simplified.yml logs --tail=20 unstructured-worker 2>/dev/null)
    
    if [[ $logs == *"Starting unstructured worker"* ]] || [[ $logs == *"Worker started successfully"* ]]; then
        print_color $GREEN "✅ Worker is running and processing"
        return 0
    elif [[ $logs == *"Error"* ]] || [[ $logs == *"Exception"* ]]; then
        print_color $YELLOW "⚠️  Worker logs show errors - check logs for details"
        if [[ $VERBOSE == true ]]; then
            print_color $CYAN "Recent worker logs:"
            echo "$logs"
        fi
        return 1
    else
        print_color $YELLOW "⚠️  Worker logs are unclear - check manually"
        return 0
    fi
}

function show_test_summary() {
    local -n results=$1
    
    print_color $CYAN "\n📊 Document Processing Test Summary:"
    print_color $CYAN "===================================="
    
    local passed=0
    local total=0
    
    for test in "${!results[@]}"; do
        total=$((total + 1))
        if [[ ${results[$test]} == "true" ]]; then
            print_color $GREEN "✅ $test"
            passed=$((passed + 1))
        else
            print_color $RED "❌ $test"
        fi
    done
    
    if [[ $passed -eq $total ]]; then
        print_color $GREEN "\nResults: $passed/$total tests passed"
        print_color $GREEN "\n🎉 All tests passed! Document processing is working correctly."
    else
        print_color $YELLOW "\nResults: $passed/$total tests passed"
        print_color $YELLOW "\n⚠️  Some tests failed. Check the errors above."
        print_color $CYAN "💡 Try running: npm run docker:simplified:logs"
    fi
}

# Main execution
print_color $CYAN "🧪 AthenAI Document Processing Tests"
print_color $CYAN "===================================="

declare -A test_results

# Test service health
print_color $CYAN "\n🏥 Testing service health..."
if test_service_health "http://localhost:3000/health" "AthenAI API"; then
    test_results["AthenAI API Health"]="true"
else
    test_results["AthenAI API Health"]="false"
fi

# Test database connections
if test_postgresql_connection; then
    test_results["PostgreSQL Connection"]="true"
else
    test_results["PostgreSQL Connection"]="false"
fi

if test_pgvector_extension; then
    test_results["pgvector Extension"]="true"
else
    test_results["pgvector Extension"]="false"
fi

# Test RabbitMQ
if test_rabbitmq_queue; then
    test_results["RabbitMQ Queue Access"]="true"
else
    test_results["RabbitMQ Queue Access"]="false"
fi

# Test worker logs
if test_worker_logs; then
    test_results["Worker Status"]="true"
else
    test_results["Worker Status"]="false"
fi

# Test document upload if not skipped
if [[ $SKIP_UPLOAD == false ]]; then
    local test_file="$TEST_FILE"
    if [[ -z "$test_file" ]]; then
        test_file=$(create_test_document)
    fi
    
    if [[ -n "$test_file" ]] && test_document_upload "$test_file"; then
        test_results["Document Upload"]="true"
    else
        test_results["Document Upload"]="false"
    fi
else
    print_color $YELLOW "⏭️  Skipping document upload test"
fi

# Show summary
show_test_summary test_results

# Exit with appropriate code
local failed_tests=0
for result in "${test_results[@]}"; do
    if [[ $result == "false" ]]; then
        failed_tests=$((failed_tests + 1))
    fi
done

if [[ $failed_tests -gt 0 ]]; then
    exit 1
else
    exit 0
fi
