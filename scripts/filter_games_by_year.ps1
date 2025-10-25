<#
Filters data/games.clean.csv and removes rows where YearPublished < 1000.
Backs up the original file as games.clean.csv.bak.TIMESTAMP
Usage: Run in PowerShell from repository root:
    .\scripts\filter_games_by_year.ps1
#>

Set-StrictMode -Version Latest

$dataDir = Join-Path $PSScriptRoot '..\data' | Resolve-Path -Relative
$inFile = Join-Path $dataDir 'games.clean.csv'
if (-not (Test-Path $inFile)) {
    Write-Error "Input file not found: $inFile"
    exit 1
}

$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$backup = "$inFile.bak.$timestamp"
Write-Host "Backing up $inFile -> $backup"
Copy-Item -Path $inFile -Destination $backup -Force

$outFile = "$inFile"  # overwrite original after backup

Write-Host "Filtering rows with YearPublished < 1000 (keep YearPublished >= 1000)"

# Use Import-Csv to correctly parse quoted fields with commas
[int]$kept = 0
[int]$total = 0

# Read and process in streaming fashion to avoid huge memory use
Import-Csv -Path $inFile -Encoding UTF8 | Where-Object {
    $total++
    $ystr = $_.YearPublished
    $parsed = 0
    if ([string]::IsNullOrWhiteSpace($ystr)) { $false }
    elseif ([int]::TryParse($ystr, [ref]$parsed)) { $keep = ($parsed -ge 1000); if ($keep) { $kept++ }; $keep }
    else { $false }
} | Export-Csv -NoTypeInformation -Path $outFile -Encoding UTF8

Write-Host "Total rows processed: $total"
Write-Host "Rows kept (YearPublished >= 1000): $kept"
Write-Host "Filtered file written to: $outFile (original backed up at $backup)"
