[CmdletBinding()]
param(
  [string]$OutputDirectory,
  [switch]$DirectoryOnly
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $root 'dist'
}
$out = (Resolve-Path $OutputDirectory -ErrorAction SilentlyContinue)
if (-not $out) {
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  $out = Resolve-Path $OutputDirectory
}

$staging = Join-Path ([IO.Path]::GetTempPath()) ('cat-mouse-release-' + [guid]::NewGuid().ToString('N'))
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$resolvedStaging = [IO.Path]::GetFullPath($staging)
if (-not $resolvedStaging.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolvedStaging -Leaf) -notmatch '^cat-mouse-release-[0-9a-f]{32}$') {
  throw "Unexpected staging path: $resolvedStaging"
}
$miniStage = Join-Path $staging 'miniprogram'
$serverStage = Join-Path $staging 'cat-mouse-server'
New-Item -ItemType Directory -Path $miniStage,$serverStage -Force | Out-Null

try {
  # 只复制首发闭环所需的小程序文件；实验页和后端不会混入小程序压缩包。
  $miniFiles = @('app.js','app.json','project.config.json','sitemap.json','utils\config.js','utils\v2.js','utils\capture-proof.js','utils\location-v2.js','utils\snapshot-v2.js','utils\dev-preview.js','utils\pixel-theme.wxss','utils\fusion-font.wxss','utils\team-config.js','utils\geo-registration.js','utils\osm-art-registration.js','utils\osm-art-model.js','utils\vendor','utils\presentation.js','utils\pixel-font.wxss','utils\pixel-art-ratios.wxss','utils\venue-camera.js','utils\venue-art-config.js','utils\pixel-button-dimensions.js','utils\map-markers.js','utils\venue-catalog.js','utils\venue-images.js','utils\campus-art-models.js','utils\venue-resources.js','venue-maps','assets\map-markers-v2','assets\pixel-v1','venue-xuanwu','components','pages\index','pages\room','pages\map','pages\qrcode','pages\dev','pages\venue','pages\calibrate')
  $miniFiles += @('app.wxss','utils\venue-boundary.js','utils\qr-protocol.js','utils\capture-flow.js','utils\room-live.js','field-editor','room-tools')
  $miniFiles += 'utils\foreground-location.js'
  $miniFiles += @('utils\track-export.js','utils\track-poster.js','utils\track-highlights.js','utils\track-bubble-placement.js','utils\track-bubble-assets.js')
  $miniFiles += 'utils\location-scenarios.js'
  $miniFiles += @('utils\model-map.js','utils\model-reference.js','utils\model-camera.js','utils\model-resources.js','campus3d')
  foreach ($item in $miniFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $item))) {
      throw "Required miniprogram source is missing: $item"
    }
    $destination = Join-Path $miniStage $item
    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root $item) -Destination $destination -Recurse -Force
  }
  # The licensed subset is already embedded in pixel-font.wxss. Keep its source
  # in the repository, not duplicated in the mobile upload package.
  $oldMap = Join-Path $miniStage 'assets\maps\xuanwu-lake-v3.png'
  if (Test-Path -LiteralPath $oldMap) { Remove-Item -LiteralPath $oldMap -Force }
  $embeddedFontSource = Join-Path $miniStage 'assets\pixel-v1\ui-variable.woff'
  if (Test-Path -LiteralPath $embeddedFontSource) { Remove-Item -LiteralPath $embeddedFontSource -Force }
  # Keep unused reference slices in the source library, not in the shipped UI.
  foreach ($name in @('button-create-minus.png','button-create-plus.png','rules-icon-capture.png')) {
    $unusedSlice = Join-Path $miniStage ('assets\pixel-v1\' + $name)
    if (Test-Path -LiteralPath $unusedSlice) { Remove-Item -LiteralPath $unusedSlice -Force }
  }

  if ((Get-Content -LiteralPath (Join-Path $root 'components\pixel-action\pixel-action.wxml') -Raw) -match '<image') { throw 'Button artwork is used again; revisit package exclusions' }
  foreach ($button in (Get-ChildItem -LiteralPath (Join-Path $miniStage 'assets\pixel-v1') -Filter 'button-*.png' -File)) { Remove-Item -LiteralPath $button.FullName -Force }

  # Historical faithful-v2 assets and styles stay in the repository but are not
  # part of the current pixel-v1 runtime file list.
  $appManifest=Get-Content -LiteralPath (Join-Path $miniStage 'app.json') -Raw | ConvertFrom-Json
  $packageBytes=@{main=0L}
  foreach($file in @(Get-ChildItem -LiteralPath $miniStage -File -Recurse)) {
    $relative=[IO.Path]::GetRelativePath($miniStage,$file.FullName).Replace('\','/')
    $group='main'
    foreach($part in $appManifest.subPackages){if($relative.StartsWith($part.root+'/')){$group=$part.root;break}}
    if(!$packageBytes.ContainsKey($group)){$packageBytes[$group]=0L}
    $packageBytes[$group]+=$file.Length
  }
  if($packageBytes.main -ge 1500000){throw "Main package exceeds 1,500,000-byte project budget: $($packageBytes.main)"}
  foreach($group in $packageBytes.Keys){if($packageBytes[$group] -ge 2097152){throw "Package exceeds 2 MiB: $group"}}
  @{rawLocalBytes=$packageBytes;mainLimitBytes=1500000;uploadVerified=$false} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $out.Path 'package-budget.json') -Encoding utf8
  foreach ($item in $miniFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $miniStage $item))) {
      throw "Required miniprogram staged entry is missing: $item"
    }
  }

  if ($DirectoryOnly) {
    $directoryTarget = Join-Path $out.Path 'MODIFIED_FILE'
    if (Test-Path -LiteralPath $directoryTarget) {
      $targetEntry = Get-Item -LiteralPath $directoryTarget -Force
      if (-not $targetEntry.PSIsContainer -or ($targetEntry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Directory-only output must be an ordinary directory: $directoryTarget"
      }
      if (@(Get-ChildItem -LiteralPath $directoryTarget -Force).Count -gt 0) {
        throw "Directory-only output already exists and is not empty: $directoryTarget"
      }
    } else {
      New-Item -ItemType Directory -Path $directoryTarget | Out-Null
    }
    foreach ($entry in (Get-ChildItem -LiteralPath $miniStage -Force)) {
      Copy-Item -LiteralPath $entry.FullName -Destination $directoryTarget -Recurse -Force
    }
    foreach ($item in $miniFiles) {
      if (-not (Test-Path -LiteralPath (Join-Path $directoryTarget $item))) {
        throw "Required directory-only output entry is missing: $item"
      }
    }
    Write-Output "Created directory: $directoryTarget"
    return
  }

  # 后端镜像只需要运行文件和锁文件，不包含题库、旧文档或 Git 历史。
  $serverFiles = @('package.json','package-lock.json','Dockerfile','.dockerignore','.env.example','v2','shared')
  foreach ($item in $serverFiles) {
    Copy-Item -LiteralPath (Join-Path (Join-Path $root 'cat-mouse-server') $item) -Destination (Join-Path $serverStage $item) -Recurse -Force
  }

  $miniZip = Join-Path $out 'cat-mouse-miniprogram-mvp.zip'
  $serverZip = Join-Path $out 'cat-mouse-server.zip'
  if (Test-Path $miniZip) { Remove-Item -LiteralPath $miniZip -Force }
  if (Test-Path $serverZip) { Remove-Item -LiteralPath $serverZip -Force }
  Compress-Archive -Path (Join-Path $miniStage '*') -DestinationPath $miniZip -CompressionLevel Optimal
  Compress-Archive -Path (Join-Path $serverStage '*') -DestinationPath $serverZip -CompressionLevel Optimal

  Write-Output "Created: $miniZip"
  Write-Output "Created: $serverZip"
} finally {
  if (Test-Path -LiteralPath $resolvedStaging) { Remove-Item -LiteralPath $resolvedStaging -Recurse -Force }
}

