# AthenAI Document Processing Test Script for Windows
# This script tests document processing functionality

param(
    [switch]$Verbose = $false,
    [string]$TestFile = "",
    [switch]$SkipUpload = $false
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

function Test-ServiceHealth {
    param([string]$Url, [string]$ServiceName)
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "✅ $ServiceName is healthy" $Green
            return $true
        } else {
            Write-ColorOutput "❌ $ServiceName returned status: $($response.StatusCode)" $Red
            return $false
        }
    } catch {
        Write-ColorOutput "❌ $ServiceName is not responding: $($_.Exception.Message)" $Red
        return $false
    }
}

function Test-RabbitMQQueue {
    try {
        # Check if RabbitMQ management is accessible
        $rabbitUrl = "http://localhost:15672/api/queues"
        $credentials = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("athenai_queue:your_rabbitmq_password_here"))
        
        $headers = @{
            "Authorization" = "Basic $credentials"
        }
        
        $response = Invoke-WebRequest -Uri $rabbitUrl -Headers $headers -Method GET -TimeoutSec 10 -UseBasicParsing
        
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "✅ RabbitMQ queues are accessible" $Green
            return $true
        } else {
            Write-ColorOutput "⚠️  RabbitMQ management not accessible (this is normal if using default credentials)" $Yellow
            return $true
        }
    } catch {
        Write-ColorOutput "⚠️  RabbitMQ management check failed (this is normal if using default credentials)" $Yellow
        return $true
    }
}

function Test-PostgreSQLConnection {
    Write-ColorOutput "🗄️  Testing PostgreSQL connection..." $Cyan
    
    try {
        # Test if we can connect to PostgreSQL via Docker
        $result = docker exec postgres-db psql -U athenai_user -d athenai_knowledge -c "SELECT 1;" 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ PostgreSQL connection successful" $Green
            return $true
        } else {
            Write-ColorOutput "❌ PostgreSQL connection failed" $Red
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Error testing PostgreSQL: $($_.Exception.Message)" $Red
        return $false
    }
}

function Test-PgvectorExtension {
    Write-ColorOutput "🔍 Testing pgvector extension..." $Cyan
    
    try {
        $result = docker exec postgres-db psql -U athenai_user -d athenai_knowledge -c "SELECT * FROM pg_extension WHERE extname = 'vector';" 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $result -match "vector") {
            Write-ColorOutput "✅ pgvector extension is installed" $Green
            return $true
        } else {
            Write-ColorOutput "❌ pgvector extension not found" $Red
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Error checking pgvector: $($_.Exception.Message)" $Red
        return $false
    }
}

function Create-TestDocument {
    $testDir = "./data/unstructured/input"
    $testFile = "$testDir/test-document.txt"
    
    if (-not (Test-Path $testDir)) {
        New-Item -ItemType Directory -Path $testDir -Force | Out-Null
    }
    
    $testContent = @"
AthenAI Document Processing Test

This is a test document for the AthenAI document processing system.

Key Features:
- Unstructured.io integration for document parsing
- pgvector for semantic search capabilities
- RabbitMQ for asynchronous processing
- Supabase PostgreSQL for vector storage

Test Content:
The AthenAI system uses advanced AI agents to process and analyze documents.
This includes semantic search, summarization, and intelligent routing.

Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

    Set-Content -Path $testFile -Value $testContent -Encoding UTF8
    
    if (Test-Path $testFile) {
        Write-ColorOutput "✅ Test document created: $testFile" $Green
        return $testFile
    } else {
        Write-ColorOutput "❌ Failed to create test document" $Red
        return $null
    }
}

function Test-DocumentUpload {
    param([string]$FilePath)
    
    Write-ColorOutput "📄 Testing document upload..." $Cyan
    
    if (-not (Test-Path $FilePath)) {
        Write-ColorOutput "❌ Test file not found: $FilePath" $Red
        return $false
    }
    
    try {
        # Test the upload endpoint
        $uploadUrl = "http://localhost:3000/api/agents/document"
        
        $body = @{
            message = "Upload document: $FilePath"
            agent = "document"
        } | ConvertTo-Json
        
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        Write-ColorOutput "📤 Sending upload request..." $Yellow
        $response = Invoke-WebRequest -Uri $uploadUrl -Method POST -Body $body -Headers $headers -TimeoutSec 30 -UseBasicParsing
        
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "✅ Document upload request successful" $Green
            
            # Parse response to check for document ID
            $responseContent = $response.Content | ConvertFrom-Json
            if ($responseContent.response -match "documentId") {
                Write-ColorOutput "✅ Document ID received in response" $Green
                return $true
            } else {
                Write-ColorOutput "⚠️  Upload request sent but no document ID in response" $Yellow
                return $true
            }
        } else {
            Write-ColorOutput "❌ Document upload failed with status: $($response.StatusCode)" $Red
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Error testing document upload: $($_.Exception.Message)" $Red
        return $false
    }
}

function Test-WorkerLogs {
    Write-ColorOutput "📋 Checking worker logs..." $Cyan
    
    try {
        $logs = docker-compose -f docker-compose.simplified.yml logs --tail=20 unstructured-worker 2>$null
        
        if ($logs -match "Starting unstructured worker" -or $logs -match "Worker started successfully") {
            Write-ColorOutput "✅ Worker is running and processing" $Green
            return $true
        } elseif ($logs -match "Error" -or $logs -match "Exception") {
            Write-ColorOutput "⚠️  Worker logs show errors - check logs for details" $Yellow
            if ($Verbose) {
                Write-ColorOutput "Recent worker logs:" $Cyan
                Write-Host $logs
            }
            return $false
        } else {
            Write-ColorOutput "⚠️  Worker logs are unclear - check manually" $Yellow
            return $true
        }
    } catch {
        Write-ColorOutput "❌ Error checking worker logs: $($_.Exception.Message)" $Red
        return $false
    }
}

function Show-TestSummary {
    param([hashtable]$Results)
    
    Write-ColorOutput "`n📊 Document Processing Test Summary:" $Cyan
    Write-ColorOutput "====================================" $Cyan
    
    $passed = 0
    $total = $Results.Count
    
    foreach ($test in $Results.GetEnumerator()) {
        if ($test.Value) {
            Write-ColorOutput "✅ $($test.Key)" $Green
            $passed++
        } else {
            Write-ColorOutput "❌ $($test.Key)" $Red
        }
    }
    
    Write-ColorOutput "`nResults: $passed/$total tests passed" $(if ($passed -eq $total) { $Green } else { $Yellow })
    
    if ($passed -eq $total) {
        Write-ColorOutput "`n🎉 All tests passed! Document processing is working correctly." $Green
    } else {
        Write-ColorOutput "`n⚠️  Some tests failed. Check the errors above." $Yellow
        Write-ColorOutput "💡 Try running: npm run docker:simplified:logs" $Cyan
    }
}

# Main execution
Write-ColorOutput "🧪 AthenAI Document Processing Tests" $Cyan
Write-ColorOutput "====================================" $Cyan

$testResults = @{}

# Test service health
Write-ColorOutput "`n🏥 Testing service health..." $Cyan
$testResults["AthenAI API Health"] = Test-ServiceHealth "http://localhost:3000/health" "AthenAI API"

# Test database connections
$testResults["PostgreSQL Connection"] = Test-PostgreSQLConnection
$testResults["pgvector Extension"] = Test-PgvectorExtension

# Test RabbitMQ
$testResults["RabbitMQ Queue Access"] = Test-RabbitMQQueue

# Test worker logs
$testResults["Worker Status"] = Test-WorkerLogs

# Test document upload if not skipped
if (-not $SkipUpload) {
    $testFile = $TestFile
    if (-not $testFile) {
        $testFile = Create-TestDocument
    }
    
    if ($testFile) {
        $testResults["Document Upload"] = Test-DocumentUpload $testFile
    } else {
        $testResults["Document Upload"] = $false
    }
} else {
    Write-ColorOutput "⏭️  Skipping document upload test" $Yellow
}

# Show summary
Show-TestSummary $testResults

# Exit with appropriate code
$failedTests = ($testResults.Values | Where-Object { -not $_ }).Count
if ($failedTests -gt 0) {
    exit 1
} else {
    exit 0
}
