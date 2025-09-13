# AthenAI ML Database Initialization Script for Windows
# This script initializes the ML service database schema

param(
    [switch]$CheckOnly,
    [switch]$SkipSupabase,
    [switch]$SkipNeo4j,
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

Write-ColorOutput "🗄️  AthenAI ML Database Initialization" $Blue
Write-ColorOutput "======================================" $Blue

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-ColorOutput "❌ .env file not found. Please run setup first." $Red
    exit 1
}

# Load environment variables
Write-ColorOutput "📋 Loading environment variables..." $Blue
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.*)$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Check required environment variables
$requiredVars = @(
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    if (-not [Environment]::GetEnvironmentVariable($var)) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-ColorOutput "❌ Missing required environment variables:" $Red
    foreach ($var in $missingVars) {
        Write-ColorOutput "   - $var" $Red
    }
    Write-ColorOutput "Please update your .env file with the required ML service configuration." $Yellow
    exit 1
}

if ($CheckOnly) {
    Write-ColorOutput "🔍 Checking ML database configuration..." $Yellow
    
    # Check Supabase connection
    if (-not $SkipSupabase) {
        Write-ColorOutput "🔗 Testing Supabase connection..." $Blue
        try {
            $supabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_URL")
            $supabaseKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
            
            $headers = @{
                "apikey" = $supabaseKey
                "Authorization" = "Bearer $supabaseKey"
                "Content-Type" = "application/json"
            }
            
            $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/" -Headers $headers -Method Get
            Write-ColorOutput "✅ Supabase connection successful" $Green
        } catch {
            Write-ColorOutput "❌ Supabase connection failed: $_" $Red
        }
    }
    
    # Check Neo4j connection (if configured)
    if (-not $SkipNeo4j) {
        $neo4jUri = [Environment]::GetEnvironmentVariable("NEO4J_URI")
        if ($neo4jUri) {
            Write-ColorOutput "🔗 Neo4j configured: $neo4jUri" $Green
        } else {
            Write-ColorOutput "⚠️  Neo4j not configured (optional)" $Yellow
        }
    }
    
    Write-ColorOutput "✅ Database configuration check complete" $Green
    exit 0
}

# Initialize Supabase ML schema
if (-not $SkipSupabase) {
    Write-ColorOutput "🗄️  Initializing Supabase ML schema..." $Blue
    
    if (Test-Path "db/supabase/ml_schema.sql") {
        Write-ColorOutput "📄 Found ML schema file" $Green
        Write-ColorOutput "⚠️  Please execute the following SQL in your Supabase SQL Editor:" $Yellow
        Write-ColorOutput ""
        Write-ColorOutput "1. Go to your Supabase project dashboard" $Blue
        Write-ColorOutput "2. Navigate to SQL Editor" $Blue
        Write-ColorOutput "3. Create a new query" $Blue
        Write-ColorOutput "4. Copy and paste the contents of: db/supabase/ml_schema.sql" $Blue
        Write-ColorOutput "5. Execute the query" $Blue
        Write-ColorOutput ""
        Write-ColorOutput "This will create all ML service tables, functions, and indexes." $Yellow
    } else {
        Write-ColorOutput "❌ ML schema file not found: db/supabase/ml_schema.sql" $Red
        exit 1
    }
    
    # Also mention the functions file
    if (Test-Path "db/supabase/functions.sql") {
        Write-ColorOutput "📄 ML functions are included in: db/supabase/functions.sql" $Green
        Write-ColorOutput "   (This includes both core and ML service functions)" $Blue
    }
}

# Initialize Neo4j ML schema (if configured)
if (-not $SkipNeo4j) {
    $neo4jUri = [Environment]::GetEnvironmentVariable("NEO4J_URI")
    if ($neo4jUri) {
        Write-ColorOutput "🗄️  Initializing Neo4j ML schema..." $Blue
        
        if (Test-Path "db/neo4j/ml_schema.cypher") {
            Write-ColorOutput "📄 Found Neo4j ML schema file" $Green
            Write-ColorOutput "⚠️  Please execute the following Cypher in your Neo4j Browser:" $Yellow
            Write-ColorOutput ""
            Write-ColorOutput "1. Open Neo4j Browser: $neo4jUri" $Blue
            Write-ColorOutput "2. Copy and paste the contents of: db/neo4j/ml_schema.cypher" $Blue
            Write-ColorOutput "3. Execute the Cypher commands" $Blue
            Write-ColorOutput ""
            Write-ColorOutput "This will create ML-specific constraints, indexes, and sample queries." $Yellow
        } else {
            Write-ColorOutput "❌ Neo4j ML schema file not found: db/neo4j/ml_schema.cypher" $Red
        }
        
        # Also mention the advanced schema
        if (Test-Path "db/neo4j/advanced_schema.cypher") {
            Write-ColorOutput "📄 Enhanced schema with ML extensions: db/neo4j/advanced_schema.cypher" $Green
            Write-ColorOutput "   (This includes both core and ML service schema)" $Blue
        }
    } else {
        Write-ColorOutput "⚠️  Neo4j not configured. Skipping Neo4j ML schema initialization." $Yellow
        Write-ColorOutput "   Neo4j is optional but recommended for advanced graph operations." $Blue
    }
}

Write-ColorOutput ""
Write-ColorOutput "🎉 ML Database Initialization Guide Complete!" $Green
Write-ColorOutput "=============================================" $Green
Write-ColorOutput ""
Write-ColorOutput "Database Schema Files:" $Blue
Write-ColorOutput "📄 Supabase ML Schema: db/supabase/ml_schema.sql" $Yellow
Write-ColorOutput "📄 Supabase Functions: db/supabase/functions.sql" $Yellow
Write-ColorOutput "📄 Neo4j ML Schema: db/neo4j/ml_schema.cypher" $Yellow
Write-ColorOutput "📄 Neo4j Advanced Schema: db/neo4j/advanced_schema.cypher" $Yellow
Write-ColorOutput ""
Write-ColorOutput "Next steps:" $Blue
Write-ColorOutput "1. Execute the SQL files in your Supabase project" $Yellow
Write-ColorOutput "2. Execute the Cypher files in your Neo4j instance (if using Neo4j)" $Yellow
Write-ColorOutput "3. Test ML service: npm run ml:test:win" $Yellow
Write-ColorOutput "4. Start ML service: npm run ml:service" $Yellow
Write-ColorOutput ""
Write-ColorOutput "For detailed instructions, see NEXT_STEPS_GUIDE.md" $Blue
