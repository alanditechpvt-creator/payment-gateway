Write-Host "Testing Razorpay" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan

$ApiUrl = 'http://localhost:4100/api'

Write-Host "`n1. Login..." -ForegroundColor Yellow
$login = Invoke-RestMethod "$ApiUrl/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"shabbhg@gmail.com","password":"Welcome123"}'
$token = $login.data.accessToken
Write-Host "OK - Token obtained" -ForegroundColor Green

Write-Host "`n2. Create transaction..." -ForegroundColor Yellow
$txnBody = '{"type":"PAYIN","amount":100,"pgId":"642b6376-5f6e-4b10-becb-846477add072","description":"Test"}'
$txn = Invoke-RestMethod "$ApiUrl/transactions" -Method Post -Headers @{'Authorization'="Bearer $token"} -ContentType 'application/json' -Body $txnBody
$txnId = $txn.data.id
Write-Host "OK - Transaction: $txnId" -ForegroundColor Green

Write-Host "`n3. Create Razorpay order..." -ForegroundColor Yellow
$razorBody = "{`"transactionId`":`"$txnId`",`"amount`":100,`"description`":`"Test`"}"
$result = Invoke-RestMethod "$ApiUrl/razorpay/orders" -Method Post -Headers @{'Authorization'="Bearer $token"} -ContentType 'application/json' -Body $razorBody

Write-Host "✓ SUCCESS!" -ForegroundColor Green
Write-Host "`nResponse:" -ForegroundColor Cyan
$result | ConvertTo-Json -Depth 10
