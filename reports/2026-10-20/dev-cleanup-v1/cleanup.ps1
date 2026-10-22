param([switch]$Execute)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath 'D:\cat-mouse-miniprogram').Path.TrimEnd('\')
$preview=(Resolve-Path -LiteralPath 'D:\cat-mouse-preview-evidence').Path.TrimEnd('\')
$out=Join-Path $root 'reports\2026-10-20\dev-cleanup-v1'
$latest=Join-Path $root 'reports\2026-10-20\background-location-v1\release-verified'
$production=Join-Path $root 'reports\2026-10-19\deploy-0.5.2-v1'
function Inside([string]$p,[string]$base){return $p.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)}
function CheckedPath([string]$p){
 $full=[IO.Path]::GetFullPath($p)
 if(!(Inside $full $root) -and !(Inside $full $preview)){throw "Outside intended cleanup roots: $full"}
 $resolved=(Resolve-Path -LiteralPath $full).Path
 if(![string]::Equals($full,$resolved,[StringComparison]::OrdinalIgnoreCase)){throw "Unexpected resolved path: $full"}
 $cursor=Get-Item -LiteralPath $resolved -Force
 while($cursor -and $cursor.FullName -ne $root -and $cursor.FullName -ne $preview){if($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Reparse point: $resolved"};$cursor=if($cursor.PSIsContainer){$cursor.Parent}else{$cursor.Directory}}
 return $resolved
}
if(!$Execute){
 $tracked=@(& git -C $root -c core.quotepath=false ls-files | ForEach-Object {[IO.Path]::GetFullPath((Join-Path $root $_))})
 $items=[Collections.Generic.List[object]]::new()
 function AddItem([string]$p,[string]$reason,[string]$keeper=''){
  if(!(Test-Path -LiteralPath $p)){return}
  $p=CheckedPath $p
  if($p -eq $latest -or (Inside $p $latest) -or $p -eq $production -or (Inside $p $production) -or (Inside $p (Join-Path $root 'design'))){return}
  if(@($tracked | Where-Object {$_ -eq $p -or (Inside $_ $p)}).Count){return}
  $entry=Get-Item -LiteralPath $p -Force
  $files=if($entry.PSIsContainer){@(Get-ChildItem -LiteralPath $p -File -Recurse -Force)}else{@($entry)}
  if($entry.PSIsContainer -and @(Get-ChildItem -LiteralPath $p -Recurse -Force | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count){return}
  $items.Add([PSCustomObject]@{path=$p;reason=$reason;files=$files.Count;bytes=($files|Measure-Object Length -Sum).Sum;keeper=$keeper;sha256=if($keeper){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}else{''}})
 }
 $search=@(Join-Path $root '.local-test-tmp';Join-Path $root 'reports';$preview)
 foreach($base in $search){
  foreach($d in @(Get-ChildItem -LiteralPath $base -Directory -Recurse -Force)){
   if($d.Name -match '^catmouse-(custom|geo)-[A-Za-z0-9]+$' -and (Test-Path -LiteralPath (Join-Path $d.FullName 'PG_VERSION'))){AddItem $d.FullName 'retired isolated test database'}
   elseif($d.Name -in @('node-compile-cache','npm-cache','__pycache__')){AddItem $d.FullName 'rebuildable cache'}
   elseif($d.Name -eq 'rollback-fixture'){AddItem $d.FullName 'retired rollback test working copy'}
   elseif($d.Name -eq 'MODIFIED_FILE' -and (Inside $d.FullName (Join-Path $root 'reports'))){AddItem $d.FullName 'superseded generated package'}
  }
 }
 AddItem (Join-Path $root 'dist') 'superseded zip packages'
 AddItem (Join-Path $root '.local-test-tmp\github-upload\diff-check.log') 'oversized historical command output'
 if(Test-Path -LiteralPath (Join-Path $root '.local-tools\blender-4.3.2-windows-x64\blender.exe')){AddItem (Join-Path $root '.local-tools\blender-4.3.2-windows-x64.zip') 'installer archive; extracted Blender 4.3.2 verified'}
 # Drop child targets if their complete parent is already selected.
 $plan=[Collections.Generic.List[object]]::new()
 foreach($i in @($items|Sort-Object {$_.path.Length})) {if(!@($plan|Where-Object {$_.path -eq $i.path -or (Inside $i.path $_.path)}).Count){$plan.Add($i)}}
 function Planned([string]$p){return @($plan|Where-Object {$_.path -eq $p -or (Inside $p $_.path)}).Count -gt 0}
 $bySize=@{}
 foreach($base in @('reports','design','assets')){foreach($f in @(Get-ChildItem -LiteralPath (Join-Path $root $base) -Recurse -File -Force | Where-Object {$_.Extension -in @('.png','.jpg','.jpeg','.webp','.gif')})){if(!(Planned $f.FullName)){$k=[string]$f.Length;if(!$bySize.ContainsKey($k)){$bySize[$k]=[Collections.Generic.List[object]]::new()};$bySize[$k].Add($f)}}}
 $hashes=@{}
 foreach($f in @(Get-ChildItem -LiteralPath $preview -Recurse -File -Force | Where-Object {$_.Extension -in @('.png','.jpg','.jpeg','.webp','.gif')})){
  if((Planned $f.FullName) -or !$bySize.ContainsKey([string]$f.Length)){continue}
  $hash=(Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash;$keeper=$null
  foreach($ref in $bySize[[string]$f.Length]){if(!$hashes.ContainsKey($ref.FullName)){$hashes[$ref.FullName]=(Get-FileHash -LiteralPath $ref.FullName -Algorithm SHA256).Hash};if($hashes[$ref.FullName] -eq $hash){$keeper=$ref.FullName;break}}
  if($keeper){$plan.Add([PSCustomObject]@{path=(CheckedPath $f.FullName);reason='identical screenshot already retained in project';files=1;bytes=$f.Length;keeper=$keeper;sha256=$hash})}
 }
 $plan | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $out 'plan.json') -Encoding utf8
 [PSCustomObject]@{targets=$plan.Count;files=($plan|Measure-Object files -Sum).Sum;MiB=[Math]::Round(($plan|Measure-Object bytes -Sum).Sum/1MB,2);groups=@($plan|Group-Object reason|ForEach-Object {[PSCustomObject]@{reason=$_.Name;targets=$_.Count;MiB=[Math]::Round(($_.Group|Measure-Object bytes -Sum).Sum/1MB,2)}})}|ConvertTo-Json -Depth 5
 exit
}
$processes=@(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='python.exe' OR Name='blender.exe'")
if(@($processes|Where-Object {$_.CommandLine -match 'cat-mouse-miniprogram[\\/]\.local-test-tmp|cat-mouse-preview-evidence|mcp-join-fixture|mcp-background-location'}).Count){throw 'A process still refers to the project test workspace; cleanup aborted'}
$plan=@(Get-Content -LiteralPath (Join-Path $out 'plan.json') -Raw|ConvertFrom-Json)
$protected=[Collections.Generic.List[object]]::new()
$dirs=@('design','pages','components','utils','scripts','assets','campus3d','venue-maps','field-editor','room-tools','cat-mouse-server\v2','cat-mouse-server\shared', 'reports\2026-10-20\background-location-v1\release-verified','reports\2026-10-19\deploy-0.5.2-v1')
$keepFiles=@(Get-ChildItem -LiteralPath $root -File -Force|Where-Object {$_.Name -ne 'WORK_LOG.md'})
foreach($d in $dirs){$keepFiles+=@(Get-ChildItem -LiteralPath (Join-Path $root $d) -File -Recurse -Force)}
$keepFiles+=Get-Item -LiteralPath (Join-Path $root 'cat-mouse-server\package.json'),(Join-Path $root 'cat-mouse-server\package-lock.json'),(Join-Path $root 'output\pdf\猫鼠行动-产品页面总览-2026-10-19.pdf')
foreach($f in $keepFiles){$protected.Add([PSCustomObject]@{path=$f.FullName;sha256=(Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash})}
$protected|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $out 'protected-before.json') -Encoding utf8
$before=(Get-PSDrive D).Free;$removed=[Collections.Generic.List[object]]::new();$failed=[Collections.Generic.List[object]]::new()
foreach($i in $plan){
 try{
  $p=CheckedPath $i.path
  if(@($protected|Where-Object {$_.path -eq $p -or (Inside $_.path $p)}).Count){throw 'Target overlaps protected files'}
  if($i.keeper){if(!(Test-Path -LiteralPath $i.keeper) -or (Get-FileHash -LiteralPath $i.keeper -Algorithm SHA256).Hash -ne $i.sha256 -or (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $i.sha256){throw 'Duplicate keeper hash mismatch'}}
  if(@(Get-ChildItem -LiteralPath $p -Recurse -Force|Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count){throw 'Target has a reparse point'}
  if((Get-Item -LiteralPath $p -Force).PSIsContainer -and @(Get-ChildItem -LiteralPath $p -Recurse -Force -Filter .git).Count){throw 'Target contains Git metadata; preserving it'}
  Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
  $removed.Add($i)
 }catch{$failed.Add([PSCustomObject]@{path=$i.path;error=$_.Exception.Message})}
}
$changed=@($protected|Where-Object {!(Test-Path -LiteralPath $_.path) -or (Get-FileHash -LiteralPath $_.path -Algorithm SHA256).Hash -ne $_.sha256})
$result=[PSCustomObject]@{date='2026-10-20';removedTargets=$removed.Count;removedFiles=($removed|Measure-Object files -Sum).Sum;removedBytes=($removed|Measure-Object bytes -Sum).Sum;freeBefore=$before;freeAfter=(Get-PSDrive D).Free;protectedFiles=$protected.Count;protectedHashesUnchanged=($changed.Count -eq 0);changed=$changed;failed=@($failed);removed=@($removed)}
$result|ConvertTo-Json -Depth 7|Set-Content -LiteralPath (Join-Path $out 'result.json') -Encoding utf8
[PSCustomObject]@{removedTargets=$result.removedTargets;removedFiles=$result.removedFiles;removedMiB=[Math]::Round($result.removedBytes/1MB,2);freeGiB=[Math]::Round($result.freeAfter/1GB,2);protectedFiles=$protected.Count;protectedHashesUnchanged=$result.protectedHashesUnchanged;failed=$failed.Count}|ConvertTo-Json
if($changed.Count){throw 'Protected files changed; inspect result.json'}
