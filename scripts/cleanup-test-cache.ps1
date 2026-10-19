[CmdletBinding()]
param([switch]$Apply)
$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$out=Join-Path $repo 'reports/2026-10-16/cleanup-campus-v1'
New-Item -ItemType Directory -Path $out -Force | Out-Null
$tempRoot='C:\Users\Keke_\AppData\Local\Temp'
$visualRoot='C:\Users\Keke_\.codex\visualizations\2026\10\08\01a11c62-1472-7df3-b8a1-a6a4aff1d66b'
$evidenceRoot='D:\cat-mouse-preview-evidence'
$dbNames=@('catmouse-fail-LpjI1k','catmouse-k7lweb','catmouse-restart-S96Evg','catmouse-six-dY9det')
function CheckedPath([string]$target,[string]$parent){
 $base=[IO.Path]::GetFullPath($parent).TrimEnd('\')+'\'
 $full=(Resolve-Path -LiteralPath $target).Path
 if(-not $full.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw "Target outside allowed root: $full"}
 $item=Get-Item -LiteralPath $full -Force
 if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Reparse target: $full"}
 $cursor=$item.Parent;if($item.PSIsContainer){$cursor=$item.Parent}
 while($cursor -and $cursor.FullName.Length -ge $base.TrimEnd('\').Length){if($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Reparse ancestor: $full"};$cursor=$cursor.Parent}
 return $full
}
$rows=[Collections.Generic.List[object]]::new()
foreach($name in $dbNames){
 $target=Join-Path $tempRoot $name
 if(-not(Test-Path -LiteralPath $target)){continue}
 $full=CheckedPath $target $tempRoot
 $items=@(Get-ChildItem -LiteralPath $full -Recurse -Force)
 if(@($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count){throw "Reparse child: $full"}
 if(-not(Test-Path -LiteralPath (Join-Path $full 'PG_VERSION'))){throw "Not a PostgreSQL test directory: $full"}
 $rows.Add([pscustomobject]@{kind='old-test-database';path=$full;bytes=($items | Where-Object {-not $_.PSIsContainer} | Measure-Object Length -Sum).Sum;retained=$null;sha256=$null})
}
# Report copies are the retained evidence. Never remove source/design/attachments,
# generated_images, current reports or screenshots without a matching retained hash.
$canonical=@{}
Get-ChildItem -LiteralPath (Join-Path $repo 'reports') -Recurse -File -Filter '*.png' | Where-Object { $_.FullName -notmatch '\\(MODIFIED_FILE|before|source|sources|assets)\\' } | ForEach-Object {
 $hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
 if(-not $canonical.ContainsKey($hash)){$canonical[$hash]=$_.FullName}
}
foreach($root in @($visualRoot,$evidenceRoot)){
 if(-not(Test-Path -LiteralPath $root)){continue}
 foreach($file in (Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.png')){
  if($file.FullName -match '\\(source|sources|design|assets|generated_images|attachments|MODIFIED_FILE)\\'){continue}
  $hash=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
  if(-not $canonical.ContainsKey($hash)){continue}
  $full=CheckedPath $file.FullName $root
  $rows.Add([pscustomobject]@{kind='duplicate-test-screenshot';path=$full;bytes=$file.Length;retained=$canonical[$hash];sha256=$hash})
 }
}
$plan=Join-Path $out 'cleanup-plan.json'
$rows.ToArray() | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $plan -Encoding utf8
if($Apply){
 $running=@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '(cat-mouse|catmouse)' -and $_.CommandLine -match 'node.+--test|integration\.test|custom-teams\.test|geo-registration\.test' })
 if($running.Count){throw 'Project tests are running; postpone cleanup'}
 foreach($row in $rows){
  if($row.kind -eq 'old-test-database'){$full=CheckedPath $row.path $tempRoot;if((Split-Path $full -Leaf) -notin $dbNames){throw 'Unexpected database directory'};Remove-Item -LiteralPath $full -Recurse -Force}
  else{$root=if($row.path.StartsWith($visualRoot,[StringComparison]::OrdinalIgnoreCase)){$visualRoot}else{$evidenceRoot};$full=CheckedPath $row.path $root;if((Get-FileHash -LiteralPath $row.retained -Algorithm SHA256).Hash -ne $row.sha256 -or (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash -ne $row.sha256){throw 'Duplicate verification changed'};Remove-Item -LiteralPath $full -Force}
 }
 Copy-Item -LiteralPath $plan -Destination (Join-Path $out 'cleanup-applied.json') -Force
}
[pscustomobject]@{applied=[bool]$Apply;testDirectories=@($rows|Where-Object kind -eq 'old-test-database').Count;duplicateScreenshots=@($rows|Where-Object kind -eq 'duplicate-test-screenshot').Count;bytes=($rows|Measure-Object bytes -Sum).Sum;plan=$plan} | ConvertTo-Json
