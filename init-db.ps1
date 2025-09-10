# AthenAI Database Initialization Script (Simplified) - PowerShell Version
# This script initializes PostgreSQL and Neo4j databases for local development

param(
    [switch]$SkipDependencies,
    [switch]$SkipTests
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

Write-ColorOutput "🚀 Initializing AthenAI databases..." "Green"

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-ColorOutput "⚠️  No .env file found. Creating from .env.simplified.example..." "Yellow"
    if (Test-Path ".env.simplified.example") {
        Copy-Item ".env.simplified.example" ".env"
        Write-ColorOutput "✅ Created .env file. Please update it with your credentials." "Green"
    } else {
        Write-ColorOutput "❌ .env.simplified.example not found. Please create .env manually." "Red"
        exit 1
    }
}

# Load environment variables from .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

Write-ColorOutput "📋 Configuration loaded:" "Blue"
Write-ColorOutput "  - Node Environment: $($env:NODE_ENV ?? 'development')" "White"
Write-ColorOutput "  - Port: $($env:PORT ?? '3000')" "White"
Write-ColorOutput "  - App Name: $($env:APP_NAME ?? 'athenai')" "White"

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

# Function to check PostgreSQL connection
function Test-PostgresConfig {
    Write-ColorOutput "🔍 Checking PostgreSQL connection..." "Blue"
    
    if ([string]::IsNullOrEmpty($env:SUPABASE_URL) -or $env:SUPABASE_URL -eq "https://your-project.supabase.co") {
        Write-ColorOutput "⚠️  Supabase URL not configured. Skipping PostgreSQL initialization." "Yellow"
        Write-ColorOutput "   Please update SUPABASE_URL in your .env file." "White"
        return $false
    }
    
    Write-ColorOutput "✅ Supabase configuration found." "Green"
    return $true
}

# Function to check Neo4j connection
function Test-Neo4jConfig {
    Write-ColorOutput "🔍 Checking Neo4j connection..." "Blue"
    
    if ([string]::IsNullOrEmpty($env:NEO4J_URI) -or $env:NEO4J_URI -eq "neo4j+s://your-instance.databases.neo4j.io") {
        Write-ColorOutput "⚠️  Neo4j URI not configured. Skipping Neo4j initialization." "Yellow"
        Write-ColorOutput "   Please update NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD in your .env file." "White"
        return $false
    }
    
    Write-ColorOutput "✅ Neo4j configuration found." "Green"
    return $true
}

# Function to initialize PostgreSQL schema
function Initialize-PostgresSchema {
    Write-ColorOutput "🐘 Initializing PostgreSQL schema..." "Blue"
    
    if (-not (Test-Path "db\postgres\schema.sql")) {
        Write-ColorOutput "❌ PostgreSQL schema file not found at db\postgres\schema.sql" "Red"
        return $false
    }
    
    Write-ColorOutput "✅ PostgreSQL schema file found." "Green"
    Write-ColorOutput "📝 Note: Please run the schema manually in your Supabase SQL editor:" "Yellow"
    Write-ColorOutput "   1. Open your Supabase dashboard" "White"
    Write-ColorOutput "   2. Go to SQL Editor" "White"
    Write-ColorOutput "   3. Copy and paste the contents of db\postgres\schema.sql" "White"
    Write-ColorOutput "   4. Run the query" "White"
    
    return $true
}

# Function to initialize Neo4j schema
function Initialize-Neo4jSchema {
    Write-ColorOutput "🕸️  Initializing Neo4j schema..." "Blue"
    
    if (-not (Test-Path "db\neo4j\schema.cypher")) {
        Write-ColorOutput "❌ Neo4j schema file not found at db\neo4j\schema.cypher" "Red"
        return $false
    }
    
    Write-ColorOutput "✅ Neo4j schema file found." "Green"
    Write-ColorOutput "📝 Note: Please run the schema manually in Neo4j Browser:" "Yellow"
    Write-ColorOutput "   1. Open Neo4j Browser at your instance URL" "White"
    Write-ColorOutput "   2. Login with your credentials" "White"
    Write-ColorOutput "   3. Copy and paste the contents of db\neo4j\schema.cypher" "White"
    Write-ColorOutput "   4. Run the query" "White"
    
    return $true
}

# Function to install Node.js dependencies
function Install-Dependencies {
    if ($SkipDependencies) {
        Write-ColorOutput "⏭️  Skipping dependency installation..." "Yellow"
        return $true
    }
    
    Write-ColorOutput "📦 Installing Node.js dependencies..." "Blue"
    
    if (-not (Test-Path "package.json")) {
        Write-ColorOutput "❌ package.json not found" "Red"
        return $false
    }
    
    if (Test-Command "npm") {
        Write-ColorOutput "🔧 Running npm install..." "Blue"
        try {
            npm install
            Write-ColorOutput "✅ Dependencies installed successfully" "Green"
            return $true
        } catch {
            Write-ColorOutput "❌ Failed to install dependencies: $_" "Red"
            return $false
        }
    } else {
        Write-ColorOutput "❌ npm not found. Please install Node.js first." "Red"
        return $false
    }
}

# Function to run database tests
function Test-DatabaseConnections {
    if ($SkipTests) {
        Write-ColorOutput "⏭️  Skipping database tests..." "Yellow"
        return $true
    }
    
    Write-ColorOutput "🧪 Testing database connections..." "Blue"
    
    if (Test-Command "npm") {
        Write-ColorOutput "🔧 Running connection tests..." "Blue"
        try {
            npm test -- --testNamePattern="database" --verbose
        } catch {
            Write-ColorOutput "📝 Note: Some tests may fail if databases are not fully configured." "Yellow"
        }
    } else {
        Write-ColorOutput "⚠️  npm not found. Skipping connection tests." "Yellow"
    }
}

# Main execution
function Main {
    Write-ColorOutput "🎯 Starting AthenAI database initialization..." "Green"
    Write-Host ""
    
    # Install dependencies first
    Install-Dependencies
    Write-Host ""
    
    # Check and initialize PostgreSQL
    if (Test-PostgresConfig) {
        Initialize-PostgresSchema
    }
    Write-Host ""
    
    # Check and initialize Neo4j
    if (Test-Neo4jConfig) {
        Initialize-Neo4jSchema
    }
    Write-Host ""
    
    # Test connections
    Test-DatabaseConnections
    Write-Host ""
    
    Write-ColorOutput "🎉 Database initialization complete!" "Green"
    Write-Host ""
    Write-ColorOutput "📋 Next steps:" "Blue"
    Write-ColorOutput "  1. Update your .env file with actual database credentials" "White"
    Write-ColorOutput "  2. Run the SQL/Cypher schemas in your respective database consoles" "White"
    Write-ColorOutput "  3. Start the application with: npm run dev" "White"
    Write-ColorOutput "  4. Visit http://localhost:3000 to test the application" "White"
    Write-Host ""
    Write-ColorOutput "💡 Tip: Use 'npm test' to verify your setup" "Yellow"
}

# Run main function
Main
