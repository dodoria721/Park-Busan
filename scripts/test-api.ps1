$ErrorActionPreference = 'Stop'
$baseUrl = if ($env:PARK_BUSAN_API_URL) { $env:PARK_BUSAN_API_URL.TrimEnd('/') } else { 'http://localhost:3000' }
$health = Invoke-RestMethod -Uri "$baseUrl/api/health"
$parking = Invoke-RestMethod -Uri "$baseUrl/api/parking"
if ($health.status -ne 'ok') { throw 'Health endpoint did not return ok.' }
if ($parking.data.Count -lt 1) { throw 'Parking endpoint returned no rows.' }
$parkingId = [uri]::EscapeDataString([string]$parking.data[0].id)
$detail = Invoke-RestMethod -Uri "$baseUrl/api/parking/$parkingId"
if ($detail.data.id -ne $parking.data[0].id) { throw 'Parking detail endpoint returned an unexpected row.' }
if ($health.dataSource -eq 'edge-function') {
  if ($null -ne $detail.data.estimatedFeeWon) { throw 'Realtime API must not invent fees.' }
  if ($null -ne $detail.data.latitude -and $detail.data.locationSource -ne 'https://bsparking.bisco.or.kr/api/parking/realtime/list') { throw 'Parking coordinates must have an official source.' }
}
Write-Output "API smoke test passed: source=$($health.dataSource), parking=$($parking.data.Count), detail=$($detail.data.id)"
