# AthenAI ML Service Setup Script for Windows
# This script sets up the PyTorch ML service with all dependencies

param(
    [switch]$CheckOnly,
    [switch]$SkipPython,
    [switch]$SkipDocker,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Test-PythonPackage {
    param([string]$Package)
    try {
        python -c "import $Package" 2>$null
        return $true
    } catch {
        return $false
    }
}

Write-ColorOutput "🚀 AthenAI ML Service Setup" $Blue
Write-ColorOutput "================================" $Blue

# Check if running in check-only mode
if ($CheckOnly) {
    Write-ColorOutput "🔍 Checking ML service setup..." $Yellow
    
    $allGood = $true
    
    # Check Python
    if (Test-Command "python") {
        $pythonVersion = python --version 2>&1
        Write-ColorOutput "✅ Python: $pythonVersion" $Green
    } else {
        Write-ColorOutput "❌ Python not found" $Red
        $allGood = $false
    }
    
    # Check pip
    if (Test-Command "pip") {
        Write-ColorOutput "✅ pip available" $Green
    } else {
        Write-ColorOutput "❌ pip not found" $Red
        $allGood = $false
    }
    
    # Check Docker
    if (Test-Command "docker") {
        $dockerVersion = docker --version 2>&1
        Write-ColorOutput "✅ Docker: $dockerVersion" $Green
    } else {
        Write-ColorOutput "❌ Docker not found" $Red
        $allGood = $false
    }
    
    # Check Docker Compose
    if (Test-Command "docker-compose") {
        $composeVersion = docker-compose --version 2>&1
        Write-ColorOutput "✅ Docker Compose: $composeVersion" $Green
    } else {
        Write-ColorOutput "❌ Docker Compose not found" $Red
        $allGood = $false
    }
    
    # Check ML service directory
    if (Test-Path "services/ml-service") {
        Write-ColorOutput "✅ ML service directory exists" $Green
    } else {
        Write-ColorOutput "❌ ML service directory not found" $Red
        $allGood = $false
    }
    
    # Check requirements.txt
    if (Test-Path "services/ml-service/requirements.txt") {
        Write-ColorOutput "✅ ML service requirements.txt exists" $Green
    } else {
        Write-ColorOutput "❌ ML service requirements.txt not found" $Red
        $allGood = $false
    }
    
    # Check key Python packages
    $packages = @("torch", "fastapi", "uvicorn", "mlflow", "supabase", "neo4j")
    foreach ($package in $packages) {
        if (Test-PythonPackage $package) {
            Write-ColorOutput "✅ Python package: $package" $Green
        } else {
            Write-ColorOutput "❌ Python package missing: $package" $Red
            $allGood = $false
        }
    }
    
    if ($allGood) {
        Write-ColorOutput "🎉 All ML service dependencies are properly configured!" $Green
        exit 0
    } else {
        Write-ColorOutput "⚠️  Some dependencies are missing. Run without -CheckOnly to install." $Yellow
        exit 1
    }
}

Write-ColorOutput "🔧 Setting up ML service dependencies..." $Yellow

# Check Python installation
if (-not $SkipPython) {
    Write-ColorOutput "📦 Checking Python installation..." $Blue
    
    if (-not (Test-Command "python")) {
        Write-ColorOutput "❌ Python not found. Please install Python 3.8+ from https://python.org" $Red
        exit 1
    }
    
    $pythonVersion = python --version 2>&1
    Write-ColorOutput "✅ Found Python: $pythonVersion" $Green
    
    # Check pip
    if (-not (Test-Command "pip")) {
        Write-ColorOutput "❌ pip not found. Please install pip" $Red
        exit 1
    }
    
    Write-ColorOutput "✅ pip is available" $Green
}

# Check Docker installation
if (-not $SkipDocker) {
    Write-ColorOutput "🐳 Checking Docker installation..." $Blue
    
    if (-not (Test-Command "docker")) {
        Write-ColorOutput "❌ Docker not found. Please install Docker Desktop from https://docker.com" $Red
        exit 1
    }
    
    $dockerVersion = docker --version 2>&1
    Write-ColorOutput "✅ Found Docker: $dockerVersion" $Green
    
    # Check Docker Compose
    if (-not (Test-Command "docker-compose")) {
        Write-ColorOutput "❌ Docker Compose not found. Please install Docker Compose" $Red
        exit 1
    }
    
    $composeVersion = docker-compose --version 2>&1
    Write-ColorOutput "✅ Found Docker Compose: $composeVersion" $Green
}

# Create ML service directory if it doesn't exist
Write-ColorOutput "📁 Checking ML service directory..." $Blue
if (-not (Test-Path "services/ml-service")) {
    Write-ColorOutput "❌ ML service directory not found. Please ensure you're in the AthenAI root directory." $Red
    exit 1
}
Write-ColorOutput "✅ ML service directory exists" $Green

# Install Python dependencies
Write-ColorOutput "📦 Installing Python dependencies..." $Blue
try {
    Set-Location "services/ml-service"
    
    if (Test-Path "requirements.txt") {
        Write-ColorOutput "Installing ML service requirements..." $Yellow
        pip install -r requirements.txt
        Write-ColorOutput "✅ Python dependencies installed successfully" $Green
    } else {
        Write-ColorOutput "❌ requirements.txt not found in ML service directory" $Red
        Set-Location "../.."
        exit 1
    }
    
    Set-Location "../.."
} catch {
    Write-ColorOutput "❌ Failed to install Python dependencies: $_" $Red
    Set-Location "../.."
    exit 1
}

# Create necessary directories
Write-ColorOutput "📁 Creating ML service directories..." $Blue
$directories = @(
    "services/ml-service/models",
    "services/ml-service/logs",
    "services/ml-service/data",
    "services/ml-service/experiments"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-ColorOutput "✅ Created directory: $dir" $Green
    } else {
        Write-ColorOutput "✅ Directory exists: $dir" $Green
    }
}

# Check environment file
Write-ColorOutput "⚙️  Checking environment configuration..." $Blue
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-ColorOutput "📋 Copying .env.example to .env..." $Yellow
        Copy-Item ".env.example" ".env"
        Write-ColorOutput "✅ Created .env file from template" $Green
        Write-ColorOutput "⚠️  Please edit .env file with your ML service configuration" $Yellow
    } else {
        Write-ColorOutput "❌ No .env.example found. Please create .env file manually." $Red
    }
} else {
    Write-ColorOutput "✅ .env file exists" $Green
}

# Test ML service startup (dry run)
Write-ColorOutput "🧪 Testing ML service configuration..." $Blue
try {
    Set-Location "services/ml-service"
    
    # Test import of main modules
    python -c "
import sys
sys.path.append('.')
try:
    from main import app
    print('✅ FastAPI app imports successfully')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
"
    
    Write-ColorOutput "✅ ML service configuration test passed" $Green
    Set-Location "../.."
} catch {
    Write-ColorOutput "❌ ML service configuration test failed: $_" $Red
    Set-Location "../.."
    exit 1
}

# Build Docker images
Write-ColorOutput "🐳 Building ML service Docker images..." $Blue
try {
    docker-compose build ml-service mlflow
    Write-ColorOutput "✅ Docker images built successfully" $Green
} catch {
    Write-ColorOutput "❌ Failed to build Docker images: $_" $Red
    Write-ColorOutput "⚠️  You can still run the ML service locally with: npm run ml:service" $Yellow
}

Write-ColorOutput "" 
Write-ColorOutput "🎉 ML Service Setup Complete!" $Green
Write-ColorOutput "================================" $Green
Write-ColorOutput ""
Write-ColorOutput "Next steps:" $Blue
Write-ColorOutput "1. Edit .env file with your ML service configuration" $Yellow
Write-ColorOutput "2. Initialize ML database: npm run ml:init-db:win" $Yellow
Write-ColorOutput "3. Start ML service: npm run ml:service" $Yellow
Write-ColorOutput "4. Or use Docker: npm run docker:ml" $Yellow
Write-ColorOutput "5. Test ML service: npm run ml:test:win" $Yellow
Write-ColorOutput ""
Write-ColorOutput "ML Service will be available at: http://localhost:8001" $Blue
Write-ColorOutput "MLflow UI will be available at: http://localhost:5000" $Blue
Write-ColorOutput ""
Write-ColorOutput "For more information, see NEXT_STEPS_GUIDE.md" $Blue
