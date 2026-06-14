$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$port = 4173

$client = [System.Net.Sockets.TcpClient]::new()
try {
  $connection = $client.BeginConnect("127.0.0.1", $port, $null, $null)
  if ($connection.AsyncWaitHandle.WaitOne(500) -and $client.Connected) {
    exit 0
  }
} catch {
  # The port is free, so the app can start.
} finally {
  $client.Dispose()
}

$logDirectory = Join-Path $projectRoot "logs"
$outputLogPath = Join-Path $logDirectory "server.log"
$errorLogPath = Join-Path $logDirectory "server-error.log"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

Set-Location -LiteralPath $projectRoot
$process = Start-Process `
  -FilePath $nodePath `
  -ArgumentList @("server.mjs", "--production") `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outputLogPath `
  -RedirectStandardError $errorLogPath `
  -Wait `
  -PassThru

exit $process.ExitCode
