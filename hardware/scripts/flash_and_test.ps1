<#
.SYNOPSIS
    猫鼠手环 V1.5 一键编译、批量烧录与串口产测验收脚本
.EXAMPLE
    .\scripts\flash_and_test.ps1 -Action build
    .\scripts\flash_and_test.ps1 -Action flash -Port COM5
    .\scripts\flash_and_test.ps1 -Action selftest -Port COM5
#>
param(
    [ValidateSet("build", "flash", "selftest", "monitor")]
    [string]$Action = "build",
    [string]$Port = "",
    [string]$PioCoreDir = "D:\.platformio"
)

$ErrorActionPreference = "Stop"
$FirmwareDir = Join-Path $PSScriptRoot "..\firmware"

# 将 PlatformIO 工具链缓存指向 D 盘，避免占满 C 盘空间
if (Test-Path "D:\") {
    $env:PLATFORMIO_CORE_DIR = $PioCoreDir
}

function Resolve-Pio {
    $pio = Get-Command pio -ErrorAction SilentlyContinue
    if ($pio) { return $pio.Source }
    $uvx = Get-Command uvx -ErrorAction SilentlyContinue
    if ($uvx) { return "uvx" }
    throw "未找到 pio 或 uvx，请先安装 PlatformIO (pip install platformio) 或 uv。"
}

function Invoke-Pio([string[]]$PioArgs) {
    $cmd = Resolve-Pio
    if ($cmd -eq "uvx") {
        & uvx --from platformio pio @PioArgs
    } else {
        & $cmd @PioArgs
    }
    if ($LASTEXITCODE -ne 0) { throw "PlatformIO 命令失败 (exit $LASTEXITCODE)" }
}

switch ($Action) {
    "build" {
        Write-Host "[1/1] 编译 Seeed XIAO ESP32C3 固件..." -ForegroundColor Cyan
        Invoke-Pio @("run", "-d", $FirmwareDir)
        Write-Host "编译成功！固件位于: $FirmwareDir\.pio\build\xiao_esp32c3\firmware.bin" -ForegroundColor Green
    }
    "flash" {
        $argsList = @("run", "-d", $FirmwareDir, "-t", "upload")
        if ($Port) { $argsList += @("--upload-port", $Port) }
        Write-Host "[1/1] 烧录固件至手环 ($($Port ? $Port : '自动识别串口'))..." -ForegroundColor Cyan
        Invoke-Pio $argsList
        Write-Host "烧录完成！可运行 -Action selftest -Port <COMx> 执行自动产测。" -ForegroundColor Green
    }
    "monitor" {
        $argsList = @("device", "monitor", "-b", "115200")
        if ($Port) { $argsList += @("-p", $Port) }
        Invoke-Pio $argsList
    }
    "selftest" {
        if (-not $Port) { throw "产测模式需要指定串口，例如 -Port COM5" }
        Write-Host "连接 $Port 执行一键产测 (TEST + INFO)..." -ForegroundColor Cyan
        $sp = New-Object System.IO.Ports.SerialPort $Port, 115200, None, 8, One
        $sp.ReadTimeout = 1500
        $sp.Open()
        try {
            Start-Sleep -Milliseconds 300
            $sp.WriteLine("INFO")
            $sp.WriteLine("TEST")
            $deadline = (Get-Date).AddSeconds(4)
            $passed = $false
            while ((Get-Date) -lt $deadline) {
                try {
                    $line = $sp.ReadLine()
                    Write-Host "  $line"
                    if ($line -match "FACTORY SELF-TEST RESULT: PASS") { $passed = $true }
                } catch [System.TimeoutException] { break }
            }
            if (-not $passed) {
                throw "产测未收到 PASS 结果，请检查 LIS2DH12/PN532 接线与供电！"
            }
            Write-Host "单板产测全部通过！可贴二维码标签并装壳。" -ForegroundColor Green
        } finally {
            $sp.Close()
        }
    }
}
