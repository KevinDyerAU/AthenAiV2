# AthenAI Document Processing Setup Script for Windows
# This script sets up document processing with pgvector, RabbitMQ, and unstructured.io

param(
    [switch]$CheckOnly = $false,
    [switch]$SkipDocker = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"

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

function Test-DockerService {
    param([string]$ServiceName)
    try {
        $result = docker-compose -f docker-compose.simplified.yml ps --services --filter "status=running" 2>$null
        return $result -contains $ServiceName
    } catch {
        return $false
    }
}

function Test-EnvironmentFile {
    if (-not (Test-Path ".env")) {
        Write-ColorOutput "❌ .env file not found" $Red
        Write-ColorOutput "📝 Creating .env from .env.simplified.example..." $Yellow
        
        if (Test-Path ".env.simplified.example") {
            Copy-Item ".env.simplified.example" ".env"
            Write-ColorOutput "✅ .env file created from template" $Green
            Write-ColorOutput "⚠️  Please update .env with your actual credentials" $Yellow
            return $false
        } else {
            Write-ColorOutput "❌ .env.simplified.example not found" $Red
            return $false
        }
    }
    return $true
}

function Test-PythonDependencies {
    Write-ColorOutput "🐍 Checking Python dependencies..." $Cyan
    
    if (-not (Test-Command "python")) {
        Write-ColorOutput "❌ Python not found" $Red
        return $false
    }
    
    $pythonVersion = python --version 2>&1
    Write-ColorOutput "📦 Python version: $pythonVersion" $Cyan
    
    if (Test-Path "requirements-unstructured.txt") {
        try {
            $missingPackages = @()
            $requirements = Get-Content "requirements-unstructured.txt" | Where-Object { $_ -and -not $_.StartsWith("#") }
            
            foreach ($req in $requirements) {
                $package = ($req -split "==|>=|<=|>|<|~=")[0].Trim()
                $checkResult = python -c "import $($package.Replace('-', '_'))" 2>$null
                if ($LASTEXITCODE -ne 0) {
                    $missingPackages += $package
                }
            }
            
            if ($missingPackages.Count -gt 0) {
                Write-ColorOutput "❌ Missing Python packages: $($missingPackages -join ', ')" $Red
                if (-not $CheckOnly) {
                    Write-ColorOutput "📦 Installing missing packages..." $Yellow
                    pip install -r requirements-unstructured.txt
                    if ($LASTEXITCODE -eq 0) {
                        Write-ColorOutput "✅ Python dependencies installed" $Green
                    } else {
                        Write-ColorOutput "❌ Failed to install Python dependencies" $Red
                        return $false
                    }
                }
            } else {
                Write-ColorOutput "✅ All Python dependencies are installed" $Green
            }
        } catch {
            Write-ColorOutput "❌ Error checking Python dependencies: $($_.Exception.Message)" $Red
            return $false
        }
    } else {
        Write-ColorOutput "❌ requirements-unstructured.txt not found" $Red
        return $false
    }
    
    return $true
}

function Test-DockerSetup {
    Write-ColorOutput "🐳 Checking Docker setup..." $Cyan
    
    if (-not (Test-Command "docker")) {
        Write-ColorOutput "❌ Docker not found" $Red
        return $false
    }
    
    if (-not (Test-Command "docker-compose")) {
        Write-ColorOutput "❌ Docker Compose not found" $Red
        return $false
    }
    
    try {
        docker info | Out-Null
        Write-ColorOutput "✅ Docker is running" $Green
    } catch {
        Write-ColorOutput "❌ Docker is not running" $Red
        return $false
    }
    
    if (-not (Test-Path "docker-compose.simplified.yml")) {
        Write-ColorOutput "❌ docker-compose.simplified.yml not found" $Red
        return $false
    }
    
    Write-ColorOutput "✅ Docker setup is ready" $Green
    return $true
}

function Test-DocumentProcessingServices {
    Write-ColorOutput "📄 Checking document processing services..." $Cyan
    
    $services = @("postgres", "rabbitmq", "unstructured-worker")
    $allRunning = $true
    
    foreach ($service in $services) {
        if (Test-DockerService $service) {
            Write-ColorOutput "✅ $service is running" $Green
        } else {
            Write-ColorOutput "❌ $service is not running" $Red
            $allRunning = $false
        }
    }
    
    return $allRunning
}

function Start-DocumentProcessing {
    Write-ColorOutput "🚀 Starting document processing services..." $Cyan
    
    try {
        docker-compose -f docker-compose.simplified.yml up -d
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Document processing services started" $Green
            
            # Wait for services to be ready
            Write-ColorOutput "⏳ Waiting for services to be ready..." $Yellow
            Start-Sleep -Seconds 10
            
            return Test-DocumentProcessingServices
        } else {
            Write-ColorOutput "❌ Failed to start document processing services" $Red
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Error starting services: $($_.Exception.Message)" $Red
        return $false
    }
}

function Test-DocumentUploadDirectory {
    $uploadDir = "./data/unstructured/input"
    
    if (-not (Test-Path $uploadDir)) {
        Write-ColorOutput "📁 Creating upload directory: $uploadDir" $Yellow
        New-Item -ItemType Directory -Path $uploadDir -Force | Out-Null
    }
    
    if (Test-Path $uploadDir) {
        Write-ColorOutput "✅ Upload directory exists: $uploadDir" $Green
        return $true
    } else {
        Write-ColorOutput "❌ Failed to create upload directory" $Red
        return $false
    }
}

function Show-DocumentProcessingStatus {
    Write-ColorOutput "`n📊 Document Processing Status:" $Cyan
    Write-ColorOutput "================================" $Cyan
    
    # Check services
    if (Test-DockerService "postgres") {
        Write-ColorOutput "🗄️  PostgreSQL (pgvector): ✅ Running" $Green
    } else {
        Write-ColorOutput "🗄️  PostgreSQL (pgvector): ❌ Not running" $Red
    }
    
    if (Test-DockerService "rabbitmq") {
        Write-ColorOutput "🐰 RabbitMQ: ✅ Running" $Green
    } else {
        Write-ColorOutput "🐰 RabbitMQ: ❌ Not running" $Red
    }
    
    if (Test-DockerService "unstructured-worker") {
        Write-ColorOutput "🔧 Unstructured Worker: ✅ Running" $Green
    } else {
        Write-ColorOutput "🔧 Unstructured Worker: ❌ Not running" $Red
    }
    
    if (Test-DockerService "athenai-app") {
        Write-ColorOutput "🤖 AthenAI App: ✅ Running" $Green
    } else {
        Write-ColorOutput "🤖 AthenAI App: ❌ Not running" $Red
    }
    
    Write-ColorOutput "`n🔗 Service URLs:" $Cyan
    Write-ColorOutput "• AthenAI: http://localhost:3000" $Yellow
    Write-ColorOutput "• RabbitMQ Management: http://localhost:15672" $Yellow
    Write-ColorOutput "• PostgreSQL: localhost:5432" $Yellow
    Write-ColorOutput "`n"
}

# Main execution
Write-ColorOutput "🚀 AthenAI Document Processing Setup" $Cyan
Write-ColorOutput "=====================================" $Cyan

if ($CheckOnly) {
    Write-ColorOutput "🔍 Running setup check only..." $Yellow
} else {
    Write-ColorOutput "⚙️  Setting up document processing..." $Yellow
}

$success = $true

# Check environment file
if (-not (Test-EnvironmentFile)) {
    $success = $false
}

# Check Python dependencies
if (-not (Test-PythonDependencies)) {
    $success = $false
}

# Check Docker setup
if (-not $SkipDocker -and -not (Test-DockerSetup)) {
    $success = $false
}

# Check upload directory
if (-not (Test-DocumentUploadDirectory)) {
    $success = $false
}

# Start services if not in check-only mode
if (-not $CheckOnly -and -not $SkipDocker) {
    if (-not (Test-DocumentProcessingServices)) {
        Write-ColorOutput "🚀 Starting document processing services..." $Yellow
        if (-not (Start-DocumentProcessing)) {
            $success = $false
        }
    } else {
        Write-ColorOutput "✅ Document processing services are already running" $Green
    }
}

# Show status
Show-DocumentProcessingStatus

if ($success) {
    Write-ColorOutput "`n🎉 Document processing setup completed successfully!" $Green
    Write-ColorOutput "📝 Next steps:" $Cyan
    Write-ColorOutput "1. Update .env with your actual credentials" $Yellow
    Write-ColorOutput "2. Test document upload via the chat interface" $Yellow
    Write-ColorOutput "3. Monitor logs: npm run docker:simplified:logs" $Yellow
} else {
    Write-ColorOutput "`n❌ Document processing setup encountered errors" $Red
    Write-ColorOutput "📝 Please check the errors above and try again" $Yellow
    exit 1
}
