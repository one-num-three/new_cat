"""
编译真实 C++17 猫鼠手环固件节点 (band_node.exe) —— 直接编译 firmware/src/*.cpp 全部 8 个真实固件源文件！
使用 D 盘 ziglang 编译器，不占用 C 盘空间。
"""
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
FW_INC = ROOT / "firmware" / "include"
FW_SRC = ROOT / "firmware" / "src"
SIM_HAL = ROOT / "sim" / "hal"
OUT_DIR = pathlib.Path(r"D:\.catmouse_sim_build") if pathlib.Path("D:\\").exists() else (ROOT / "sim" / "build")
OUT_EXE = OUT_DIR / ("band_node.exe" if os.name == "nt" else "band_node")


def build():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = sorted(FW_SRC.glob("*.cpp")) + [SIM_HAL / "sim_platform.cpp"]
    print(f"[BUILD] 正在直接编译 {len(sources)} 个真实 C++ 源文件 -> {OUT_EXE}")
    for s in sources:
        print(f"        - {s.relative_to(ROOT)}")

    env = os.environ.copy()
    if pathlib.Path("D:\\").exists():
        env["UV_CACHE_DIR"] = r"D:\.uv_cache"
        env["UV_TOOL_DIR"] = r"D:\.uv_tools"
        env["ZIG_GLOBAL_CACHE_DIR"] = r"D:\.zig_cache"
        env["ZIG_LOCAL_CACHE_DIR"] = r"D:\.zig_cache"

    cmd = [
        "uvx",
        "--index-url",
        "https://pypi.tuna.tsinghua.edu.cn/simple",
        "--from",
        "ziglang",
        "python-zig",
        "c++",
        "-std=c++17",
        "-O2",
        "-Wall",
        "-Wextra",
        f"-I{SIM_HAL}",
        f"-I{FW_INC}",
        *[str(s) for s in sources],
        "-o",
        str(OUT_EXE),
    ]
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if res.stdout:
        print(res.stdout)
    if res.stderr:
        print(res.stderr)
    if res.returncode != 0:
        print(f"[FAIL] 编译失败 (exit {res.returncode})", file=sys.stderr)
        sys.exit(res.returncode)
    print(f"[PASS] 真实固件节点编译成功（零错误）！输出: {OUT_EXE}")
    return OUT_EXE


if __name__ == "__main__":
    build()
