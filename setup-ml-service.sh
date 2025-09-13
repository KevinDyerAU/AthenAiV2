#!/bin/bash
# AthenAI ML Service Setup Script for Unix/Linux/macOS
# This script sets up the PyTorch ML service with all dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
CHECK_ONLY=false
SKIP_PYTHON=false
SKIP_DOCKER=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --skip-python)
            SKIP_PYTHON=true
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
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

function print_color() {
    printf "${2}${1}${NC}\n"
}

function command_exists() {
    command -v "$1" >/dev/null 2>&1
}

function python_package_exists() {
    python3 -c "import $1" 2>/dev/null || python -c "import $1" 2>/dev/null
}

print_color "🚀 AthenAI ML Service Setup" $BLUE
print_color "================================" $BLUE

# Check if running in check-only mode
if [ "$CHECK_ONLY" = true ]; then
    print_color "🔍 Checking ML service setup..." $YELLOW
    
    all_good=true
    
    # Check Python
    if command_exists python3; then
        python_version=$(python3 --version 2>&1)
        print_color "✅ Python: $python_version" $GREEN
    elif command_exists python; then
        python_version=$(python --version 2>&1)
        print_color "✅ Python: $python_version" $GREEN
    else
        print_color "❌ Python not found" $RED
        all_good=false
    fi
    
    # Check pip
    if command_exists pip3 || command_exists pip; then
        print_color "✅ pip available" $GREEN
    else
        print_color "❌ pip not found" $RED
        all_good=false
    fi
    
    # Check Docker
    if command_exists docker; then
        docker_version=$(docker --version 2>&1)
        print_color "✅ Docker: $docker_version" $GREEN
    else
        print_color "❌ Docker not found" $RED
        all_good=false
    fi
    
    # Check Docker Compose
    if command_exists docker-compose; then
        compose_version=$(docker-compose --version 2>&1)
        print_color "✅ Docker Compose: $compose_version" $GREEN
    else
        print_color "❌ Docker Compose not found" $RED
        all_good=false
    fi
    
    # Check ML service directory
    if [ -d "services/ml-service" ]; then
        print_color "✅ ML service directory exists" $GREEN
    else
        print_color "❌ ML service directory not found" $RED
        all_good=false
    fi
    
    # Check requirements.txt
    if [ -f "services/ml-service/requirements.txt" ]; then
        print_color "✅ ML service requirements.txt exists" $GREEN
    else
        print_color "❌ ML service requirements.txt not found" $RED
        all_good=false
    fi
    
    # Check key Python packages
    packages=("torch" "fastapi" "uvicorn" "mlflow" "supabase" "neo4j")
    for package in "${packages[@]}"; do
        if python_package_exists "$package"; then
            print_color "✅ Python package: $package" $GREEN
        else
            print_color "❌ Python package missing: $package" $RED
            all_good=false
        fi
    done
    
    if [ "$all_good" = true ]; then
        print_color "🎉 All ML service dependencies are properly configured!" $GREEN
        exit 0
    else
        print_color "⚠️  Some dependencies are missing. Run without --check-only to install." $YELLOW
        exit 1
    fi
fi

print_color "🔧 Setting up ML service dependencies..." $YELLOW

# Check Python installation
if [ "$SKIP_PYTHON" = false ]; then
    print_color "📦 Checking Python installation..." $BLUE
    
    if command_exists python3; then
        PYTHON_CMD="python3"
        PIP_CMD="pip3"
    elif command_exists python; then
        PYTHON_CMD="python"
        PIP_CMD="pip"
    else
        print_color "❌ Python not found. Please install Python 3.8+ from https://python.org" $RED
        exit 1
    fi
    
    python_version=$($PYTHON_CMD --version 2>&1)
    print_color "✅ Found Python: $python_version" $GREEN
    
    # Check pip
    if ! command_exists $PIP_CMD; then
        print_color "❌ pip not found. Please install pip" $RED
        exit 1
    fi
    
    print_color "✅ pip is available" $GREEN
fi

# Check Docker installation
if [ "$SKIP_DOCKER" = false ]; then
    print_color "🐳 Checking Docker installation..." $BLUE
    
    if ! command_exists docker; then
        print_color "❌ Docker not found. Please install Docker from https://docker.com" $RED
        exit 1
    fi
    
    docker_version=$(docker --version 2>&1)
    print_color "✅ Found Docker: $docker_version" $GREEN
    
    # Check Docker Compose
    if ! command_exists docker-compose; then
        print_color "❌ Docker Compose not found. Please install Docker Compose" $RED
        exit 1
    fi
    
    compose_version=$(docker-compose --version 2>&1)
    print_color "✅ Found Docker Compose: $compose_version" $GREEN
fi

# Check ML service directory
print_color "📁 Checking ML service directory..." $BLUE
if [ ! -d "services/ml-service" ]; then
    print_color "❌ ML service directory not found. Please ensure you're in the AthenAI root directory." $RED
    exit 1
fi
print_color "✅ ML service directory exists" $GREEN

# Install Python dependencies
print_color "📦 Installing Python dependencies..." $BLUE
cd services/ml-service

if [ -f "requirements.txt" ]; then
    print_color "Installing ML service requirements..." $YELLOW
    $PIP_CMD install -r requirements.txt
    print_color "✅ Python dependencies installed successfully" $GREEN
else
    print_color "❌ requirements.txt not found in ML service directory" $RED
    cd ../..
    exit 1
fi

cd ../..

# Create necessary directories
print_color "📁 Creating ML service directories..." $BLUE
directories=(
    "services/ml-service/models"
    "services/ml-service/logs"
    "services/ml-service/data"
    "services/ml-service/experiments"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        print_color "✅ Created directory: $dir" $GREEN
    else
        print_color "✅ Directory exists: $dir" $GREEN
    fi
done

# Check environment file
print_color "⚙️  Checking environment configuration..." $BLUE
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_color "📋 Copying .env.example to .env..." $YELLOW
        cp ".env.example" ".env"
        print_color "✅ Created .env file from template" $GREEN
        print_color "⚠️  Please edit .env file with your ML service configuration" $YELLOW
    else
        print_color "❌ No .env.example found. Please create .env file manually." $RED
    fi
else
    print_color "✅ .env file exists" $GREEN
fi

# Test ML service startup (dry run)
print_color "🧪 Testing ML service configuration..." $BLUE
cd services/ml-service

$PYTHON_CMD -c "
import sys
sys.path.append('.')
try:
    from main import app
    print('✅ FastAPI app imports successfully')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
" && print_color "✅ ML service configuration test passed" $GREEN || {
    print_color "❌ ML service configuration test failed" $RED
    cd ../..
    exit 1
}

cd ../..

# Build Docker images
print_color "🐳 Building ML service Docker images..." $BLUE
if docker-compose build ml-service mlflow; then
    print_color "✅ Docker images built successfully" $GREEN
else
    print_color "❌ Failed to build Docker images" $RED
    print_color "⚠️  You can still run the ML service locally with: npm run ml:service" $YELLOW
fi

echo ""
print_color "🎉 ML Service Setup Complete!" $GREEN
print_color "================================" $GREEN
echo ""
print_color "Next steps:" $BLUE
print_color "1. Edit .env file with your ML service configuration" $YELLOW
print_color "2. Initialize ML database: npm run ml:init-db:unix" $YELLOW
print_color "3. Start ML service: npm run ml:service" $YELLOW
print_color "4. Or use Docker: npm run docker:ml" $YELLOW
print_color "5. Test ML service: npm run ml:test:unix" $YELLOW
echo ""
print_color "ML Service will be available at: http://localhost:8001" $BLUE
print_color "MLflow UI will be available at: http://localhost:5000" $BLUE
echo ""
print_color "For more information, see NEXT_STEPS_GUIDE.md" $BLUE
