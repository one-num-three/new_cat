param([Parameter(Mandatory=$true)][string]$Project,[Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
$cli='D:\Program Files (x86)\微信web开发者工具\wechatide.cmd'
$raw=(& $cli -c Codex simulator_screenshot --project $Project --path $Path --optimize false | Out-String)
$start=$raw.IndexOf('{')
if($start -lt 0){throw $raw}
$result=$raw.Substring($start)|ConvertFrom-Json
if(-not $result.ok -or -not $result.result.success){throw $raw}
if(-not (Test-Path -LiteralPath $result.result.path)){throw 'MCP returned no screenshot file'}
Write-Output ('MCP_SCREENSHOT_PASS '+$result.result.imageWidth+'x'+$result.result.imageHeight)
