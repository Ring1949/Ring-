$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = 'C:\Program Files\nodejs\node.exe'
$port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$healthUrl = "http://127.0.0.1:$port/healthz"
$logDir = Join-Path $root 'data\logs'
$logFile = Join-Path $logDir 'local-site-watchdog.log'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-WatchdogLog {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
  Write-Output $line
}

function Test-SiteHealth {
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
    return [bool]$response.ok
  } catch {
    return $false
  }
}

function Start-Site {
  if (-not (Test-Path -LiteralPath $node)) {
    throw "Node.js was not found at $node"
  }
  Start-Process -FilePath $node -ArgumentList 'server.js' -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

Write-WatchdogLog "watchdog started for $healthUrl"

while ($true) {
  if (-not (Test-SiteHealth)) {
    Write-WatchdogLog 'site is not responding; starting local server'
    Start-Site
    if (Test-SiteHealth) {
      Write-WatchdogLog 'site recovered'
    } else {
      Write-WatchdogLog 'site still not healthy after restart attempt'
    }
  }
  Start-Sleep -Seconds 15
}
