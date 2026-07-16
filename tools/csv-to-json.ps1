param(
  [Parameter(Mandatory = $true)]
  [string]$CsvPath,

  [string]$OutputPath = "data\leituras.json",

  [string]$JsOutputPath = "data\leituras.js",

  [int]$Year = 2026
)

function Remove-Accents {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $normalized = $Text.Normalize([Text.NormalizationForm]::FormD)
  return -join ($normalized.ToCharArray() | Where-Object {
    [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
  })
}

function Convert-DateValue {
  param([string]$Value, [int]$DefaultYear)

  $clean = (Remove-Accents $Value).Trim().TrimEnd(".").ToLowerInvariant()
  $months = @{
    "jan" = 1; "janeiro" = 1
    "fev" = 2; "fevereiro" = 2
    "mar" = 3; "marco" = 3
    "abr" = 4; "abril" = 4
    "mai" = 5; "maio" = 5
    "jun" = 6; "junho" = 6
    "jul" = 7; "julho" = 7
    "ago" = 8; "agosto" = 8
    "set" = 9; "setembro" = 9
    "out" = 10; "outubro" = 10
    "nov" = 11; "novembro" = 11
    "dez" = 12; "dezembro" = 12
  }

  if ($clean -match "^(\d{1,2})[-/ ]([a-z]+)$") {
    $day = [int]$Matches[1]
    $month = $months[$Matches[2]]
    return "{0:D4}-{1:D2}-{2:D2}" -f $DefaultYear, $month, $day
  }

  if ($clean -match "^(\d{1,2})/(\d{1,2})/(\d{4})$") {
    return "{0:D4}-{1:D2}-{2:D2}" -f [int]$Matches[3], [int]$Matches[2], [int]$Matches[1]
  }

  throw "Data nao reconhecida: $Value"
}

function Get-Cell {
  param($Row, [string]$Name)
  if ($Row.PSObject.Properties.Name -contains $Name -and $null -ne $Row.$Name) {
    return ($Row.$Name).Trim()
  }
  return ""
}

$rows = Import-Csv -LiteralPath $CsvPath
$readings = foreach ($row in $rows) {
  [ordered]@{
    date = Convert-DateValue (Get-Cell $row "Data") $Year
    oldTestament = Get-Cell $row "Antigo Testamento"
    wisdom = Get-Cell $row "Salmos / Proverbios"
    newTestament = Get-Cell $row "Novo Testamento"
    oldText = Get-Cell $row "Texto Antigo Testamento"
    wisdomText = Get-Cell $row "Texto Salmos / Proverbios"
    newText = Get-Cell $row "Texto Novo Testamento"
    message = Get-Cell $row "Mensagem"
  }
}

$json = $readings | ConvertTo-Json -Depth 4
$target = Join-Path (Get-Location) $OutputPath
$folder = Split-Path -Parent $target
New-Item -ItemType Directory -Force -Path $folder | Out-Null
Set-Content -LiteralPath $target -Value $json -Encoding UTF8
$jsTarget = Join-Path (Get-Location) $JsOutputPath
$jsFolder = Split-Path -Parent $jsTarget
New-Item -ItemType Directory -Force -Path $jsFolder | Out-Null
Set-Content -LiteralPath $jsTarget -Value "window.LEITURAS_DATA = $json;" -Encoding UTF8
Write-Output "Gerado: $target"
Write-Output "Gerado: $jsTarget"
