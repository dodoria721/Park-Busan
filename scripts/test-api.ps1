$ErrorActionPreference = 'Stop'
$baseUrl = if ($env:PARK_BUSAN_API_URL) { $env:PARK_BUSAN_API_URL.TrimEnd('/') } else { 'http://localhost:3000' }
$health = Invoke-RestMethod -Uri "$baseUrl/api/health"
$parking = Invoke-RestMethod -Uri "$baseUrl/api/parking"
$detail = Invoke-RestMethod -Uri "$baseUrl/api/parking/busan-station-1"
if ($health.status -ne 'ok') { throw 'Health endpoint did not return ok.' }
if ($parking.data.Count -lt 1) { throw 'Parking endpoint returned no rows.' }
if ($detail.data.id -ne 'busan-station-1') { throw 'Parking detail endpoint returned an unexpected row.' }
Write-Output "API smoke test passed: health=ok, parking=$($parking.data.Count), detail=$($detail.data.id)"
