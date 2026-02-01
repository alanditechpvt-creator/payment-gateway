$api = 'http://localhost:4100/api'

# Login
$login = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"shabbhg@gmail.com","password":"Welcome123"}'
$token = $login.data.accessToken
Write-Host "Logged in" -ForegroundColor Green

# Transaction
$txn = Invoke-RestMethod "$api/transactions" -Method Post -Headers @{'Authorization'="Bearer $token"} -ContentType 'application/json' -Body '{"type":"PAYIN","amount":100,"pgId":"642b6376-5f6e-4b10-becb-846477add072","description":"Test"}'
$txnId = $txn.data.id
Write-Host "Transaction: $txnId" -ForegroundColor Green

# Razorpay
$body = "{""transactionId"":""$txnId"",""amount"":100,""description"":""Test""}"
$result = Invoke-RestMethod "$api/razorpay/orders" -Method Post -Headers @{'Authorization'="Bearer $token"} -ContentType 'application/json' -Body $body

Write-Host "SUCCESS" -ForegroundColor Green
$result | ConvertTo-Json -Depth 10
