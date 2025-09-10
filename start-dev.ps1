# AthenAI Simplified Startup Script - PowerShell Version
# Simplified version of deploy-local.sh for basic local development

param(
    [switch]$Dev,
    [switch]$Check,
    [switch]$Start,
    [switch]$Help
)

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green" 
    Yellow = "Yellow"
    Blue = "Cyan"
    White = "White"
}

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Colors[$Color]
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-ColorOutput $logMessage "Blue"
    Add-Content -Path "startup.log" -Value $logMessage
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "[INFO] $Message" "Blue"
    Add-Content -Path "startup.log" -Value "[INFO] $Message"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[SUCCESS] $Message" "Green"
    Add-Content -Path "startup.log" -Value "[SUCCESS] $Message"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[WARN] $Message" "Yellow"
    Add-Content -Path "startup.log" -Value "[WARN] $Message"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[ERROR] $Message" "Red"
    Add-Content -Path "startup.log" -Value "[ERROR] $Message"
    exit 1
}

function Show-Usage {
    Write-Host @"
AthenAI Simplified Startup & Initialization

Usage: .\start-dev.ps1 [-Dev] [-Check] [-Start] [-Help]

Options:
  -Dev      Development mode: install deps, setup env, start server
  -Check    Check configuration and dependencies only
  -Start    Start the application server
  -Help     Show this help and exit

Phases:
  1) Environment setup and validation
  2) Dependency installation
  3) Database configuration guidance
  4) Application startup
"@
}

# Show help if requested
if ($Help) {
    Show-Usage
    exit 0
}

# Function to check if a command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Ensure .env file exists
function Ensure-EnvFile {
    if (Test-Path ".env") {
        Write-Log ".env found"
        return
    }
    
    if (Test-Path ".env.simplified.example") {
        Copy-Item ".env.simplified.example" ".env"
        Write-Warning "Created .env from .env.simplified.example. Review secrets before first run"
        return
    }
    
    Write-Error "No .env found. Add .env file first."
}

# Generate a simple secret
function New-Secret {
    param([int]$Length = 32)
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&@"
    $secret = ""
    for ($i = 0; $i -lt $Length; $i++) {
        $secret += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $secret
}

# Set env var if missing
function Set-EnvIfMissing {
    param([string]$Key, [string]$Value)
    
    $content = Get-Content ".env" -ErrorAction SilentlyContinue
    if ($content -match "^\s*$Key\s*=") {
        return
    }
    
    Add-Content -Path ".env" -Value "$Key=$Value"
    Write-Log "Initialized $Key in .env"
}

# Read a key's value from .env
function Get-DotEnvValue {
    param([string]$Key)
    
    if (-not (Test-Path ".env")) {
        return ""
    }
    
    $content = Get-Content ".env" -ErrorAction SilentlyContinue
    $line = $content | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
    
    if (-not $line) {
        return ""
    }
    
    $value = $line -replace "^\s*$Key\s*=", ""
    $value = $value.Trim()
    
    # Remove quotes if present
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    
    return $value
}

# Check PostgreSQL configuration
function Test-PostgresConfig {
    Write-Info "🔍 Checking PostgreSQL configuration..."
    
    $supabaseUrl = Get-DotEnvValue "SUPABASE_URL"
    
    if ([string]::IsNullOrEmpty($supabaseUrl) -or $supabaseUrl -eq "https://your-project.supabase.co") {
        Write-Warning "⚠️  Supabase URL not configured. Please update SUPABASE_URL in your .env file."
        return $false
    }
    
    Write-Success "✅ Supabase configuration found."
    return $true
}

# Check Neo4j configuration
function Test-Neo4jConfig {
    Write-Info "🔍 Checking Neo4j configuration..."
    
    $neo4jUri = Get-DotEnvValue "NEO4J_URI"
    
    if ([string]::IsNullOrEmpty($neo4jUri) -or $neo4jUri -eq "neo4j+s://your-instance.databases.neo4j.io") {
        Write-Warning "⚠️  Neo4j URI not configured. Please update NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD in your .env file."
        return $false
    }
    
    Write-Success "✅ Neo4j configuration found."
    return $true
}

# Initialize PostgreSQL schema
function Initialize-PostgresSchema {
    Write-Info "🐘 Initializing PostgreSQL schema..."
    
    if (-not (Test-Path "db\postgres\schema.sql")) {
        Write-Error "❌ PostgreSQL schema file not found at db\postgres\schema.sql"
        return $false
    }
    
    Write-Success "✅ PostgreSQL schema file found."
    Write-Warning "📝 Note: Please run the schema manually in your Supabase SQL editor:"
    Write-Info "   1. Open your Supabase dashboard"
    Write-Info "   2. Go to SQL Editor"
    Write-Info "   3. Copy and paste the contents of db\postgres\schema.sql"
    Write-Info "   4. Run the query"
    
    return $true
}

# Initialize Neo4j schema
function Initialize-Neo4jSchema {
    Write-Info "🕸️  Initializing Neo4j schema..."
    
    if (-not (Test-Path "db\neo4j\schema.cypher")) {
        Write-Error "❌ Neo4j schema file not found at db\neo4j\schema.cypher"
        return $false
    }
    
    Write-Success "✅ Neo4j schema file found."
    Write-Warning "📝 Note: Please run the schema manually in Neo4j Browser:"
    Write-Info "   1. Open Neo4j Browser at your instance URL"
    Write-Info "   2. Login with your credentials"
    Write-Info "   3. Copy and paste the contents of db\neo4j\schema.cypher"
    Write-Info "   4. Run the query"
    
    return $true
}

# Install Node.js dependencies
function Install-Dependencies {
    Write-Info "📦 Installing Node.js dependencies..."
    
    if (-not (Test-Path "package.json")) {
        Write-Error "❌ package.json not found"
        return $false
    }
    
    if (Test-Command "npm") {
        Write-Info "🔧 Running npm install..."
        try {
            npm install --legacy-peer-deps
            Write-Success "✅ Dependencies installed successfully"
            return $true
        } catch {
            Write-Error "❌ Failed to install dependencies: $_"
            return $false
        }
    } else {
        Write-Error "❌ npm not found. Please install Node.js first."
        return $false
    }
}

# Test database connections
function Test-DatabaseConnections {
    Write-Info "🧪 Testing database connections..."
    
    if (Test-Command "npm") {
        Write-Info "🔧 Running connection tests..."
        try {
            npm test -- --testNamePattern="database" --verbose
        } catch {
            Write-Warning "📝 Note: Some tests may fail if databases are not fully configured."
        }
    } else {
        Write-Warning "⚠️  npm not found. Skipping connection tests."
    }
}

# Start the application server
function Start-Server {
    Write-Info "🚀 Starting AthenAI server..."
    
    $port = Get-DotEnvValue "PORT"
    if ([string]::IsNullOrEmpty($port)) {
        $port = "3000"
    }
    
    if (Test-Command "npm") {
        Write-Info "🔧 Starting server on port $port..."
        Write-Success "🌐 Server will be available at http://localhost:$port"
        npm run dev
    } else {
        Write-Error "❌ npm not found. Please install Node.js first."
        return $false
    }
}

# Check system requirements
function Test-SystemRequirements {
    Write-Info "🔍 Checking system requirements..."
    
    if (-not (Test-Command "node")) {
        Write-Error "❌ Node.js not found. Please install Node.js 18+ first."
        return $false
    }
    
    if (-not (Test-Command "npm")) {
        Write-Error "❌ npm not found. Please install Node.js with npm first."
        return $false
    }
    
    try {
        $nodeVersion = (node --version) -replace 'v', '' -split '\.' | Select-Object -First 1
        if ([int]$nodeVersion -lt 18) {
            Write-Warning "⚠️  Node.js version $nodeVersion detected. Recommend Node.js 18+"
        } else {
            Write-Success "✅ Node.js $(node --version) found"
        }
    } catch {
        Write-Warning "⚠️  Could not determine Node.js version"
    }
    
    Write-Success "✅ System requirements check passed"
    return $true
}

# Ensure basic secrets are set
function Ensure-BasicSecrets {
    Write-Info "🔐 Ensuring basic configuration..."
    
    Set-EnvIfMissing "NODE_ENV" "development"
    Set-EnvIfMissing "PORT" "3000"
    Set-EnvIfMissing "APP_NAME" "athenai"
    
    # Only generate secrets if they don't exist
    $apiSecret = Get-DotEnvValue "API_SECRET_KEY"
    if ([string]::IsNullOrEmpty($apiSecret) -or $apiSecret -eq "your-secret-key") {
        $newSecret = New-Secret -Length 48
        Set-EnvIfMissing "API_SECRET_KEY" $newSecret
        Write-Warning "Generated new API_SECRET_KEY"
    }
    
    Write-Success "✅ Basic configuration ensured"
}

# Main execution
function Main {
    # Clear log file
    if (Test-Path "startup.log") {
        Remove-Item "startup.log"
    }
    
    Write-Log "🎯 Starting AthenAI simplified initialization..."
    
    # Handle different modes
    if ($Check) {
        Test-SystemRequirements
        Ensure-EnvFile
        Test-PostgresConfig | Out-Null
        Test-Neo4jConfig | Out-Null
        Write-Success "Configuration check complete"
        return
    }
    
    if ($Start) {
        Ensure-EnvFile
        Start-Server
        return
    }
    
    # Default or dev mode
    if (-not (Test-SystemRequirements)) {
        return
    }
    
    Ensure-EnvFile
    Ensure-BasicSecrets
    
    if ($Dev) {
        Install-Dependencies
        
        # Check and initialize databases
        if (Test-PostgresConfig) {
            Initialize-PostgresSchema
        }
        
        if (Test-Neo4jConfig) {
            Initialize-Neo4jSchema
        }
        
        Test-DatabaseConnections
        
        Write-Success "🎉 Development setup complete!"
        Write-Info "📋 Next steps:"
        Write-Info "  1. Update your .env file with actual database credentials"
        Write-Info "  2. Run the SQL/Cypher schemas in your respective database consoles"
        Write-Info "  3. Start the application with: .\start-dev.ps1 -Start"
        Write-Info "  4. Visit http://localhost:3000 to test the application"
        Write-Warning "💡 Tip: Use 'npm test' to verify your setup"
    } else {
        # Basic mode - just setup
        Install-Dependencies
        Write-Success "🎉 Basic initialization complete!"
        Write-Info "📋 Use -Dev for full development setup or -Start to run the server"
    }
}

# Run main function
Main
