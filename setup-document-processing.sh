#!/bin/bash
# AthenAI Document Processing Setup Script for Unix/Linux
# This script sets up document processing with pgvector, RabbitMQ, and unstructured.io

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line arguments
CHECK_ONLY=false
SKIP_DOCKER=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--check-only] [--skip-docker] [--verbose]"
            echo "  --check-only    Only check setup, don't make changes"
            echo "  --skip-docker   Skip Docker-related checks and setup"
            echo "  --verbose       Show detailed output"
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

function command_exists() {
    command -v "$1" >/dev/null 2>&1
}

function test_docker_service() {
    local service_name=$1
    docker-compose -f docker-compose.simplified.yml ps --services --filter "status=running" 2>/dev/null | grep -q "^${service_name}$"
}

function test_environment_file() {
    if [[ ! -f ".env" ]]; then
        print_color $RED "❌ .env file not found"
        print_color $YELLOW "📝 Creating .env from .env.simplified.example..."
        
        if [[ -f ".env.simplified.example" ]]; then
            cp ".env.simplified.example" ".env"
            print_color $GREEN "✅ .env file created from template"
            print_color $YELLOW "⚠️  Please update .env with your actual credentials"
            return 1
        else
            print_color $RED "❌ .env.simplified.example not found"
            return 1
        fi
    fi
    return 0
}

function test_python_dependencies() {
    print_color $CYAN "🐍 Checking Python dependencies..."
    
    if ! command_exists python3 && ! command_exists python; then
        print_color $RED "❌ Python not found"
        return 1
    fi
    
    local python_cmd="python3"
    if ! command_exists python3; then
        python_cmd="python"
    fi
    
    local python_version=$($python_cmd --version 2>&1)
    print_color $CYAN "📦 Python version: $python_version"
    
    if [[ ! -f "requirements-unstructured.txt" ]]; then
        print_color $RED "❌ requirements-unstructured.txt not found"
        return 1
    fi
    
    local missing_packages=()
    while IFS= read -r req; do
        # Skip comments and empty lines
        [[ $req =~ ^#.*$ ]] || [[ -z $req ]] && continue
        
        # Extract package name (before ==, >=, etc.)
        local package=$(echo "$req" | sed 's/[=<>~!].*//' | tr '-' '_')
        
        if ! $python_cmd -c "import $package" 2>/dev/null; then
            missing_packages+=("$package")
        fi
    done < requirements-unstructured.txt
    
    if [[ ${#missing_packages[@]} -gt 0 ]]; then
        print_color $RED "❌ Missing Python packages: ${missing_packages[*]}"
        if [[ $CHECK_ONLY == false ]]; then
            print_color $YELLOW "📦 Installing missing packages..."
            pip3 install -r requirements-unstructured.txt || pip install -r requirements-unstructured.txt
            if [[ $? -eq 0 ]]; then
                print_color $GREEN "✅ Python dependencies installed"
            else
                print_color $RED "❌ Failed to install Python dependencies"
                return 1
            fi
        fi
    else
        print_color $GREEN "✅ All Python dependencies are installed"
    fi
    
    return 0
}

function test_docker_setup() {
    print_color $CYAN "🐳 Checking Docker setup..."
    
    if ! command_exists docker; then
        print_color $RED "❌ Docker not found"
        return 1
    fi
    
    if ! command_exists docker-compose; then
        print_color $RED "❌ Docker Compose not found"
        return 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_color $RED "❌ Docker is not running"
        return 1
    fi
    
    print_color $GREEN "✅ Docker is running"
    
    if [[ ! -f "docker-compose.simplified.yml" ]]; then
        print_color $RED "❌ docker-compose.simplified.yml not found"
        return 1
    fi
    
    print_color $GREEN "✅ Docker setup is ready"
    return 0
}

function test_document_processing_services() {
    print_color $CYAN "📄 Checking document processing services..."
    
    local services=("postgres" "rabbitmq" "unstructured-worker")
    local all_running=true
    
    for service in "${services[@]}"; do
        if test_docker_service "$service"; then
            print_color $GREEN "✅ $service is running"
        else
            print_color $RED "❌ $service is not running"
            all_running=false
        fi
    done
    
    [[ $all_running == true ]]
}

function start_document_processing() {
    print_color $CYAN "🚀 Starting document processing services..."
    
    if docker-compose -f docker-compose.simplified.yml up -d; then
        print_color $GREEN "✅ Document processing services started"
        
        # Wait for services to be ready
        print_color $YELLOW "⏳ Waiting for services to be ready..."
        sleep 10
        
        test_document_processing_services
    else
        print_color $RED "❌ Failed to start document processing services"
        return 1
    fi
}

function test_document_upload_directory() {
    local upload_dir="./data/unstructured/input"
    
    if [[ ! -d "$upload_dir" ]]; then
        print_color $YELLOW "📁 Creating upload directory: $upload_dir"
        mkdir -p "$upload_dir"
    fi
    
    if [[ -d "$upload_dir" ]]; then
        print_color $GREEN "✅ Upload directory exists: $upload_dir"
        return 0
    else
        print_color $RED "❌ Failed to create upload directory"
        return 1
    fi
}

function show_document_processing_status() {
    print_color $CYAN "\n📊 Document Processing Status:"
    print_color $CYAN "================================"
    
    # Check services
    if test_docker_service "postgres"; then
        print_color $GREEN "🗄️  PostgreSQL (pgvector): ✅ Running"
    else
        print_color $RED "🗄️  PostgreSQL (pgvector): ❌ Not running"
    fi
    
    if test_docker_service "rabbitmq"; then
        print_color $GREEN "🐰 RabbitMQ: ✅ Running"
    else
        print_color $RED "🐰 RabbitMQ: ❌ Not running"
    fi
    
    if test_docker_service "unstructured-worker"; then
        print_color $GREEN "🔧 Unstructured Worker: ✅ Running"
    else
        print_color $RED "🔧 Unstructured Worker: ❌ Not running"
    fi
    
    if test_docker_service "athenai-app"; then
        print_color $GREEN "🤖 AthenAI App: ✅ Running"
    else
        print_color $RED "🤖 AthenAI App: ❌ Not running"
    fi
    
    print_color $CYAN "\n🔗 Service URLs:"
    print_color $YELLOW "• AthenAI: http://localhost:3000"
    print_color $YELLOW "• RabbitMQ Management: http://localhost:15672"
    print_color $YELLOW "• PostgreSQL: localhost:5432"
    echo
}

# Main execution
print_color $CYAN "🚀 AthenAI Document Processing Setup"
print_color $CYAN "====================================="

if [[ $CHECK_ONLY == true ]]; then
    print_color $YELLOW "🔍 Running setup check only..."
else
    print_color $YELLOW "⚙️  Setting up document processing..."
fi

success=true

# Check environment file
if ! test_environment_file; then
    success=false
fi

# Check Python dependencies
if ! test_python_dependencies; then
    success=false
fi

# Check Docker setup
if [[ $SKIP_DOCKER == false ]] && ! test_docker_setup; then
    success=false
fi

# Check upload directory
if ! test_document_upload_directory; then
    success=false
fi

# Start services if not in check-only mode
if [[ $CHECK_ONLY == false ]] && [[ $SKIP_DOCKER == false ]]; then
    if ! test_document_processing_services; then
        print_color $YELLOW "🚀 Starting document processing services..."
        if ! start_document_processing; then
            success=false
        fi
    else
        print_color $GREEN "✅ Document processing services are already running"
    fi
fi

# Show status
show_document_processing_status

if [[ $success == true ]]; then
    print_color $GREEN "\n🎉 Document processing setup completed successfully!"
    print_color $CYAN "📝 Next steps:"
    print_color $YELLOW "1. Update .env with your actual credentials"
    print_color $YELLOW "2. Test document upload via the chat interface"
    print_color $YELLOW "3. Monitor logs: npm run docker:simplified:logs"
else
    print_color $RED "\n❌ Document processing setup encountered errors"
    print_color $YELLOW "📝 Please check the errors above and try again"
    exit 1
fi
