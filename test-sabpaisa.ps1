# SabPaisa Integration Test Script
# This script tests the SabPaisa payment gateway integration

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   SabPaisa Integration Test Suite" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$backendUrl = "http://localhost:4100"
$apiUrl = "$backendUrl/api"

# Colors for output
$successColor = "Green"
$errorColor = "Red"
$infoColor = "Yellow"
$headerColor = "Cyan"

function Test-Endpoint {
    param(
        [string]$TestName,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    Write-Host "`n[$TestName]" -ForegroundColor $headerColor
    Write-Host "URL: $Method $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
        }
        
        if ($Body -and $Method -ne "GET") {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            Write-Host "Body: $($params.Body)" -ForegroundColor Gray
        }
        
        $response = Invoke-RestMethod @params
        
        Write-Host "✅ SUCCESS" -ForegroundColor $successColor
        Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
        
        return $response
    }
    catch {
        Write-Host "❌ FAILED" -ForegroundColor $errorColor
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor $errorColor
        if ($_.ErrorDetails.Message) {
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor $errorColor
        }
        return $null
    }
}

Write-Host "Starting SabPaisa Integration Tests..." -ForegroundColor $infoColor
Write-Host ""

# Test 1: Check Backend Health
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor
Write-Host "Test 1: Backend Health Check" -ForegroundColor $headerColor
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor

$health = Test-Endpoint -TestName "Health Check" -Url "$apiUrl/health"

if (-not $health) {
    Write-Host "`n❌ Backend is not running. Please start the backend server first." -ForegroundColor $errorColor
    Write-Host "   Run: cd backend && npm run dev" -ForegroundColor $infoColor
    exit 1
}

# Test 2: Check SabPaisa Configuration
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor
Write-Host "Test 2: SabPaisa Configuration Status" -ForegroundColor $headerColor
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor

$config = Test-Endpoint -TestName "Config Status" -Url "$apiUrl/sabpaisa/config/status"

if ($config) {
    Write-Host "`nConfiguration Details:" -ForegroundColor $infoColor
    Write-Host "  Enabled: $($config.enabled)" -ForegroundColor $(if ($config.enabled) { $successColor } else { $errorColor })
    Write-Host "  Production Mode: $($config.isProduction)" -ForegroundColor $(if ($config.isProduction) { $errorColor } else { $successColor })
    Write-Host "  Client Code: $($config.clientCode)" -ForegroundColor $(if ($config.clientCode -eq 'Configured') { $successColor } else { $errorColor })
    Write-Host "  Fully Configured: $($config.configured)" -ForegroundColor $(if ($config.configured) { $successColor } else { $errorColor })
    
    if (-not $config.configured) {
        Write-Host "`n⚠️  SabPaisa is not fully configured!" -ForegroundColor $errorColor
        Write-Host "   Please add the following to your .env file:" -ForegroundColor $infoColor
        Write-Host "   - SABPAISA_ENABLED=true" -ForegroundColor Gray
        Write-Host "   - SABPAISA_CLIENT_CODE=your-client-code" -ForegroundColor Gray
        Write-Host "   - SABPAISA_USERNAME=your-username" -ForegroundColor Gray
        Write-Host "   - SABPAISA_PASSWORD=your-password" -ForegroundColor Gray
        Write-Host "   - SABPAISA_AUTH_KEY=your-base64-auth-key" -ForegroundColor Gray
        Write-Host "   - SABPAISA_AUTH_IV=your-base64-auth-iv" -ForegroundColor Gray
        Write-Host "   - SABPAISA_CALLBACK_URL=your-callback-url" -ForegroundColor Gray
    }
}

# Test 3: Admin Login (to get auth token)
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor
Write-Host "Test 3: Admin Authentication" -ForegroundColor $headerColor
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor

$loginBody = @{
    email = "admin@admin.com"
    password = "Admin@123"
}

$authResponse = Test-Endpoint -TestName "Admin Login" -Url "$apiUrl/auth/login" -Method "POST" -Body $loginBody

if (-not $authResponse -or -not $authResponse.accessToken) {
    Write-Host "`n❌ Authentication failed. Cannot proceed with authenticated tests." -ForegroundColor $errorColor
    exit 1
}

$token = $authResponse.accessToken
$authHeaders = @{
    "Authorization" = "Bearer $token"
}

# Test 4: Check if SabPaisa Payment Gateway exists
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor
Write-Host "Test 4: Check SabPaisa in Database" -ForegroundColor $headerColor
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor

$gateways = Test-Endpoint -TestName "Get Payment Gateways" -Url "$apiUrl/pg" -Headers $authHeaders

if ($gateways -and $gateways.data) {
    $sabpaisa = $gateways.data | Where-Object { $_.code -eq "SABPAISA" }
    
    if ($sabpaisa) {
        Write-Host "`n✅ SabPaisa found in database!" -ForegroundColor $successColor
        Write-Host "  ID: $($sabpaisa.id)" -ForegroundColor Gray
        Write-Host "  Name: $($sabpaisa.name)" -ForegroundColor Gray
        Write-Host "  Code: $($sabpaisa.code)" -ForegroundColor Gray
        Write-Host "  Active: $($sabpaisa.isActive)" -ForegroundColor $(if ($sabpaisa.isActive) { $successColor } else { $errorColor })
        Write-Host "  Base Rate: $([math]::Round($sabpaisa.baseRate * 100, 2))%" -ForegroundColor Gray
    }
    else {
        Write-Host "`n⚠️  SabPaisa not found in database!" -ForegroundColor $errorColor
        Write-Host "   Run the seed script:" -ForegroundColor $infoColor
        Write-Host "   cd backend && npx ts-node prisma/seed-sabpaisa.ts" -ForegroundColor Gray
    }
}

# Test 5: Create Test Payment (only if configured)
if ($config -and $config.configured -and $config.enabled) {
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor
    Write-Host "Test 5: Create Test Payment" -ForegroundColor $headerColor
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $headerColor
    
    $paymentBody = @{
        amount = 100
        payerName = "Test User"
        payerEmail = "test@example.com"
        payerMobile = "9999999999"
        clientTxnId = "TEST_$(Get-Date -Format 'yyyyMMddHHmmss')"
    }
    
    $payment = Test-Endpoint -TestName "Create Payment" -Url "$apiUrl/sabpaisa/create-payment" -Method "POST" -Body $paymentBody -Headers $authHeaders
    
    if ($payment -and $payment.success) {
        Write-Host "`n✅ Payment request created successfully!" -ForegroundColor $successColor
        Write-Host "  Client Txn ID: $($payment.data.clientTxnId)" -ForegroundColor Gray
        Write-Host "  Action URL: $($payment.data.actionUrl)" -ForegroundColor Gray
        Write-Host "  Encrypted Data Length: $($payment.data.encData.Length) characters" -ForegroundColor Gray
    }
}
else {
    Write-Host "`n⚠️  Skipping payment creation test (SabPaisa not configured or disabled)" -ForegroundColor $infoColor
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "=====================================" -ForegroundColor $headerColor
Write-Host "         Test Summary" -ForegroundColor $headerColor
Write-Host "=====================================" -ForegroundColor $headerColor

Write-Host "`nChecklist:" -ForegroundColor $infoColor
Write-Host "  [$(if ($health) { '✅' } else { '❌' })] Backend running" -ForegroundColor $(if ($health) { $successColor } else { $errorColor })
Write-Host "  [$(if ($config -and $config.configured) { '✅' } else { '❌' })] SabPaisa configured" -ForegroundColor $(if ($config -and $config.configured) { $successColor } else { $errorColor })
Write-Host "  [$(if ($config -and $config.enabled) { '✅' } else { '❌' })] SabPaisa enabled" -ForegroundColor $(if ($config -and $config.enabled) { $successColor } else { $errorColor })
Write-Host "  [$(if ($sabpaisa) { '✅' } else { '❌' })] SabPaisa in database" -ForegroundColor $(if ($sabpaisa) { $successColor } else { $errorColor })

Write-Host "`nNext Steps:" -ForegroundColor $infoColor
if (-not ($config -and $config.configured)) {
    Write-Host "  1. Configure SabPaisa credentials in backend/.env" -ForegroundColor Gray
}
if (-not $sabpaisa) {
    Write-Host "  2. Run: cd backend && npx ts-node prisma/seed-sabpaisa.ts" -ForegroundColor Gray
}
if ($config -and $config.configured -and -not $config.enabled) {
    Write-Host "  3. Set SABPAISA_ENABLED=true in backend/.env" -ForegroundColor Gray
}
if ($config -and $config.configured -and $config.enabled) {
    Write-Host "  ✅ SabPaisa is ready! Test the integration in your frontend." -ForegroundColor $successColor
}

Write-Host ""
