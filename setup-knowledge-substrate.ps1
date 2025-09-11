# AthenAI Knowledge Substrate Setup Script
# This script helps set up the complete knowledge substrate for AthenAI

param(
    [switch]$CheckOnly,
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

function Show-Usage {
    Write-Host @"
AthenAI Knowledge Substrate Setup

Usage: .\setup-knowledge-substrate.ps1 [-CheckOnly] [-Help]

Options:
  -CheckOnly    Check configuration and files only (no setup)
  -Help         Show this help and exit

This script will:
  1. Verify knowledge substrate files exist
  2. Check database configurations
  3. Provide setup instructions for Supabase and Neo4j
  4. Validate the knowledge substrate implementation
"@
}

if ($Help) {
    Show-Usage
    exit 0
}

Write-ColorOutput "🧠 AthenAI Knowledge Substrate Setup" "Green"
Write-ColorOutput "=====================================" "Blue"
Write-Host ""

# Check if knowledge substrate files exist
function Test-KnowledgeSubstrateFiles {
    Write-ColorOutput "📁 Checking knowledge substrate files..." "Blue"
    
    $files = @{
        "init-knowledge-substrate.sql" = "Supabase PostgreSQL schema"
        "init-neo4j-knowledge.cypher" = "Neo4j graph database schema"
        "KNOWLEDGE_SUBSTRATE_README.md" = "Documentation"
        "src\services\database.js" = "Database service implementation"
    }
    
    $allFound = $true
    foreach ($file in $files.Keys) {
        if (Test-Path $file) {
            Write-ColorOutput "  ✅ $($files[$file]): $file" "Green"
        } else {
            Write-ColorOutput "  ❌ Missing $($files[$file]): $file" "Red"
            $allFound = $false
        }
    }
    
    return $allFound
}

# Check environment configuration
function Test-EnvironmentConfig {
    Write-ColorOutput "🔧 Checking environment configuration..." "Blue"
    
    if (-not (Test-Path ".env")) {
        Write-ColorOutput "  ❌ .env file not found" "Red"
        return $false
    }
    
    # Load environment variables
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
    
    $configs = @{
        "SUPABASE_URL" = "Supabase database URL"
        "SUPABASE_SERVICE_ROLE_KEY" = "Supabase service role key"
        "NEO4J_URI" = "Neo4j database URI"
        "NEO4J_USER" = "Neo4j username"
        "NEO4J_PASSWORD" = "Neo4j password"
    }
    
    $allConfigured = $true
    foreach ($config in $configs.Keys) {
        $value = [Environment]::GetEnvironmentVariable($config)
        if ([string]::IsNullOrEmpty($value) -or $value.Contains("your-") -or $value.Contains("example")) {
            Write-ColorOutput "  ⚠️  $($configs[$config]) not configured: $config" "Yellow"
            $allConfigured = $false
        } else {
            Write-ColorOutput "  ✅ $($configs[$config]) configured" "Green"
        }
    }
    
    return $allConfigured
}

# Check database service implementation
function Test-DatabaseServiceImplementation {
    Write-ColorOutput "🔍 Checking database service implementation..." "Blue"
    
    if (-not (Test-Path "src\services\database.js")) {
        Write-ColorOutput "  ❌ Database service not found" "Red"
        return $false
    }
    
    $content = Get-Content "src\services\database.js" -Raw
    
    $requiredMethods = @(
        "createKnowledgeEntity",
        "getKnowledgeEntitiesByDomain",
        "storeResearchInsights",
        "getResearchInsightsByQueryHash",
        "storeQAInsights",
        "getQAInsightsByContentHash",
        "storeWebSearchCache",
        "getWebSearchCache"
    )
    
    $allImplemented = $true
    foreach ($method in $requiredMethods) {
        if ($content -match "async\s+$method\s*\(") {
            Write-ColorOutput "  ✅ Method implemented: $method" "Green"
        } else {
            Write-ColorOutput "  ❌ Method missing: $method" "Red"
            $allImplemented = $false
        }
    }
    
    return $allImplemented
}

# Provide setup instructions
function Show-SetupInstructions {
    Write-ColorOutput "📋 Knowledge Substrate Setup Instructions" "Blue"
    Write-ColorOutput "=========================================" "Blue"
    Write-Host ""
    
    Write-ColorOutput "1. Supabase PostgreSQL Setup:" "Yellow"
    Write-ColorOutput "   • Open your Supabase dashboard" "White"
    Write-ColorOutput "   • Navigate to SQL Editor" "White"
    Write-ColorOutput "   • Copy and paste the contents of: init-knowledge-substrate.sql" "White"
    Write-ColorOutput "   • Execute the SQL script" "White"
    Write-Host ""
    
    Write-ColorOutput "2. Neo4j Graph Database Setup:" "Yellow"
    Write-ColorOutput "   • Open Neo4j Browser at your instance URL" "White"
    Write-ColorOutput "   • Login with your credentials" "White"
    Write-ColorOutput "   • Copy and paste the contents of: init-neo4j-knowledge.cypher" "White"
    Write-ColorOutput "   • Execute the Cypher script" "White"
    Write-Host ""
    
    Write-ColorOutput "3. Environment Configuration:" "Yellow"
    Write-ColorOutput "   • Update .env file with your actual database credentials" "White"
    Write-ColorOutput "   • Ensure all required environment variables are set" "White"
    Write-Host ""
    
    Write-ColorOutput "4. Verification:" "Yellow"
    Write-ColorOutput "   • Run: npm test -- --testNamePattern='database'" "White"
    Write-ColorOutput "   • Start the application: npm run dev" "White"
    Write-ColorOutput "   • Test the chat interface at: http://localhost:3000/chat.html" "White"
    Write-Host ""
}

# Show knowledge substrate features
function Show-KnowledgeSubstrateFeatures {
    Write-ColorOutput "🧠 Knowledge Substrate Features" "Blue"
    Write-ColorOutput "===============================" "Blue"
    Write-Host ""
    
    Write-ColorOutput "Research Agent Integration:" "Yellow"
    Write-ColorOutput "  • Caches web search results for 24 hours" "White"
    Write-ColorOutput "  • Stores research insights and patterns" "White"
    Write-ColorOutput "  • Retrieves similar research by domain and query hash" "White"
    Write-ColorOutput "  • Creates knowledge entities for significant findings" "White"
    Write-Host ""
    
    Write-ColorOutput "Quality Assurance Agent Integration:" "Yellow"
    Write-ColorOutput "  • Stores QA insights and quality metrics" "White"
    Write-ColorOutput "  • Tracks improvement patterns" "White"
    Write-ColorOutput "  • Retrieves similar assessments by content hash" "White"
    Write-ColorOutput "  • Builds knowledge base of quality patterns" "White"
    Write-Host ""
    
    Write-ColorOutput "Domain Classification:" "Yellow"
    Write-ColorOutput "  • ai, software, security, performance, data, api, general" "White"
    Write-Host ""
    
    Write-ColorOutput "Performance Features:" "Yellow"
    Write-ColorOutput "  • Vector similarity search with pgvector" "White"
    Write-ColorOutput "  • Intelligent caching with Redis support" "White"
    Write-ColorOutput "  • Optimized indexes for fast retrieval" "White"
    Write-ColorOutput "  • Confidence scoring and provenance tracking" "White"
    Write-Host ""
}

# Main execution
function Main {
    $filesOk = Test-KnowledgeSubstrateFiles
    Write-Host ""
    
    $configOk = Test-EnvironmentConfig
    Write-Host ""
    
    $implementationOk = Test-DatabaseServiceImplementation
    Write-Host ""
    
    if ($CheckOnly) {
        if ($filesOk -and $configOk -and $implementationOk) {
            Write-ColorOutput "✅ Knowledge substrate is ready for setup!" "Green"
        } else {
            Write-ColorOutput "⚠️  Knowledge substrate needs attention before setup" "Yellow"
        }
        return
    }
    
    Show-SetupInstructions
    Show-KnowledgeSubstrateFeatures
    
    Write-ColorOutput "📚 Additional Resources:" "Blue"
    Write-ColorOutput "  • Read KNOWLEDGE_SUBSTRATE_README.md for detailed documentation" "White"
    Write-ColorOutput "  • Check src/services/database.js for API reference" "White"
    Write-ColorOutput "  • Review agent implementations in src/agents/" "White"
    Write-Host ""
    
    if ($filesOk -and $configOk -and $implementationOk) {
        Write-ColorOutput "🎉 Knowledge substrate is ready! Follow the setup instructions above." "Green"
    } else {
        Write-ColorOutput "⚠️  Please address the issues above before proceeding with setup." "Yellow"
    }
}

# Run main function
Main
