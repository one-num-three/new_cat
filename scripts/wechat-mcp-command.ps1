param([Parameter(Mandatory=$true)][string]$InputFile)
$ErrorActionPreference='Stop'
$payload=Get-Content -LiteralPath $InputFile -Raw | ConvertFrom-Json
$allowed=@('automation_evaluate','automation_navigate','automation_element_action','automation_runtime_info','simulator_screenshot','automation_wx_api')
if($payload.tool -notin $allowed){throw 'Unsupported local review tool'}
$cli='D:/Program Files (x86)/微信web开发者工具/wechatide.cmd'
$cliArgs=@('-c','Codex',$payload.tool,'--project',$payload.project)
foreach($item in $payload.args.PSObject.Properties){$cliArgs+=('--'+$item.Name);$cliArgs+=([string]$item.Value)}
& $cli @cliArgs
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
