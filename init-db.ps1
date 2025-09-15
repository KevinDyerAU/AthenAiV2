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
Write-ColorOutput "  - Node Environment: $(if ($env:NODE_ENV) { $env:NODE_ENV } else { 'development' })" "White"
Write-ColorOutput "  - Port: $(if ($env:PORT) { $env:PORT } else { '3000' })" "White"
Write-ColorOutput "  - App Name: $(if ($env:APP_NAME) { $env:APP_NAME } else { 'athenai' })" "White"

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
    Write-ColorOutput "🐘 Initializing PostgreSQL knowledge substrate..." "Blue"
    
    $schemaFiles = @(
        "db\supabase\functions.sql",
        "db\supabase\knowledge_search_functions.sql",
        "db\supabase\healing_insights_schema.sql"
    )
    
    $foundSchema = $false
    foreach ($file in $schemaFiles) {
        if (Test-Path $file) {
            Write-ColorOutput "✅ PostgreSQL schema file found: $file" "Green"
            Write-ColorOutput "📝 Please run the schema manually in your Supabase SQL editor:" "Yellow"
            Write-ColorOutput "   1. Open your Supabase dashboard" "White"
            Write-ColorOutput "   2. Go to SQL Editor" "White"
            Write-ColorOutput "   3. Copy and paste the contents of $file" "White"
            Write-ColorOutput "   4. Run the query" "White"
            $foundSchema = $true
            break
        }
    }
    
    if (-not $foundSchema) {
        Write-ColorOutput "❌ No PostgreSQL schema files found. Expected:" "Red"
        Write-ColorOutput "   - db\supabase\functions.sql" "White"
        Write-ColorOutput "   - db\supabase\knowledge_search_functions.sql" "White"
        Write-ColorOutput "   - db\supabase\healing_insights_schema.sql" "White"
        return $false
    }
    
    return $true
}

# Function to initialize Neo4j schema
function Initialize-Neo4jSchema {
    Write-ColorOutput "🕸️  Initializing Neo4j knowledge substrate..." "Blue"
    
    $schemaFiles = @(
        "db/neo4j/advanced_schema.cypher",
        "db/neo4j/knowledge_search_index.cypher",
        "db/neo4j/ml_schema.cypher"
    )
    
    $foundSchema = $false
    foreach ($file in $schemaFiles) {
        if (Test-Path $file) {
            Write-ColorOutput "✅ Neo4j schema file found: $file" "Green"
            Write-ColorOutput "📝 Please run the schema manually in Neo4j Browser:" "Yellow"
            Write-ColorOutput "   1. Open Neo4j Browser at your instance URL" "White"
            Write-ColorOutput "   2. Login with your credentials" "White"
            Write-ColorOutput "   3. Copy and paste the contents of $file" "White"
            Write-ColorOutput "   4. Run the query" "White"
            $foundSchema = $true
            break
        }
    }
    
    if (-not $foundSchema) {
        Write-ColorOutput "❌ No Neo4j schema files found. Expected:" "Red"
        Write-ColorOutput "   - db/neo4j/advanced_schema.cypher (main schema)" "White"
        Write-ColorOutput "   - db/neo4j/knowledge_search_index.cypher (search indexes)" "White"
        Write-ColorOutput "   - db/neo4j/ml_schema.cypher (ML extensions)" "White"
        return $false
    }
    
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
    Write-ColorOutput "  2. Run the knowledge substrate schemas in your database consoles:" "White"
    Write-ColorOutput "     - Supabase: db\supabase\functions.sql" "White"
    Write-ColorOutput "     - Neo4j: db\neo4j\advanced_schema.cypher" "White"
    Write-ColorOutput "  3. Start the application with: npm run dev" "White"
    Write-ColorOutput "  4. Visit http://localhost:3000 to test the application" "White"
    Write-ColorOutput "  5. Check http://localhost:3000/chat.html for AI chat interface" "White"
    Write-Host ""
    Write-ColorOutput "💡 Tip: Use 'npm test' to verify your setup" "Yellow"
    Write-ColorOutput "📚 See KNOWLEDGE_SUBSTRATE_README.md for detailed setup guide" "Yellow"
}

# Run main function
Main
