# Neo4j Schema Execution Script for AthenAI
# This script runs the Neo4j knowledge substrate schema

param(
    [string]$Neo4jUri = $env:NEO4J_URI,
    [string]$Neo4jUser = $env:NEO4J_USER,
    [string]$Neo4jPassword = $env:NEO4J_PASSWORD,
    [string]$SchemaFile = "db\neo4j\advanced_schema.cypher"
)

# Check if Neo4j environment variables are set
if (-not $Neo4jUri) {
    Write-Host "Error: NEO4J_URI environment variable not set" -ForegroundColor Red
    Write-Host "Please set: NEO4J_URI=bolt://localhost:7687 (or your Neo4j URI)" -ForegroundColor Yellow
    exit 1
}

if (-not $Neo4jUser) {
    Write-Host "Error: NEO4J_USER environment variable not set" -ForegroundColor Red
    Write-Host "Please set: NEO4J_USER=neo4j (or your username)" -ForegroundColor Yellow
    exit 1
}

if (-not $Neo4jPassword) {
    Write-Host "Error: NEO4J_PASSWORD environment variable not set" -ForegroundColor Red
    Write-Host "Please set: NEO4J_PASSWORD=your_password" -ForegroundColor Yellow
    exit 1
}

# Check if schema file exists
if (-not (Test-Path $SchemaFile)) {
    Write-Host "Error: Schema file not found: $SchemaFile" -ForegroundColor Red
    exit 1
}

Write-Host "Running Neo4j Knowledge Substrate Schema..." -ForegroundColor Green
Write-Host "URI: $Neo4jUri" -ForegroundColor Cyan
Write-Host "User: $Neo4jUser" -ForegroundColor Cyan
Write-Host "Schema: $SchemaFile" -ForegroundColor Cyan

try {
    # Check if cypher-shell is available
    $cypherShell = Get-Command cypher-shell -ErrorAction SilentlyContinue
    
    if ($cypherShell) {
        Write-Host "Using cypher-shell..." -ForegroundColor Yellow
        cypher-shell -a $Neo4jUri -u $Neo4jUser -p $Neo4jPassword -f $SchemaFile
    } else {
        Write-Host "cypher-shell not found. Trying alternative methods..." -ForegroundColor Yellow
        
        # Try using neo4j-admin if available
        $neo4jAdmin = Get-Command neo4j-admin -ErrorAction SilentlyContinue
        if ($neo4jAdmin) {
            Write-Host "Using neo4j-admin..." -ForegroundColor Yellow
            neo4j-admin database import full --nodes=$SchemaFile
        } else {
            Write-Host "Neo4j command line tools not found." -ForegroundColor Red
            Write-Host "Please install Neo4j Desktop or Neo4j Server with command line tools." -ForegroundColor Yellow
            Write-Host "Alternative: Copy the contents of $SchemaFile and paste into Neo4j Browser" -ForegroundColor Yellow
            exit 1
        }
    }
    
    Write-Host "Neo4j schema execution completed successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "Error executing Neo4j schema: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
