param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath
)

$ErrorActionPreference = "Stop"
$SourceRoot = $PSScriptRoot
$TargetRoot = (Resolve-Path -LiteralPath $ProjectPath).Path

if (-not (Test-Path (Join-Path $TargetRoot "package.json"))) {
  throw "В ProjectPath не найден package.json. Укажи корень репозитория BrewMate."
}

$allowed = @("opencode.json", "AGENTS.md", ".opencode", ".agents")
$backupName = ".backup-agent-starter-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$backupRoot = Join-Path $TargetRoot $backupName
$backupCreated = $false

foreach ($relative in $allowed) {
  $src = Join-Path $SourceRoot $relative
  if (-not (Test-Path -LiteralPath $src)) { continue }

  $dst = Join-Path $TargetRoot $relative
  if (Test-Path -LiteralPath $dst) {
    if (-not $backupCreated) {
      New-Item -ItemType Directory -Path $backupRoot | Out-Null
      $backupCreated = $true
    }
    $backupDst = Join-Path $backupRoot $relative
    $backupParent = Split-Path -Parent $backupDst
    if (-not (Test-Path $backupParent)) {
      New-Item -ItemType Directory -Force -Path $backupParent | Out-Null
    }
    Move-Item -LiteralPath $dst -Destination $backupDst
    Write-Host "Существующий файл сохранён: $backupDst" -ForegroundColor Yellow
  }

  $parent = Split-Path -Parent $dst
  if (-not (Test-Path $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
  Write-Host "Установлено: $relative" -ForegroundColor Green
}

if ($backupCreated) {
  Write-Host "Резервная копия существующих файлов: $backupRoot" -ForegroundColor Yellow
}
Write-Host "Готово. Проверь git status --short и прочитай README-RU.md." -ForegroundColor Cyan
