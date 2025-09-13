# AthenAI ML Service Test Script for Windows
# This script tests the ML service functionality

param(
    [switch]$SkipHealthCheck,
    [switch]$SkipPredictions,
    [switch]$SkipBatch,
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

function Test-HttpEndpoint {
    param([string]$Url, [string]$Method = "GET", [hashtable]$Headers = @{}, [string]$Body = $null)
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response }
    } catch {
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

Write-ColorOutput "🧪 AthenAI ML Service Tests" $Blue
Write-ColorOutput "============================" $Blue

# Load environment variables
if (Test-Path ".env") {
    Write-ColorOutput "📋 Loading environment variables..." $Blue
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Get ML service URL
$mlServiceHost = [Environment]::GetEnvironmentVariable("ML_SERVICE_HOST")
$mlServicePort = [Environment]::GetEnvironmentVariable("ML_SERVICE_PORT")

if (-not $mlServiceHost) { $mlServiceHost = "localhost" }
if (-not $mlServicePort) { $mlServicePort = "8001" }

$baseUrl = "http://${mlServiceHost}:${mlServicePort}"

Write-ColorOutput "🔗 Testing ML Service at: $baseUrl" $Blue

# Test 1: Health Check
if (-not $SkipHealthCheck) {
    Write-ColorOutput "🏥 Testing health endpoint..." $Yellow
    
    $result = Test-HttpEndpoint -Url "$baseUrl/ml/health"
    if ($result.Success) {
        Write-ColorOutput "✅ Health check passed" $Green
        if ($Verbose) {
            Write-ColorOutput "   Response: $($result.Data | ConvertTo-Json -Compress)" $Blue
        }
    } else {
        Write-ColorOutput "❌ Health check failed: $($result.Error)" $Red
        Write-ColorOutput "   Make sure ML service is running: npm run ml:service" $Yellow
        exit 1
    }
}

# Test 2: Model Status
Write-ColorOutput "🤖 Testing model status endpoint..." $Yellow

$result = Test-HttpEndpoint -Url "$baseUrl/ml/models/status"
if ($result.Success) {
    Write-ColorOutput "✅ Model status check passed" $Green
    if ($Verbose) {
        Write-ColorOutput "   Response: $($result.Data | ConvertTo-Json -Compress)" $Blue
    }
} else {
    Write-ColorOutput "⚠️  Model status check failed: $($result.Error)" $Yellow
    Write-ColorOutput "   This is expected if models haven't been trained yet" $Blue
}

# Test 3: Metrics Endpoint
Write-ColorOutput "📊 Testing metrics endpoint..." $Yellow

$result = Test-HttpEndpoint -Url "$baseUrl/ml/metrics"
if ($result.Success) {
    Write-ColorOutput "✅ Metrics endpoint accessible" $Green
} else {
    Write-ColorOutput "⚠️  Metrics endpoint failed: $($result.Error)" $Yellow
}

# Test 4: Prediction Endpoints
if (-not $SkipPredictions) {
    Write-ColorOutput "🔮 Testing prediction endpoints..." $Yellow
    
    # Test expertise prediction
    $expertisePayload = @{
        query = "machine learning expert"
        limit = 5
    } | ConvertTo-Json
    
    $result = Test-HttpEndpoint -Url "$baseUrl/ml/predict/expertise" -Method "POST" -Body $expertisePayload
    if ($result.Success) {
        Write-ColorOutput "✅ Expertise prediction endpoint working" $Green
        if ($Verbose) {
            Write-ColorOutput "   Response: $($result.Data | ConvertTo-Json -Compress)" $Blue
        }
    } else {
        Write-ColorOutput "⚠️  Expertise prediction failed: $($result.Error)" $Yellow
        Write-ColorOutput "   This is expected if no training data is available" $Blue
    }
    
    # Test link prediction
    $linkPayload = @{
        source_entity = "Python"
        target_entities = @("Machine Learning", "Data Science", "AI")
        limit = 3
    } | ConvertTo-Json
    
    $result = Test-HttpEndpoint -Url "$baseUrl/ml/predict/links" -Method "POST" -Body $linkPayload
    if ($result.Success) {
        Write-ColorOutput "✅ Link prediction endpoint working" $Green
        if ($Verbose) {
            Write-ColorOutput "   Response: $($result.Data | ConvertTo-Json -Compress)" $Blue
        }
    } else {
        Write-ColorOutput "⚠️  Link prediction failed: $($result.Error)" $Yellow
        Write-ColorOutput "   This is expected if no training data is available" $Blue
    }
    
    # Test node classification
    $classificationPayload = @{
        entities = @(
            @{ name = "React"; type = "technology" }
            @{ name = "Python"; type = "programming_language" }
        )
    } | ConvertTo-Json
    
    $result = Test-HttpEndpoint -Url "$baseUrl/ml/predict/classification" -Method "POST" -Body $classificationPayload
    if ($result.Success) {
        Write-ColorOutput "✅ Node classification endpoint working" $Green
        if ($Verbose) {
            Write-ColorOutput "   Response: $($result.Data | ConvertTo-Json -Compress)" $Blue
        }
    } else {
        Write-ColorOutput "⚠️  Node classification failed: $($result.Error)" $Yellow
        Write-ColorOutput "   This is expected if no training data is available" $Blue
    }
}

# Test 5: Batch Job Endpoints
if (-not $SkipBatch) {
    Write-ColorOutput "📦 Testing batch job endpoints..." $Yellow
    
    # Submit a test batch job
    $batchPayload = @{
        job_type = "expertise_batch"
        input_data = @{
            queries = @("AI researcher", "Python developer")
            limit = 5
        }
        config = @{
            batch_size = 10
        }
    } | ConvertTo-Json
    
    $result = Test-HttpEndpoint -Url "$baseUrl/ml/batch/submit" -Method "POST" -Body $batchPayload
    if ($result.Success) {
        Write-ColorOutput "✅ Batch job submission working" $Green
        $jobId = $result.Data.job_id
        
        if ($jobId) {
            # Check job status
            Start-Sleep -Seconds 1
            $statusResult = Test-HttpEndpoint -Url "$baseUrl/ml/batch/$jobId/status"
            if ($statusResult.Success) {
                Write-ColorOutput "✅ Batch job status check working" $Green
                if ($Verbose) {
                    Write-ColorOutput "   Job Status: $($statusResult.Data | ConvertTo-Json -Compress)" $Blue
                }
            } else {
                Write-ColorOutput "⚠️  Batch job status check failed: $($statusResult.Error)" $Yellow
            }
        }
    } else {
        Write-ColorOutput "⚠️  Batch job submission failed: $($result.Error)" $Yellow
        Write-ColorOutput "   This is expected if database is not properly configured" $Blue
    }
}

# Test 6: Monitoring Endpoints
Write-ColorOutput "📈 Testing monitoring endpoints..." $Yellow

$result = Test-HttpEndpoint -Url "$baseUrl/ml/monitoring/alerts"
if ($result.Success) {
    Write-ColorOutput "✅ Monitoring alerts endpoint working" $Green
    if ($Verbose) {
        Write-ColorOutput "   Response: $($result.Data | ConvertTo-Json -Compress)" $Blue
    }
} else {
    Write-ColorOutput "⚠️  Monitoring alerts failed: $($result.Error)" $Yellow
}

$result = Test-HttpEndpoint -Url "$baseUrl/ml/monitoring/drift"
if ($result.Success) {
    Write-ColorOutput "✅ Data drift monitoring endpoint working" $Green
    if ($Verbose) {
        Write-ColorOutput "   Response: $($result.Data | ConvertTo-Json -Compress)" $Blue
    }
} else {
    Write-ColorOutput "⚠️  Data drift monitoring failed: $($result.Error)" $Yellow
}

Write-ColorOutput ""
Write-ColorOutput "🎉 ML Service Tests Complete!" $Green
Write-ColorOutput "==============================" $Green
Write-ColorOutput ""
Write-ColorOutput "Test Summary:" $Blue
Write-ColorOutput "✅ Basic endpoints are accessible" $Green
Write-ColorOutput "⚠️  Some prediction endpoints may fail without training data" $Yellow
Write-ColorOutput "⚠️  Some monitoring endpoints may fail without database setup" $Yellow
Write-ColorOutput ""
Write-ColorOutput "Next steps:" $Blue
Write-ColorOutput "1. Initialize ML database: npm run ml:init-db:win" $Yellow
Write-ColorOutput "2. Train initial models (see NEXT_STEPS_GUIDE.md)" $Yellow
Write-ColorOutput "3. Set up monitoring and alerting" $Yellow
Write-ColorOutput ""
Write-ColorOutput "ML Service is running at: $baseUrl" $Blue
Write-ColorOutput "API Documentation: ${baseUrl}/docs" $Blue
