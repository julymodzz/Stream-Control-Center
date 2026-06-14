# Startet Backend und Frontend parallel (Windows PowerShell)
$Root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path "$Root\backend\node_modules")) {
    Write-Host "Installiere Abhangigkeiten..."
    Set-Location $Root
    npm run install:all
}

if (-not (Test-Path "$Root\.env")) {
    Copy-Item "$Root\.env.example" "$Root\.env"
    Write-Host ".env erstellt"
}

Write-Host "Starte Backend (Port 3001) und Frontend (Port 5173)..."
Write-Host "Mock-Modus ist auf Windows automatisch aktiv."

$backend = Start-Process -FilePath "npm" -ArgumentList "run","dev:backend","--prefix",$Root -PassThru -NoNewWindow
$frontend = Start-Process -FilePath "npm" -ArgumentList "run","dev:frontend","--prefix",$Root -PassThru -NoNewWindow

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
}
