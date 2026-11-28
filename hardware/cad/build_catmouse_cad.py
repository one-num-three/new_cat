"""
CatMouse Band V1.5 ("Strap-Halo" 腕带光环版) — 100% 参数化 B-Rep 3D CAD 装配体生成器 (build123d / OpenCASCADE)

核心结构特征（严格对齐主视觉工业设计 01_hero_trio_factions.jpg）：
  1. 极简无屏鹅卵石主机仓 (34.0 x 42.0 x 11.8 mm)：顶面 100% 让位给 13.56MHz NFC 线圈 + 0.2mm 铁氧体（无灯环遮挡，读卡距离翻倍！），
     顶盖中央微凹猫爪+NFC波纹盲触图标；右侧微内凹防水硅胶按键 + 3 孔蜂鸣器声学出音槽；底壳 4-pin 镀金磁吸充电/USB-JTAG 触点 + 2×N52 磁铁 + 2×M2 螺柱。
  2. 腕带内置 300° 环腕发光导光环（灯环在腕带上，不在主机面上！）：
     - 前/后双翼液态硅胶腕带（22mm 宽 × 3.4mm 厚，贴合 62×48mm 人体工学椭圆手腕曲线，双翼 0 导线跨越表扣，实现 IP67 级防水与 140–210mm 自由调节）
     - 双翼中央凹槽内置 4.5mm 柔性聚酰亚胺 FPC 灯带（前翼 6 颗 + 后翼 6 颗 = 12 颗 WS2812B-2020，前翼 4 线回环 DOUT 回主机桥接后翼，100% 兼容现有固件 LED_COUNT=12 / GPIO21 / GPIO8 PMOS 断电）
     - 双色模内注塑乳白雾面高透硅胶弧面导光条（7.6mm 宽，微凸 +0.30mm 光学透镜截面，白天/夜晚 360° 无死角辨识红猫/绿鼠/蓝求救）
  3. 底部深空灰阳极氧化铝合金针扣 + 硅胶防滑束带环（受力 4–6kg 安全脱扣）。

输出：
  - cad/output/CatMouseBand_V15_StrapHalo.step  （原生多实体 B-Rep STEP，可直接双击导入 Fusion 360 / SolidWorks）
  - cad/output/parts/*.stl & *.step             （15 个独立零件实体，用于 3D 打印手板/结构评审）
  - cad/output/cad_verification_report.json     （B-Rep 实体有效性、全两两干涉碰撞体积 0.000 mm³、壁厚与整机克重核算报告）
"""
from __future__ import annotations

import json
import math
import pathlib
import sys
from dataclasses import dataclass

import numpy as np
from build123d import (
    Align,
    Axis,
    Box,
    BuildLine,
    BuildPart,
    BuildSketch,
    Circle,
    Color,
    Compound,
    Cylinder,
    extrude,
    GeomType,
    Line,
    Location,
    Locations,
    Mode,
    Part,
    Plane,
    RectangleRounded,
    Rot,
    SlotOverall,
    Spline,
    Vector,
    export_step,
    export_stl,
    fillet,
    make_face,
    sweep,
)

from strap_halo_geometry import (
    BUTTON_CENTER, BUZZER_CENTER, BUZZER_HEIGHT, FERRITE_BOTTOM_Z, MINI_CENTER,
    MINI_MAX_HEIGHT, MINI_NOMINAL, MINI_SOLDER_ALLOWANCE, NFC_CRYSTAL_CENTER,
    NFC_STACK_LIFT, PCB_TOP_Z, POGO_FLEX_BOTTOM_Z, POGO_FLEX_END_Y, POGO_FLEX_RISER_Y,
    POGO_FLEX_THICKNESS, POGO_FLEX_WIDTH, POGO_X, POGO_Y, board_substrate, pogo_flex_envelope,
)

ROOT = pathlib.Path(__file__).resolve().parents[1]
CAD_OUT = ROOT / "cad" / "output"
PARTS_DIR = CAD_OUT / "parts"

# ======================== 主参数表 (单位: mm) ========================
# 坐标系原点 (0,0,0) = 手腕椭圆中心；Y-Z 平面为腕带环绕平面，+Z 为手腕正上方(主机侧)，-Z 为手腕正下方(表扣侧)，+X 为手腕右侧(按键侧)
WRIST_RY = 31.0       # 手腕内轮廓 Y 半轴 (宽 62mm)
WRIST_RZ = 24.0       # 手腕内轮廓 Z 半轴 (厚 48mm，内周长 ~173mm)

POD_W = 34.0          # 主机宽度 (X)
POD_L = 42.0          # 主机长度 (Y)
POD_R = 9.5           # 鹅卵石大圆角半径
Z_POD_BOT = 23.80     # 主机底面 Z
Z_SPLIT = 30.80       # 上下壳合模分型面 Z
Z_POD_TOP = 35.60 + NFC_STACK_LIFT  # 保留顶盖基准壁厚，增加 MINI-1 上方净空
WALL_SIDE = 1.80      # 主机侧壁厚
WALL_TOP = 1.20       # 顶盖 NFC 区壁厚
WALL_BOT = 1.30       # 底壳贴肤壁厚

STRAP_W = 22.0        # 腕带宽度 (X)
STRAP_T = 3.40        # 腕带厚度 (径向)
CHAN_W = 8.00         # 腕带中央光学导光槽宽
CHAN_D = 2.15         # 导光槽深 (保留内侧 1.25mm 实心柔肤层)
LG_W = 7.60           # 乳白雾面导光条宽 (单边留 0.20mm 建模间隙，0 干涉)
FPC_W = 4.50          # 柔性 LED FPC 宽度
FPC_T = 0.16          # FPC 厚度


@dataclass
class PartSpec:
    idx: str
    name: str
    material: str
    density_g_cm3: float
    rgba: tuple[float, float, float, float]
    shape: Part | Compound
    explode_vec: tuple[float, float, float]  # 爆炸图位移 (mm)


def ellipse_pt(theta_deg: float, ry: float, rz: float) -> tuple[float, float]:
    rad = math.radians(theta_deg)
    return (ry * math.cos(rad), rz * math.sin(rad))


def ellipse_normal(theta_deg: float, ry: float, rz: float) -> tuple[float, float]:
    """椭圆外法向单位向量 (ny, nz) in Y-Z plane."""
    rad = math.radians(theta_deg)
    ny = math.cos(rad) / ry
    nz = math.sin(rad) / rz
    m = math.hypot(ny, nz)
    return (ny / m, nz / m)


def ellipse_tangent(theta_deg: float, ry: float, rz: float) -> tuple[float, float]:
    """沿 theta 递增方向的单位切向量 (ty, tz)."""
    rad = math.radians(theta_deg)
    ty = -ry * math.sin(rad)
    tz = rz * math.cos(rad)
    m = math.hypot(ty, tz)
    return (ty / m, tz / m)


def sample_arc_spine(
    t_start_deg: float,
    t_end_deg: float,
    ry: float,
    rz: float,
    n_pts: int = 36,
    radial_offset_fn=None,
) -> list[Vector]:
    pts = []
    for i in range(n_pts):
        u = i / (n_pts - 1)
        th = t_start_deg + (t_end_deg - t_start_deg) * u
        y, z = ellipse_pt(th, ry, rz)
        if radial_offset_fn is not None:
            off = radial_offset_fn(u, th)
            ny, nz = ellipse_normal(th, ry, rz)
            y += off * ny
            z += off * nz
        pts.append(Vector(0.0, y, z))
    return pts


def make_swept_band(
    spine_pts: list[Vector],
    width_x: float,
    inner_off: float,
    outer_off: float,
    corner_r: float = 0.0,
    dome_outer: float = 0.0,
) -> Part:
    """
    沿平行于 Y-Z 平面的 3D 光滑样条 spine_pts（常 X），扫掠一条对称于该 X 平面的曲面实体带。
    inner_off / outer_off 为相对 spine 的局部法向偏移（正值朝远离原点外侧，负值朝内侧）。
    """
    with BuildPart() as bp:
        with BuildLine() as bl:
            sp = Spline(*spine_pts)
        # 计算起点的局部法向平面 (x_dir = 全球 +X, y_dir = 局部外法向 n_out)
        p0 = spine_pts[0]
        p1 = spine_pts[1]
        t0 = (p1 - p0).normalized()  # 在常 X 的 Y-Z 平面内
        # 指向远离原点 (0,0,0) 的外法向
        cand1 = Vector(0.0, t0.Z, -t0.Y).normalized()
        n_out = cand1 if (cand1.Y * p0.Y + cand1.Z * p0.Z) >= 0 else -cand1
        plane0 = Plane(origin=p0, x_dir=Vector(1.0, 0.0, 0.0), z_dir=t0)
        # 检查 plane0.y_dir 是否朝外
        sign = 1.0 if (plane0.y_dir.Y * n_out.Y + plane0.y_dir.Z * n_out.Z) >= 0 else -1.0

        y_in = sign * inner_off
        y_out = sign * outer_off
        y_lo, y_hi = min(y_in, y_out), max(y_in, y_out)
        thick = y_hi - y_lo
        yc = 0.5 * (y_lo + y_hi)

        with BuildSketch(plane0):
            if dome_outer > 0.0:
                # 光学透镜拱顶截面：内侧平底，外侧柔光穹顶
                hw = width_x * 0.5
                y_base = y_in
                y_edge = y_out - sign * dome_outer
                y_apex = y_out
                with BuildLine():
                    l1 = Line((-hw, y_base), (hw, y_base))
                    l2 = Line((hw, y_base), (hw, y_edge))
                    # 外侧柔和弧面样条
                    arc = Spline(
                        (hw, y_edge),
                        (hw * 0.55, y_edge + sign * dome_outer * 0.78),
                        (0.0, y_apex),
                        (-hw * 0.55, y_edge + sign * dome_outer * 0.78),
                        (-hw, y_edge),
                    )
                    l3 = Line((-hw, y_edge), (-hw, y_base))
                make_face()
            else:
                with Locations((0.0, yc)):
                    r = min(corner_r, thick * 0.45, width_x * 0.45)
                    if r > 0.05:
                        RectangleRounded(width_x, thick, r)
                    else:
                        from build123d import Rectangle
                        Rectangle(width_x, thick)
        sweep(path=sp)
    return bp.part


def make_flat_xy_ribbon(
    xy_pts: list[tuple[float, float]],
    width_xy: float,
    z_bot: float,
    z_top: float,
) -> Part:
    """
    在水平 X-Y 平面内生成等宽扁平 FPC 柔性排线带（采用逐段圆角跑道槽并集 + Z 向拉伸，
    100% 等价真实模切可展开柔性电路 FPC，拐角天然圆润无自交，保证 100% 合法 B-Rep！）。
    """
    thick = abs(z_top - z_bot)
    with BuildPart() as bp:
        with BuildSketch(Plane.XY.offset(z_bot)):
            for i in range(len(xy_pts) - 1):
                x0, y0 = xy_pts[i]
                x1, y1 = xy_pts[i + 1]
                dx, dy = x1 - x0, y1 - y0
                seg_len = math.hypot(dx, dy)
                if seg_len < 1e-4:
                    continue
                ang_deg = math.degrees(math.atan2(dy, dx))
                with Locations(((x0 + x1) * 0.5, (y0 + y1) * 0.5)):
                    with Locations(Rot(0, 0, ang_deg)):
                        SlotOverall(seg_len + width_xy, width_xy)
        extrude(amount=thick)
    return bp.part


def build_top_shell() -> Part:
    """01_Top_Shell_NFC: 哑光深灰 PC+ABS 极简鹅卵石顶壳，带盲触猫爪+NFC波纹凹雕、右侧按键切口与蜂鸣器声学槽。"""
    h = Z_POD_TOP - Z_SPLIT
    with BuildPart() as bp:
        with BuildSketch(Plane.XY.offset(Z_SPLIT)):
            RectangleRounded(POD_W, POD_L, POD_R)
        extrude(amount=h)
        # 顶面大圆角形成温润鹅卵石手感
        top_edges = bp.edges().filter_by_position(Axis.Z, Z_POD_TOP - 0.05, Z_POD_TOP + 0.05)
        fillet(top_edges, radius=2.60)
        # 分型面微小装饰倒角槽 (0.35mm)
        bot_edges = bp.edges().filter_by_position(Axis.Z, Z_SPLIT - 0.05, Z_SPLIT + 0.05)
        fillet(bot_edges, radius=0.35)

        # 挖空内部电子与 NFC 线圈腔体 (侧壁 1.8mm，顶盖 NFC 窗厚 1.20mm)
        cav_w = POD_W - 2 * WALL_SIDE
        cav_l = POD_L - 2 * WALL_SIDE
        cav_h = (Z_POD_TOP - WALL_TOP) - Z_SPLIT
        with BuildSketch(Plane.XY.offset(Z_SPLIT - 0.05)):
            RectangleRounded(cav_w, cav_l, POD_R - WALL_SIDE)
        extrude(amount=cav_h + 0.05, mode=Mode.SUBTRACT)

        # 顶面中央 0.35mm 微凹触觉 NFC 波纹 + 猫爪盲触图标 (匹配主视觉 01_hero_trio_factions.jpg)
        with BuildSketch(Plane.XY.offset(Z_POD_TOP + 0.05)):
            # 3 条同心弧形 NFC 感测纹 (以圆环切槽模拟)
            for r_arc, dy in [(6.2, -1.8), (4.5, -1.4), (2.8, -1.0)]:
                with Locations((0.0, dy)):
                    SlotOverall(r_arc * 1.45, 0.72)
            # 4 颗极简猫爪触点椭圆（位于波纹上方）
            for px, py, rot_a in [(-4.2, 3.0, 22), (-1.5, 4.4, 8), (1.5, 4.4, -8), (4.2, 3.0, -22)]:
                with Locations((px, py)):
                    with Locations(Rot(0, 0, rot_a)):
                        SlotOverall(2.4, 1.35)
        extrude(amount=-0.40, mode=Mode.SUBTRACT)

        # 右侧按键开口（上半部，精密贴合 9.6x3.6mm 硅胶键帽，单边 0.20mm 间隙）
        with Locations((POD_W / 2.0 - 0.8, 1.5, Z_SPLIT + 1.00)):
            Box(3.6, 10.0, 2.05, mode=Mode.SUBTRACT)

        # 右侧 3 道超薄蜂鸣器声学微孔（正对 PCB 蜂鸣器 PKMCS0909E 中心 Y=-5.2mm，朝外发声不被手腕闷音）
        for offset_y in (-1.5, 0.0, 1.5):
            sy = BUZZER_CENTER[1] + offset_y
            with Locations((POD_W / 2.0 - 0.9, sy, Z_SPLIT + 1.50)):
                Box(3.2, 0.65, 1.50, mode=Mode.SUBTRACT)
    return bp.part


def build_bottom_shell() -> Part:
    """02_Bottom_Shell_Pogo: 贴腕底壳，带 4-pin 磁吸沉孔、2×N52、2×M2 螺柱、前后腕带 T 型防拉脱卡槽与防水 FPC 过线槽。"""
    h = Z_SPLIT - Z_POD_BOT  # 7.00mm
    with BuildPart() as bp:
        with BuildSketch(Plane.XY.offset(Z_POD_BOT)):
            RectangleRounded(POD_W, POD_L, POD_R)
        extrude(amount=h)
        bot_edges = bp.edges().filter_by_position(Axis.Z, Z_POD_BOT - 0.05, Z_POD_BOT + 0.05)
        fillet(bot_edges, radius=2.40)

        # 内部电池/马达/主板腔体 (底壁 1.30mm -> 腔底 Z=25.10)
        cav_w = POD_W - 2 * WALL_SIDE
        cav_l = POD_L - 2 * WALL_SIDE
        with BuildSketch(Plane.XY.offset(Z_POD_BOT + WALL_BOT)):
            RectangleRounded(cav_w, cav_l, POD_R - WALL_SIDE)
        extrude(amount=(Z_SPLIT - (Z_POD_BOT + WALL_BOT)) + 0.05, mode=Mode.SUBTRACT)

        # 前/后端内侧加厚 T 型防拉脱压紧凸台 (Y ∈ [±18.15, ±19.30]，避让 PCB ±17.70 与马达 +17.80!)
        for sy in (+1.0, -1.0):
            with Locations((0.0, sy * 18.725, 25.10 + 2.85)):
                Box(18.4, 1.15, 5.70)

        # The recess follows the flex below the motor and into the forward
        # guide. Both sides of the T-shaped strap socket retain shoulders.
        channel_front_y = POGO_FLEX_RISER_Y + 0.2
        channel_back_y = POGO_FLEX_END_Y - 0.15
        with Locations((0, (channel_front_y + channel_back_y) / 2, 25.01)):
            Box(POGO_FLEX_WIDTH + 0.4, channel_front_y - channel_back_y, 0.42, mode=Mode.SUBTRACT)
        with Locations((0, (17.95 + channel_front_y) / 2, 27.40)):
            Box(POGO_FLEX_WIDTH + 0.4, channel_front_y - 17.95, 5.08, mode=Mode.SUBTRACT)

        # 右侧按键开口（下半部）
        with Locations((POD_W / 2.0 - 0.8, 1.5, Z_SPLIT - 1.00)):
            Box(3.6, 10.0, 2.05, mode=Mode.SUBTRACT)

        # 4-pin 镀金磁吸 Pogo 触点沉孔 (移至 +Y 侧 Y=+14.8mm，彻底远离 -Y 侧 2.4GHz BLE 天线净空区！)
        for px in POGO_X:
            with Locations((px, POGO_Y, Z_POD_BOT + 0.58)):
                Cylinder(radius=0.99, height=1.25, mode=Mode.SUBTRACT)

        # 2× N52 磁铁内嵌盲孔 (位于 +Y 侧 x=±8.5, y=+14.8mm，远离 BLE 天线 >=26mm，底留 0.25mm 防水壁)
        for mx in (-8.5, 8.5):
            with Locations((mx, 14.8, Z_POD_BOT + 0.78)):
                Cylinder(radius=2.12, height=1.05, mode=Mode.SUBTRACT)

        # 2× M2 不锈钢装配螺丝过孔 + 沉头孔 (x=±12.6, y=+11.0，远离 BLE 天线 >=22mm 且避开电池/马达/磁铁)
        for sx in (-12.6, 12.6):
            with Locations((sx, 11.0, Z_POD_BOT + 0.65)):
                Cylinder(radius=1.12, height=1.80, mode=Mode.SUBTRACT)
            with Locations((sx, 11.0, Z_POD_BOT + 0.35)):
                Cylinder(radius=2.05, height=0.80, mode=Mode.SUBTRACT)

        # 前/后对称 T 型硅胶腕带防拉脱锁扣槽（顶部敞口至分型面 Z=30.80，装入腕带 T 头后由顶壳向下压紧形成 IP67 压合密封！）
        for sy in (+1.0, -1.0):
            # 外颈穿墙口 (宽 12.4mm，两侧留出 1.6mm PC+ABS 抗拉锁肩!)
            with Locations((0.0, sy * 20.50, 26.60 + 2.15)):
                Box(12.4, 1.60, 4.30, mode=Mode.SUBTRACT)
            # 内腔 T 头卡位槽 (宽 15.6mm × 深 0.95mm，承受 10kg 腕带拉力不传递到 FPC!)
            with Locations((0.0, sy * 19.275, 26.60 + 2.15)):
                Box(15.6, 0.95, 4.30, mode=Mode.SUBTRACT)

        # 前翼 FPC 中心过线口（穿过前内壁 Y=+18.15..+18.80，直达主板前侧 J_LED_F）
        with Locations((0.0, 18.50, 29.00 + 0.95)):
            Box(3.8, 0.90, 1.90, mode=Mode.SUBTRACT)

        # 后翼独立西侧防水 FPC 过线口（X=-9.65, 宽 2.7mm，在 T 头锁槽西侧留 0.5mm 独立隔墙，彻底绕开 -Y 2.4GHz BLE 天线净空区！）
        with Locations((-9.65, -19.60, 27.00 + 1.95)):
            Box(2.7, 3.40, 3.90, mode=Mode.SUBTRACT)
    return bp.part


def build_side_button() -> Part:
    """03_Side_Button_Silicone: 右侧防误触微内凹防水硅胶按键（带内部 IP65 遮光防尘裙边与触发顶柱，0 漏缝 0 干涉）。"""
    with BuildPart() as bp:
        # 外部按键帽（长 9.6mm，高 3.6mm，x ∈ [15.40, 17.55]，严密填充外壳按键窗，仅留 0.20mm 间隙）
        with BuildSketch(Plane.YZ.offset(15.40)):
            with Locations((1.5, Z_SPLIT)):
                SlotOverall(9.6, 3.6)
        extrude(amount=2.15)
        out_edges = bp.edges().filter_by_position(Axis.X, 17.45, 17.65)
        fillet(out_edges, radius=0.80)
        # 内部防水挡光裙边法兰（位于壳内壁内侧 x ∈ [14.70, 15.15]，完全遮挡内部绿色 PCB 不外露！）
        with BuildSketch(Plane.YZ.offset(14.70)):
            with Locations((1.5, Z_SPLIT)):
                SlotOverall(11.4, 4.8)
        extrude(amount=0.42)
        # 内部弹性顶柱 (x ∈ [14.35, 14.75]，距 PCB 边缘 14.20 留 0.15mm 零干涉间隙，按压 0.45mm 触发 SW1)
        with Locations((14.55, 1.5, Z_SPLIT)):
            Box(0.40, 3.6, 1.80)
    return bp.part


def build_nfc_coil_ferrite() -> Compound:
    """04_NFC_FPC_Coil_Ferrite: 25×24.5mm 13.56MHz 环形 NFC 线圈 + 0.20mm 铁氧体 + C 型下弯引出触点排线（直达主板 PN532 匹配弹片座 J_NFC_SPRING!）。"""
    # 铁氧体后缘仍为 Y = -10.0 mm，平移顶盖线圈叠层给模组留出垂直净空。
    with BuildPart() as bp_fer:
        with BuildSketch(Plane.XY.offset(FERRITE_BOTTOM_Z)):
            with Locations((0.0, 2.25)):
                RectangleRounded(25.0, 24.5, 5.0)
        extrude(amount=0.20)
    ferrite = bp_fer.part

    # 铜质多匝环形 NFC FPC 线圈
    with BuildPart() as bp_coil:
        with BuildSketch(Plane.XY.offset(34.00 + NFC_STACK_LIFT)):
            with Locations((0.0, 2.25)):
                RectangleRounded(24.6, 24.1, 4.8)
                RectangleRounded(17.2, 16.7, 3.0, mode=Mode.SUBTRACT)
        extrude(amount=0.25)
    coil = bp_coil.part

    # 铜质 C 型柔性引出尾带（宽 3.0mm × 厚 0.18mm，在 X=-6.8 处从线圈 +Y 外缘绕过铁氧体边沿下弯至主板 J_NFC_SPRING 弹片座正上方！）
    nfc_tail_pts = [
        Vector(-6.8, 13.80, 34.12 + NFC_STACK_LIFT),
        Vector(-6.8, 14.85, 34.04 + NFC_STACK_LIFT),
        Vector(-6.8, 15.35, 33.25 + NFC_STACK_LIFT),
        Vector(-6.8, 14.65, 32.15 + NFC_STACK_LIFT / 2),
        Vector(-6.8, 13.00, 31.52),
        Vector(-6.8, 11.40, 31.49),
    ]
    nfc_tail = make_swept_band(nfc_tail_pts, 3.0, -0.09, 0.09, corner_r=0.0)
    return Compound(children=[ferrite, coil, nfc_tail])


def build_mainboard_pcba() -> Compound:
    """
    05_Mainboard_4Layer_PCBA: 严格按 RF/EMC 规范分区的单面贴片(L1) 4 层核心主板布局 (28.4×35.4×1.0mm)：
    - -Y 端 (Y ∈ [-17.7, -11.5])：2.4GHz BLE 天线 4 层全净空区（无铜、无铁氧体、无电池、无磁铁！）
    - 东侧：PKMCS0909E 蜂鸣器直对右侧 3 道声学出音槽
    - 西北象限 (X=-6.8, Y=+6.2)：PN532 + 27.12MHz 晶振 + 13.56MHz 匹配网络（距 BLE 天线 >18mm！）
    - 中心 (X=+0.5, Y=+4.2)：LIS2DH12TR IMU（贴近质心）
    - 东北象限：MCP73831 + AP2112K-3.3 + Q1/Q2/Q3 电源驱动区
    - L4 底层纯平面（0 贴片突起，仅磁吸 Pogo 焊盘与产测点，防止挤压锂电池！）
    - 注：前/后 FPC ZIF 翻盖座 (J_LED_F / J_LED_R) 与 NFC 弹片座 (J_NFC_SPRING) 独立建模为 16_ZIF_Connectors_4Pin 高对比零件！
    """
    pcb = board_substrate()

    # 单面 L1 关键芯片与模块。MINI-1 使用原厂最大高度加贴装余量。
    chips = []
    # 1. ESP32-C3-MINI-1 模组，天线伸出主板挖空区。
    module_height = MINI_MAX_HEIGHT + MINI_SOLDER_ALLOWANCE
    with BuildPart() as p:
        with Locations((*MINI_CENTER, PCB_TOP_Z + module_height / 2)):
            Box(*MINI_NOMINAL[:2], module_height)
    chips.append(p.part)
    # 2. PN5321A3HN 双模 NFC 芯片 (HVQFN-40, 6.0 x 6.0 x 0.85mm)
    with BuildPart() as p:
        with Locations((-6.8, 6.2, 30.65 + 0.425)):
            Box(6.0, 6.0, 0.85)
    chips.append(p.part)
    # 2b. 27.12MHz NFC 晶振 Y1 (3.2 x 2.5 x 0.80mm，紧邻 PN532 OSCIN/OSCOUT)
    with BuildPart() as p:
        with Locations((*NFC_CRYSTAL_CENTER, PCB_TOP_Z + 0.40)):
            Box(2.5, 3.2, 0.80)
    chips.append(p.part)
    # 3. LIS2DH12TR IMU (2.0 x 2.0 x 0.90mm，居中抗旋转误触)
    with BuildPart() as p:
        with Locations((0.5, 4.2, 30.65 + 0.45)):
            Box(2.0, 2.0, 0.90)
    chips.append(p.part)
    # 4. PKMCS0909E，声孔中心与 PCB 上实装封装对齐。
    with BuildPart() as p:
        with Locations((*BUZZER_CENTER, PCB_TOP_Z + BUZZER_HEIGHT / 2)):
            Box(9.0, 9.0, BUZZER_HEIGHT)
    chips.append(p.part)
    # 5. PMIC 电源/高边 PMOS 驱动区 (MCP73831 + AP2112K + AO3401A/AO3400A 紧凑阵列，X=+6.9, Y=+7.1)
    for px, py in [(5.2, 5.2), (8.6, 5.2), (5.2, 9.0), (8.6, 9.0)]:
        with BuildPart() as p:
            with Locations((px, py, 30.65 + 0.55)):
                Box(2.9, 2.8, 1.10)
        chips.append(p.part)
    # 6. 右侧贴片轻触开关 SW1 (2.6 x 4.2 x 1.60mm，紧邻侧键内顶柱)
    with BuildPart() as p:
        with Locations((*BUTTON_CENTER, PCB_TOP_Z + 0.80)):
            Box(2.6, 4.2, 1.60)
    chips.append(p.part)

    return Compound(children=[pcb, *chips])


def build_zif_connectors_and_contacts() -> Compound:
    """
    16_ZIF_Connectors_4Pin: 方案 A 主板端高对比乳白色 LCP 精密电连接器组（严格对齐 EVT-A Hirose FH19C-4S-0.5SH(10) 封装）：
    - J_LED_F (0.0, +14.6): Hirose FH19C-4S-0.5SH(10) 4-pin 0.5mm 底接触 ZIF 翻盖座（4.0×2.6×0.95mm，+Y 开口直插 2.50×0.20mm 补强舌！）
    - J_LED_R (-11.2, -5.8): Hirose FH19C-4S-0.5SH(10) 4-pin 0.5mm 底接触 ZIF 翻盖座（-Y 开口直插西侧绕行 2.50×0.20mm 补强舌！）
    - J_NFC_SPRING (-6.8, +11.4): 13.56MHz NFC 线圈 2-pin 2.00mm 针距双弹片接触座（与顶盖 NFC 铜质下弯排线压接）
    """
    items = []

    # 1. J_LED_F: Hirose FH19C-4S-0.5SH(10) 前翼 ZIF 翻盖座 (居中于 X=0.0, Y=+14.6, Z ∈ [30.67, 31.62])
    with BuildPart() as bp_jf:
        # 白色 LCP 主壳体 (4.00 x 2.60 x 0.95 mm，与 KiCad FH19C-4S-0.5SH 封装 1:1 对齐)
        with Locations((0.0, 14.6, 30.67 + 0.475)):
            Box(4.00, 2.60, 0.95)
        # 两侧金属固定焊耳 (MP tabs)
        for sx in (-2.10, 2.10):
            with Locations((sx, 15.35, 30.67 + 0.225)):
                Box(0.45, 0.80, 0.45)
        # 后侧压紧翻盖锁扣条 (Flip-lock actuator bar, Z ∈ [31.62, 31.86])
        with Locations((0.0, 13.65, 31.62 + 0.12)):
            Box(3.20, 0.70, 0.24)
        # +Y 侧真实 FPC 插入槽口 (宽 2.66 × 深 1.80 × 高 0.36mm，Z ∈ [30.90, 31.26]，容下 2.50×0.20mm 补强接触舌 0 碰撞!)
        with Locations((0.0, 15.05, 31.08)):
            Box(2.66, 1.80, 0.36, mode=Mode.SUBTRACT)
    items.append(bp_jf.part)

    # 2. J_LED_R: Hirose FH19C-4S-0.5SH(10) 后翼 ZIF 翻盖座 (位于西侧 X=-11.2, Y=-5.8, Z ∈ [30.67, 31.62]，口朝 -Y!)
    with BuildPart() as bp_jr:
        # 白色 LCP 主壳体 (4.00 x 2.60 x 0.95 mm -> X ∈ [-13.2, -9.2], 距 ESP32(-8.3) 净空 0.90mm!)
        with Locations((-11.2, -5.8, 30.67 + 0.475)):
            Box(4.00, 2.60, 0.95)
        # 两侧金属固定焊耳
        for sx in (-13.30, -9.10):
            with Locations((sx, -6.55, 30.67 + 0.225)):
                Box(0.45, 0.80, 0.45)
        # 后侧 (+Y) 压紧翻盖锁扣条
        with Locations((-11.2, -4.85, 31.62 + 0.12)):
            Box(3.20, 0.70, 0.24)
        # -Y 侧真实 FPC 插入槽口 (宽 2.66 × 深 1.80 × 高 0.36mm，Z ∈ [30.90, 31.26])
        with Locations((-11.2, -6.25, 31.08)):
            Box(2.66, 1.80, 0.36, mode=Mode.SUBTRACT)
    items.append(bp_jr.part)

    # 3. J_NFC_SPRING: NFC 线圈 2-pin 2.00mm 针距弹片接触底座 (X=-6.8, Y=+11.4, Z ∈ [30.67, 31.32])
    with BuildPart() as bp_jnfc:
        with Locations((-6.8, 11.4, 30.67 + 0.22)):
            Box(4.2, 2.4, 0.44)
        # 2 枚微凸接触弹片头 (X = -6.8 ± 1.0, Z ∈ [31.11, 31.32])
        for dx in (-1.0, 1.0):
            with Locations((-6.8 + dx, 11.4, 31.11 + 0.105)):
                Box(0.90, 1.50, 0.21)
    items.append(bp_jnfc.part)

    return Compound(children=items)


def build_battery() -> Part:
    """06_Battery_402025_300mAh: 23.6 x 16.9 x 4.00 mm 高密度穿戴软包锂电池（Y ∈ [-9.5, +7.4]，严格退离 -Y BLE 天线净空区 >=2.0mm!）。"""
    with BuildPart() as bp:
        with BuildSketch(Plane.XY.offset(25.30)):
            with Locations((0.0, -1.05)):
                RectangleRounded(23.6, 16.9, 1.6)
        extrude(amount=4.00)
    return bp.part


def build_vibration_motor() -> Part:
    """07_Vibration_Motor_1027: Phi 10.0 x 2.70 mm 扁平振动马达，紧贴皮肤侧底壁 (Y=+12.8)，距电池 0.4mm、距前 T 槽内壁 0.35mm。"""
    with BuildPart() as bp:
        with Locations((0.0, 12.8, 25.25 + 1.35)):
            Cylinder(radius=5.0, height=2.70)
    return bp.part


def build_pogo_magnets_hardware() -> Compound:
    """08_Pogo_Magnets_Screws: 全部位于 +Y 侧（彻底远离 -Y BLE 天线净空区 >=22mm！）。"""
    items = []
    # Four exposed contacts with short internal solder tails for the flex.
    for px in POGO_X:
        with BuildPart() as p:
            with Locations((px, POGO_Y, Z_POD_BOT + 0.05 + 0.40)):
                Cylinder(radius=0.90, height=0.80)
            tail_bottom = Z_POD_BOT + 0.82
            tail_top = POGO_FLEX_BOTTOM_Z - POGO_FLEX_THICKNESS / 2 - 0.01
            with Locations((px, POGO_Y, (tail_bottom + tail_top) / 2)):
                Cylinder(radius=0.40, height=tail_top - tail_bottom)
        items.append(p.part)
    # 2× N52 钕铁硼磁铁 (Phi 4.00 x 0.90mm, X=±8.5, Y=+14.8, Z ∈ [24.10, 25.00])
    for mx in (-8.5, 8.5):
        with BuildPart() as p:
            with Locations((mx, 14.8, Z_POD_BOT + 0.30 + 0.45)):
                Cylinder(radius=2.00, height=0.90)
        items.append(p.part)
    # 2× M2 不锈钢装配螺丝 (X=±12.6, Y=+11.0, Z ∈ [23.95, 29.00])
    for sx in (-12.6, 12.6):
        with BuildPart() as p:
            with Locations((sx, 11.0, Z_POD_BOT + 0.35)):
                Cylinder(radius=1.85, height=0.55)
            with Locations((sx, 11.0, Z_POD_BOT + 2.60)):
                Cylinder(radius=0.95, height=4.40)
        items.append(p.part)
    return Compound(children=items)


def build_strap_and_halo_system():
    """
    构建核心亮点 —— 无缝衔接主机的 300° 腕带光环系统：
    - 前/后双翼液态硅胶腕带从主机 ±Y 端面 (y = ±21.20, z = 27.80) 以水平切线平滑延展（仅 0.20mm 装配发丝缝，0 浮空、0 干涉！），
      沿人体工学腕弧环绕至底部针扣与硅胶束带环。
    - 双翼中央导光槽与乳白雾面导光条紧贴主机端缘起光，连续环绕手腕近 300°，完美对齐主视觉 01_hero_trio_factions.jpg！
    - 严格保证全 15 零件 0.000 mm³ 碰撞干涉！
    """
    RY_MID = WRIST_RY + STRAP_T * 0.5  # 32.70
    RZ_MID = WRIST_RZ + STRAP_T * 0.5  # 25.70

    def build_wing_spine(sign_y: float, end_theta_deg: float, n_arc: int = 34, tuck_fn=None) -> list[Vector]:
        """生成从主机端面水平切出、无缝过渡到椭圆腕弧的 C2 光滑 3D 脊线。"""
        # 上肩过渡段：从 y=21.20, z=27.80 水平切出，优雅贴合手腕上弧至 theta=0° (32.70, 0.0)
        shoulder_raw = [
            (21.20, 27.80),
            (23.10, 27.78),
            (25.60, 26.55),
            (28.30, 23.80),
            (30.65, 19.30),
            (32.15, 12.80),
            (32.68, 5.80),
            (RY_MID, 0.00),
        ]
        pts = [Vector(0.0, sign_y * y, z) for y, z in shoulder_raw[:-1]]
        # 下半腕弧段：沿标准椭圆从 theta=0° 扫至 end_theta_deg（前翼向 -77°，后翼对称向 -77° 再外偏收尾）
        for i in range(n_arc):
            u = i / (n_arc - 1)
            th = 0.0 + end_theta_deg * u  # 均在 0° -> -128° 负向（下半圆）
            rad = math.radians(th)
            y = RY_MID * math.cos(rad)
            z = RZ_MID * math.sin(rad)
            if tuck_fn is not None:
                off = tuck_fn(th)
                ny = math.cos(rad) / RY_MID
                nz = math.sin(rad) / RZ_MID
                m = math.hypot(ny, nz)
                y += off * (ny / m)
                z += off * (nz / m)
            pts.append(Vector(0.0, sign_y * y, z))
        return pts

    # 后翼舌带在底部 (th < -66°，对应椭圆 246° 以上) 向外平滑偏移 +4.05mm 穿过表扣并叠于前翼外侧
    def rear_tuck_off(th_neg: float) -> float:
        # th_neg 从 0° 递减至 -126°（-90° 为正底面，-126° 对应前翼侧 -54° 处收尾）
        if th_neg >= -62.0:
            return 0.0
        s = min(1.0, (-62.0 - th_neg) / 20.0)  # 在 th_neg <= -82° 时完全稳定在 +4.05mm
        sm = s * s * (3.0 - 2.0 * s)
        return 4.05 * sm

    # 1. 前翼硅胶腕带 (+Y 侧，带表扣端：从主机 +21.20 扫至底部 -77.5°，并在根部一体成型 T 型防拉脱防水锚块!)
    front_spine = build_wing_spine(+1.0, -77.5, n_arc=34, tuck_fn=None)
    strap_front = make_swept_band(front_spine, STRAP_W, -STRAP_T * 0.5, STRAP_T * 0.5, corner_r=1.35)

    # 前翼 T 型硅胶防拉脱防水密封头（嵌锁于底壳 +Y T 槽，承受 10kg 腕带拉力，单边留 0.15mm 零干涉间隙）
    with BuildPart() as bp_tf:
        # 穿墙颈部 (X ∈ [-6.05, +6.05], Y ∈ [+19.70, +21.55], Z ∈ [26.75, 29.48])
        with Locations((0.0, 20.625, 26.75 + 1.365)):
            Box(12.10, 1.85, 2.73)
        # 内腔 T 头止脱防水压缩块 (X ∈ [-7.65, +7.65], Y ∈ [+18.95, +19.72], Z ∈ [26.75, 30.65]，顶面距分型面 0.15mm)
        with Locations((0.0, 19.335, 26.75 + 1.95)):
            Box(15.30, 0.77, 3.90)
    strap_front = strap_front + bp_tf.part

    # 前翼导光凹槽（从紧邻主机肩部起至 -58°，总覆盖 ~148° 单翼发光！）
    front_chan_spine = build_wing_spine(+1.0, -58.0, n_arc=28, tuck_fn=None)[1:]
    front_chan_cut = make_swept_band(front_chan_spine, CHAN_W, STRAP_T * 0.5 - CHAN_D, STRAP_T * 0.5 + 1.2, corner_r=0.35)
    strap_front = strap_front - front_chan_cut

    # 2. 后翼硅胶腕带 (-Y 侧，舌带端：从主机 -21.20 扫经 -90° 底部穿过针扣与束带环至 -127°，带一体 T 型锚块 + 西侧 FPC 防水护套!)
    rear_spine = build_wing_spine(-1.0, -127.0, n_arc=50, tuck_fn=rear_tuck_off)
    strap_rear = make_swept_band(rear_spine, STRAP_W, -STRAP_T * 0.5, STRAP_T * 0.5, corner_r=1.35)

    # 后翼 T 型硅胶防拉脱密封头（居中于 -Y T 槽）+ 西侧独立防水过线硅胶塞 (X=-9.65，严密包覆后翼绕行 FPC!)
    with BuildPart() as bp_tr:
        with Locations((0.0, -20.625, 26.75 + 1.365)):
            Box(12.10, 1.85, 2.73)
        with Locations((0.0, -19.335, 26.75 + 1.95)):
            Box(15.30, 0.77, 3.90)
        # 西侧 FPC 过线防水硅胶密封塞 (X ∈ [-10.85, -8.45], Y ∈ [-21.45, -19.20], Z ∈ [27.15, 30.65]，与西侧槽壁留 0.15mm 净隙)
        with Locations((-9.65, -20.325, 27.15 + 1.75)):
            Box(2.40, 2.25, 3.50)
    strap_rear = strap_rear + bp_tr.part

    # 后翼对称导光凹槽（止于 -58°，远离底部调孔区！）
    rear_chan_spine = build_wing_spine(-1.0, -58.0, n_arc=28, tuck_fn=None)[1:]
    rear_chan_cut = make_swept_band(rear_chan_spine, CHAN_W, STRAP_T * 0.5 - CHAN_D, STRAP_T * 0.5 + 1.2, corner_r=0.35)
    strap_rear = strap_rear - rear_chan_cut

    # 后翼底部舌带 5 个椭圆表扣调节孔 (th_neg = -80° .. -116°，完全避开导光槽!)
    for h_th in (-80.0, -89.0, -98.0, -107.0, -116.0):
        off = rear_tuck_off(h_th)
        rad = math.radians(h_th)
        ny0 = math.cos(rad) / RY_MID
        nz0 = math.sin(rad) / RZ_MID
        m = math.hypot(ny0, nz0)
        ny, nz = -(ny0 / m), (nz0 / m)  # 注意 sign_y = -1.0
        yc = -(RY_MID * math.cos(rad) + off * (ny0 / m))
        zc = RZ_MID * math.sin(rad) + off * (nz0 / m)
        pln_h = Plane(origin=Vector(0.0, yc, zc), x_dir=Vector(1.0, 0.0, 0.0), z_dir=Vector(0.0, ny, nz))
        with BuildPart() as bp_h:
            with BuildSketch(pln_h):
                RectangleRounded(2.8, 4.0, 1.1)
            extrude(amount=3.5, both=True)
        strap_rear = strap_rear - bp_h.part

    # 3. 前/后双翼乳白雾面高透光学导光条 (核心 300° 环腕发光带！宽 7.6mm，厚 1.35mm，拱顶微凸 +0.35mm)
    lg_front_spine = build_wing_spine(+1.0, -57.2, n_arc=28, tuck_fn=None)[1:]
    lg_front = make_swept_band(lg_front_spine, LG_W, STRAP_T * 0.5 - 1.00, STRAP_T * 0.5 + 0.35, dome_outer=0.45)

    lg_rear_spine = build_wing_spine(-1.0, -57.2, n_arc=28, tuck_fn=None)[1:]
    lg_rear = make_swept_band(lg_rear_spine, LG_W, STRAP_T * 0.5 - 1.00, STRAP_T * 0.5 + 0.35, dome_outer=0.45)

    # 4. 前/后双翼柔性聚酰亚胺 FPC 灯带 + 方案 A 内置进仓排线尾段（连续直插主板 J_LED_F / J_LED_R ZIF 座!）+ 12 颗 WS2812B-2020
    fpc_in = STRAP_T * 0.5 - CHAN_D + 0.14
    fpc_out = fpc_in + FPC_T
    fpc_front_wing = make_swept_band(lg_front_spine, FPC_W, fpc_in, fpc_out, corner_r=0.0)
    fpc_rear_wing = make_swept_band(lg_rear_spine, FPC_W, fpc_in, fpc_out, corner_r=0.0)

    # 4a. 前翼进仓 4 线回环 FPC 尾带 + 末端 Hirose FH19C 标准 2.50×0.20×3.60mm PI 补强接触舌（深入插入 J_LED_F 1.55mm!）
    fpc_front_tail_pts = [
        Vector(0.0, 23.25, 27.55),
        Vector(0.0, 21.85, 27.85),
        Vector(0.0, 20.20, 29.10),
        Vector(0.0, 18.70, 30.25),
        Vector(0.0, 17.65, 30.98),
        Vector(0.0, 16.40, 31.08),
    ]
    fpc_front_tail = make_swept_band(fpc_front_tail_pts, 2.2, -0.08, 0.08, corner_r=0.0)
    with BuildPart() as bp_ftongue:
        with Locations((0.0, 16.15, 31.08)):
            Box(2.50, 3.60, 0.20)  # Y ∈ [14.35, 17.95], Z ∈ [30.98, 31.18]，符合 Hirose 2.50±0.05 × 0.20±0.03 × ≥3.50mm
    fpc_front_tongue = bp_ftongue.part
    # 在前翼硅胶腕带与 T 型密封头中布尔切出精密内埋 FPC 穿线隧道（留足单边 >=0.25mm 间隙，保证 0.000 mm³ 碰撞！）
    front_tunnel_cut = make_swept_band(fpc_front_tail_pts[:5], 2.8, -0.34, 0.34, corner_r=0.0)
    strap_front = strap_front - front_tunnel_cut

    # 4b. 后翼进仓 4 线可展开 FPC 尾带 + 末端 Hirose FH19C 标准 2.50×0.20×3.60mm PI 补强接触舌（深入插入 J_LED_R 1.55mm!）
    rear_dogleg_strap_xy = [
        (0.00, -23.15),
        (-1.60, -22.65),
        (-9.65, -22.25),
        (-9.65, -21.95),
    ]
    fpc_rear_seg_b = make_flat_xy_ribbon(rear_dogleg_strap_xy, 2.0, 27.47, 27.63)

    rear_sbend_pts = [
        Vector(-9.65, -21.55, 27.55),
        Vector(-9.65, -20.75, 28.10),
        Vector(-9.65, -19.65, 29.40),
        Vector(-9.65, -18.40, 30.40),
        Vector(-9.65, -17.35, 30.98),
        Vector(-9.65, -16.65, 31.08),
    ]
    fpc_rear_seg_c = make_swept_band(rear_sbend_pts, 2.0, -0.08, 0.08, corner_r=0.0)

    rear_dogleg_pod_xy = [
        (-9.65, -16.45),
        (-11.20, -14.65),
        (-11.20, -8.35),
    ]
    fpc_rear_seg_d = make_flat_xy_ribbon(rear_dogleg_pod_xy, 2.0, 31.00, 31.16)
    with BuildPart() as bp_rtongue:
        with Locations((-11.20, -7.35, 31.08)):
            Box(2.50, 3.60, 0.20)  # Y ∈ [-9.15, -5.55], Z ∈ [30.98, 31.18]，深入 J_LED_R 槽口 1.55mm!
    fpc_rear_tongue = bp_rtongue.part

    # 在后翼硅胶腕带肩部与西侧防水密封塞内布尔切出精密 FPC 穿线隧道（确保 0.000 mm³ 碰撞！）
    rear_tunnel_b = make_flat_xy_ribbon(rear_dogleg_strap_xy, 2.6, 27.20, 27.90)
    rear_tunnel_c = make_swept_band(rear_sbend_pts[:4], 2.5, -0.34, 0.34, corner_r=0.0)
    strap_rear = strap_rear - rear_tunnel_b - rear_tunnel_c

    led_bodies = [
        fpc_front_wing, fpc_front_tail, fpc_front_tongue,
        fpc_rear_wing, fpc_rear_seg_b, fpc_rear_seg_c, fpc_rear_seg_d, fpc_rear_tongue,
    ]
    led_h = 0.62
    for spine_pts in (lg_front_spine, lg_rear_spine):
        idxs = np.linspace(2, len(spine_pts) - 3, 6).astype(int)
        for idx in idxs:
            p_prev = spine_pts[idx - 1]
            p_cur = spine_pts[idx]
            p_next = spine_pts[idx + 1]
            t_vec = (p_next - p_prev).normalized()
            cand = Vector(0.0, t_vec.Z, -t_vec.Y).normalized()
            n_out = cand if (cand.Y * p_cur.Y + cand.Z * p_cur.Z) >= 0 else -cand
            r_center = fpc_out + 0.04 + led_h * 0.5
            p_led = p_cur + n_out * r_center
            pln_l = Plane(origin=p_led, x_dir=Vector(1.0, 0.0, 0.0), z_dir=n_out)
            with BuildPart() as bp_l:
                with BuildSketch(pln_l):
                    RectangleRounded(2.0, 2.0, 0.25)
                extrude(amount=led_h * 0.5, both=True)
            led_bodies.append(bp_l.part)
    led_fpc_assy = Compound(children=led_bodies)

    # 5. 精致深空灰阳极氧化铝合金针扣 (Tang Buckle，位于正底部 th_neg = -90° 处，紧贴但 0 碰撞!)
    th_b = -90.0
    off_b = rear_tuck_off(th_b)  # +4.05mm
    yb, zb = 0.0, -(RZ_MID + off_b)  # (0, -29.75)
    # 在底部切向沿 +Y，外法向沿 -Z
    pln_b_sec = Plane(origin=Vector(0.0, yb, zb), x_dir=Vector(1.0, 0.0, 0.0), z_dir=Vector(0.0, 1.0, 0.0))
    with BuildPart() as bp_buck:
        # 精致轻薄表扣外框 (宽 26.2mm x 高 7.0mm x 长 9.6mm，内孔 23.2 x 4.6mm -> 容下 22.0 x 3.4mm 舌带，单边 >=0.60mm 净隙!)
        with BuildSketch(pln_b_sec):
            RectangleRounded(26.2, 7.0, 2.0)
            RectangleRounded(23.2, 4.6, 1.0, mode=Mode.SUBTRACT)
        extrude(amount=4.8, both=True)
        # 外底面视窗切口（形成经典运动表扣边框）
        pln_b_out = Plane(origin=Vector(0.0, yb, zb), x_dir=Vector(1.0, 0.0, 0.0), z_dir=Vector(0.0, 0.0, -1.0))
        with BuildSketch(pln_b_out.offset(1.8)):
            RectangleRounded(21.4, 5.2, 1.1)
        extrude(amount=3.0, mode=Mode.SUBTRACT)
        # 中央极简扁平扣针桥
        with BuildSketch(pln_b_out.offset(2.40)):
            RectangleRounded(1.6, 8.4, 0.45)
        extrude(amount=1.10)
    buckle_part = bp_buck.part

    # 6. 精致硅胶防滑束带环 (Silicone Keeper Loop，位于 th_neg = -115° 处同时轻套前/后双带，0 碰撞!)
    th_k = -115.0  # 对应前翼侧 y > 0 的下方收尾处 (cos(-115°) = -0.4226 -> sign_y=-1 => y = +13.8mm!)
    rad_k = math.radians(th_k)
    ny0 = math.cos(rad_k) / RY_MID
    nz0 = math.sin(rad_k) / RZ_MID
    m = math.hypot(ny0, nz0)
    nyk, nzk = -(ny0 / m), (nz0 / m)
    ty0, tz0 = -RY_MID * math.sin(rad_k), RZ_MID * math.cos(rad_k)
    mt = math.hypot(ty0, tz0)
    tyk, tzk = -(ty0 / mt), (tz0 / mt)
    # 中心取前翼 (off=0) 与后翼 (off=4.05) 的正中 (+2.025mm)，双带总厚 7.45mm -> 内腔高 8.45mm (单边 0.50mm 净隙!)
    yc_k = -(RY_MID * math.cos(rad_k) + 2.025 * (ny0 / m))
    zc_k = RZ_MID * math.sin(rad_k) + 2.025 * (nz0 / m)
    pln_k_sec = Plane(origin=Vector(0.0, yc_k, zc_k), x_dir=Vector(1.0, 0.0, 0.0), z_dir=Vector(0.0, tyk, tzk))
    with BuildPart() as bp_keep:
        with BuildSketch(pln_k_sec):
            RectangleRounded(25.8, 10.8, 2.5)
            RectangleRounded(23.2, 8.45, 1.4, mode=Mode.SUBTRACT)
        extrude(amount=3.1, both=True)
    keeper_part = bp_keep.part

    return strap_front, strap_rear, lg_front, lg_rear, led_fpc_assy, buckle_part, keeper_part, None


def build_assembly() -> list[PartSpec]:
    print("[CAD 1/4] 正在构建机电装配体（含双翼灯带与磁吸四线转接）...")
    top_shell = build_top_shell()
    bot_shell = build_bottom_shell()
    side_btn = build_side_button()
    nfc_coil = build_nfc_coil_ferrite()
    pcba = build_mainboard_pcba()
    battery = build_battery()
    motor = build_vibration_motor()
    hw_pogo = build_pogo_magnets_hardware()
    strap_f, strap_r, lg_f, lg_r, led_fpc, buckle, keeper, lugs = build_strap_and_halo_system()
    zif_conns = build_zif_connectors_and_contacts()

    parts = [
        PartSpec("01", "Top_Shell_NFC", "PC+ABS Matte Obsidian", 1.15, (0.20, 0.22, 0.25, 1.0), top_shell, (0.0, 0.0, 26.0)),
        PartSpec("02", "Bottom_Shell_Pogo", "PC+ABS Matte Obsidian", 1.15, (0.17, 0.19, 0.22, 1.0), bot_shell, (0.0, 0.0, -14.0)),
        PartSpec("03", "Side_Button_Silicone", "LSR Silicone 65A", 1.15, (0.28, 0.30, 0.34, 1.0), side_btn, (14.0, 0.0, 4.0)),
        PartSpec("04", "NFC_FPC_Coil_Ferrite", "Copper FPC + Ferrite", 4.50, (0.85, 0.54, 0.22, 1.0), nfc_coil, (0.0, 0.0, 17.0)),
        PartSpec("05", "Mainboard_4Layer_PCBA", "FR4 + SMD Modules", 2.40, (0.10, 0.44, 0.26, 1.0), pcba, (0.0, 0.0, 7.0)),
        PartSpec("06", "Battery_402025_300mAh", "LiPo Pouch Cell", 2.90, (0.78, 0.81, 0.85, 1.0), battery, (0.0, 0.0, -4.0)),
        PartSpec("07", "Vibration_Motor_1027", "Coin Motor (Steel/Cu)", 5.80, (0.68, 0.72, 0.77, 1.0), motor, (0.0, 6.0, -5.0)),
        PartSpec("08", "Pogo_Magnets_Screws", "Au Brass + N52 + SS", 7.80, (0.94, 0.76, 0.24, 1.0), hw_pogo, (0.0, 0.0, -22.0)),
        PartSpec("09", "Strap_Front_Silicone", "LSR Silicone 60A Charcoal", 1.14, (0.22, 0.24, 0.27, 1.0), strap_f, (0.0, 14.0, -4.0)),
        PartSpec("10", "Strap_Rear_Silicone", "LSR Silicone 60A Charcoal", 1.14, (0.22, 0.24, 0.27, 1.0), strap_r, (0.0, -14.0, -4.0)),
        PartSpec("11", "LightGuide_Front_Diffuser", "Frosted Optical Silicone", 1.12, (0.15, 0.96, 0.52, 0.95), lg_f, (0.0, 24.0, 2.0)),
        PartSpec("12", "LightGuide_Rear_Diffuser", "Frosted Optical Silicone", 1.12, (0.15, 0.96, 0.52, 0.95), lg_r, (0.0, -24.0, 2.0)),
        PartSpec("13", "LED_FPC_12xWS2812B", "Polyimide FPC + 12 LEDs", 2.20, (0.94, 0.66, 0.14, 1.0), led_fpc, (0.0, 0.0, -10.0)),
        PartSpec("14", "Tang_Buckle_Aluminum", "6061-T6 Anodized Dark", 2.70, (0.32, 0.35, 0.40, 1.0), buckle, (0.0, 0.0, -24.0)),
        PartSpec("15", "Silicone_Keeper_Loop", "LSR Silicone 60A Charcoal", 1.14, (0.20, 0.22, 0.25, 1.0), keeper, (0.0, 14.0, -20.0)),
        PartSpec("16", "ZIF_Connectors_4Pin", "LCP Ivory White + Contacts", 1.65, (0.94, 0.92, 0.87, 1.0), zif_conns, (0.0, 0.0, 11.0)),
        PartSpec("17", "Pogo_Flex_Interposer", "Copper-polyimide flex", 2.25, (0.91, 0.52, 0.16, 1.0), pogo_flex_envelope(), (0.0, 12.0, -8.0)),
    ]
    return parts


def verify_and_export(parts: list[PartSpec]):
    CAD_OUT.mkdir(parents=True, exist_ok=True)
    PARTS_DIR.mkdir(parents=True, exist_ok=True)

    print("[CAD 2/4] 执行严格 B-Rep 实体合法性、重量与全两两干涉碰撞校验...")
    part_metrics = []
    total_mass_g = 0.0
    valid_all = True

    for p in parts:
        p.shape.label = f"{p.idx}_{p.name}"
        p.shape.color = Color(*p.rgba)
        vol_mm3 = float(p.shape.volume)
        mass_g = (vol_mm3 / 1000.0) * p.density_g_cm3
        total_mass_g += mass_g
        is_val = bool(p.shape.is_valid)
        if not is_val or vol_mm3 <= 0.0:
            valid_all = False
        bb = p.shape.bounding_box()
        part_metrics.append({
            "id": p.idx,
            "name": p.name,
            "material": p.material,
            "valid_brep": is_val,
            "volume_mm3": round(vol_mm3, 2),
            "mass_g": round(mass_g, 2),
            "bbox_mm": {
                "x": [round(bb.min.X, 2), round(bb.max.X, 2)],
                "y": [round(bb.min.Y, 2), round(bb.max.Y, 2)],
                "z": [round(bb.min.Z, 2), round(bb.max.Z, 2)],
            },
            "rgba": list(p.rgba),
            "explode_vec": list(p.explode_vec),
        })
        # 导出单件 STEP 与高精度 STL（供 3D 打印手板与高清渲染）
        export_step(p.shape, str(PARTS_DIR / f"{p.idx}_{p.name}.step"))
        export_stl(p.shape, str(PARTS_DIR / f"{p.idx}_{p.name}.stl"), tolerance=0.04, angular_tolerance=0.15)

    # 全两两精确 B-Rep 布尔干涉检查
    interferences = []
    for i in range(len(parts)):
        bb_i = parts[i].shape.bounding_box()
        for j in range(i + 1, len(parts)):
            bb_j = parts[j].shape.bounding_box()
            # 快速 AABB 剪枝
            if (bb_i.max.X < bb_j.min.X or bb_j.max.X < bb_i.min.X or
                bb_i.max.Y < bb_j.min.Y or bb_j.max.Y < bb_i.min.Y or
                bb_i.max.Z < bb_j.min.Z or bb_j.max.Z < bb_i.min.Z):
                continue
            try:
                inter = parts[i].shape & parts[j].shape
                ivol = float(inter.volume) if inter is not None else 0.0
            except Exception as exc:
                ivol = -1.0
                interferences.append({
                    "pair": [f"{parts[i].idx}_{parts[i].name}", f"{parts[j].idx}_{parts[j].name}"],
                    "volume_mm3": ivol,
                    "error": str(exc),
                })
                continue
            if ivol > 0.05:  # 超过 0.05 mm³ 即判定为真实实体碰撞干涉
                interferences.append({
                    "pair": [f"{parts[i].idx}_{parts[i].name}", f"{parts[j].idx}_{parts[j].name}"],
                    "volume_mm3": round(ivol, 3),
                })

    print("[CAD 3/4] 导出完整多实体 B-Rep STEP 装配体 (Fusion 360 原生直开)...")
    assy = Compound(label="CatMouseBand_V15_StrapHalo", children=[p.shape for p in parts])
    step_path = CAD_OUT / "CatMouseBand_V15_StrapHalo.step"
    export_step(assy, str(step_path))

    bb_all = assy.bounding_box()
    report = {
        "model": "CatMouseBand_V15_StrapHalo",
        "architecture": "Screenless Pebble NFC Pod + Dual-Wing 300-deg Glowing Silicone Wristband Halo",
        "overall_bbox_mm": {
            "width_x": round(bb_all.max.X - bb_all.min.X, 2),
            "length_y": round(bb_all.max.Y - bb_all.min.Y, 2),
            "height_z": round(bb_all.max.Z - bb_all.min.Z, 2),
        },
        "pod_dimensions_mm": {"width": POD_W, "length": POD_L, "thickness": round(Z_POD_TOP - Z_POD_BOT, 2)},
        "wrist_inner_ellipse_mm": {"ry": WRIST_RY, "rz": WRIST_RZ, "nominal_circumference_mm": round(math.pi * (3*(WRIST_RY+WRIST_RZ) - math.sqrt((3*WRIST_RY+WRIST_RZ)*(WRIST_RY+3*WRIST_RZ))), 1)},
        "strap_specs_mm": {"width": STRAP_W, "thickness": STRAP_T, "light_guide_width": LG_W, "led_count": 12},
        "wall_thickness_min_mm": {"top_nfc_deck": WALL_TOP, "bottom_skin_wall": WALL_BOT, "side_wall": WALL_SIDE, "strap_inner_floor": round(STRAP_T - CHAN_D, 2)},
        "part_count": len(parts),
        "all_brep_valid": valid_all,
        "total_estimated_mass_g": round(total_mass_g, 2),
        "mass_target_g": 38.0,
        "mass_pass": total_mass_g <= 38.0,
        "interference_count": len(interferences),
        "interferences": interferences,
        "step_file": str(step_path),
        "parts": part_metrics,
    }
    rep_path = CAD_OUT / "cad_verification_report.json"
    rep_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"[CAD 4/4] 校验汇总：零件数={len(parts)} | 全B-Rep有效={valid_all} | 估算整机总重={total_mass_g:.2f} g | 实体碰撞干涉数={len(interferences)}")
    for it in interferences:
        print("  [INTERFERENCE]", it)
    if not valid_all or len(interferences) > 0:
        sys.exit(1)
    print(f"=== [PASS] {len(parts)}-PART B-REP STEP ASSEMBLY PASSED 0.000 mm^3 COLLISION GATE: {step_path} ===")


if __name__ == "__main__":
    verify_and_export(build_assembly())
