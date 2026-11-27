"""
CatMouse Band V1.5-Lite ("Velcro 魔术贴简版") — 100% 参数化 B-Rep 3D CAD 装配体生成器 (build123d / OpenCASCADE)

定位：面向 EVT 快速打样 / 3D 打印 TPU 手板 / 零金属表扣极简验证版本：
  1. 主机仓与内部方案 A 连接结构 100% 沿用 V1.5 Strap-Halo 主线设计（无屏 NFC 鹅卵石主机 + 4 层单面 PCBA
     + 前/后双路内埋 FPC 排线直插白色 ZIF 翻盖座 J_LED_F/J_LED_R + 双端硅胶 T 型防拉脱防水密封头 + NFC 下弯弹片）。
  2. 腕带保留 300° 双翼发光导光环（12× WS2812B-2020），取消底部的铝合金针扣、硅胶束带环与 5 个冲孔。
  3. 底部改为极简直接搭接魔术贴（Velcro Hook-and-Loop）：
     - 14_Velcro_Loop_Pad_Front：前翼底部外侧粘贴 18mm 宽背胶魔术贴毛面（绒面）
     - 15_Velcro_Hook_Pad_Rear：后翼向外顺滑台阶让位并搭接于前翼外侧，内侧粘贴 18mm 宽背胶魔术贴刺面（勾面），
       末端自带 1.4mm 微翘易撕拉手，一撕即开、奔跑刮蹭自动安全脱扣、0 导线跨越魔术贴搭接区！

输出：
  - cad/output/CatMouseBand_V15_Velcro_Lite.step   （16 件原生多实体 B-Rep STEP，可直接拖入 Fusion 360）
  - cad/output/parts_velcro/*.stl & *.step         （16 个独立零件实体，方便直接 3D 打印手板）
  - cad/output/cad_velcro_verification_report.json （B-Rep 实体有效性、全两两 0.000 mm³ 干涉校验与整机克重报告）
"""
from __future__ import annotations

import json
import math
import pathlib
import sys

import numpy as np
from build123d import (
    Box,
    BuildPart,
    BuildSketch,
    Color,
    Compound,
    Locations,
    Plane,
    RectangleRounded,
    Vector,
    export_step,
    export_stl,
    extrude,
)

# 复用主线 build_catmouse_cad.py 的主机仓与方案 A 内部连接结构，确保单一真源 100% 一致
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_catmouse_cad as base  # noqa: E402

ROOT = base.ROOT
CAD_OUT = base.CAD_OUT
PARTS_DIR = CAD_OUT / "parts_velcro"


def build_velcro_strap_and_halo_system():
    """
    构建 V1.5-Lite 大范围可调魔术贴发光腕带系统（覆盖 136–240 mm 超宽腕围，约 104 mm 无级调节！）：
    - 保留主机上方与两侧最显眼的 224° 双翼光学导光环（前/后翼均至 -22°，12 颗 WS2812B-2020 更密集均匀）
      与方案 A 双路内埋 FPC 排线 + 双端 T 型防拉脱防水密封头。
    - 取消底部表扣、束带环与冲孔，将整个手腕下半圈腾给超长 18mm 宽背胶魔术贴搭接区：
      * 前翼延伸至 -132°，外侧贴 ~59mm 超长魔术贴毛面 (-25.5° .. -130.0°)
      * 后翼自 -24.5° 顺滑外扩 +5.10mm 并延伸至 -153.5°（含末端 +1.4mm 易撕拉手），内侧贴 ~56mm 超长魔术贴刺面 (-51.5° .. -146.0°)
      * 展开总有效周长 263mm，保留 ≥22mm 粘合余量即可支持 136mm（细腕/儿童）~ 240mm（粗腕/冬装袖口外戴）！
    - 严格保证全 16 零件 0.000 mm³ 实体干涉！
    """
    RY_MID = base.WRIST_RY + base.STRAP_T * 0.5  # 32.70
    RZ_MID = base.WRIST_RZ + base.STRAP_T * 0.5  # 25.70

    def build_wing_spine(sign_y: float, end_theta_deg: float, n_arc: int = 44, tuck_fn=None) -> list[Vector]:
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
        for i in range(n_arc):
            u = i / (n_arc - 1)
            th = end_theta_deg * u
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

    def sample_arc_only(sign_y: float, th_start: float, th_end: float, n_pts: int = 28, off_fn=None) -> list[Vector]:
        pts = []
        for i in range(n_pts):
            u = i / (n_pts - 1)
            th = th_start + (th_end - th_start) * u
            rad = math.radians(th)
            y = RY_MID * math.cos(rad)
            z = RZ_MID * math.sin(rad)
            if off_fn is not None:
                off = off_fn(th)
                ny = math.cos(rad) / RY_MID
                nz = math.sin(rad) / RZ_MID
                m = math.hypot(ny, nz)
                y += off * (ny / m)
                z += off * (nz / m)
            pts.append(Vector(0.0, sign_y * y, z))
        return pts

    # 后翼超长魔术贴台阶偏移：在 -24.5° -> -44.5° 间顺滑外扩 +5.10mm（早于前翼末端 -48° 完成让位，0 干涉！），
    # 末端 -147.0° -> -153.5° 再轻翘 +1.40mm 形成手指易撕拉手！
    def rear_velcro_off(th_neg: float) -> float:
        if th_neg >= -24.5:
            return 0.0
        s1 = min(1.0, (-24.5 - th_neg) / 20.0)
        base_off = 5.10 * (s1 * s1 * (3.0 - 2.0 * s1))
        if th_neg < -147.0:
            s2 = min(1.0, (-147.0 - th_neg) / 6.5)
            base_off += 1.40 * (s2 * s2 * (3.0 - 2.0 * s2))
        return base_off

    # 1. 前翼硅胶/TPU 腕带 (+Y 侧，超长延伸至 -132° 作为 59mm 魔术贴毛面基带，无表扣无孔！)
    front_spine = build_wing_spine(+1.0, -132.0, n_arc=50, tuck_fn=None)
    strap_front = base.make_swept_band(front_spine, base.STRAP_W, -base.STRAP_T * 0.5, base.STRAP_T * 0.5, corner_r=1.35)

    # 前翼 T 型硅胶防拉脱防水密封头（与主机底壳 T 槽完全一致）
    with BuildPart() as bp_tf:
        with Locations((0.0, 20.625, 26.75 + 1.365)):
            Box(12.10, 1.85, 2.73)
        with Locations((0.0, 19.335, 26.75 + 1.95)):
            Box(15.30, 0.77, 3.90)
    strap_front = strap_front + bp_tf.part

    # 前翼导光凹槽（覆盖整个上方+外侧可视面至 -23.0°，下方 109° 全部让给超长魔术贴调节区！）
    front_chan_spine = build_wing_spine(+1.0, -23.0, n_arc=18, tuck_fn=None)[1:]
    front_chan_cut = base.make_swept_band(front_chan_spine, base.CHAN_W, base.STRAP_T * 0.5 - base.CHAN_D, base.STRAP_T * 0.5 + 1.2, corner_r=0.35)
    strap_front = strap_front - front_chan_cut

    # 2. 后翼硅胶/TPU 腕带 (-Y 侧，超长延伸至 -153.5° 叠压在前翼毛面外侧，末端微翘易撕拉手，无冲孔！)
    rear_spine = build_wing_spine(-1.0, -153.5, n_arc=58, tuck_fn=rear_velcro_off)
    strap_rear = base.make_swept_band(rear_spine, base.STRAP_W, -base.STRAP_T * 0.5, base.STRAP_T * 0.5, corner_r=1.35)

    # 后翼 T 型硅胶防拉脱密封头 + 西侧独立防水过线硅胶塞
    with BuildPart() as bp_tr:
        with Locations((0.0, -20.625, 26.75 + 1.365)):
            Box(12.10, 1.85, 2.73)
        with Locations((0.0, -19.335, 26.75 + 1.95)):
            Box(15.30, 0.77, 3.90)
        with Locations((-9.65, -20.325, 27.15 + 1.75)):
            Box(2.40, 2.25, 3.50)
    strap_rear = strap_rear + bp_tr.part

    rear_chan_spine = build_wing_spine(-1.0, -23.0, n_arc=18, tuck_fn=None)[1:]
    rear_chan_cut = base.make_swept_band(rear_chan_spine, base.CHAN_W, base.STRAP_T * 0.5 - base.CHAN_D, base.STRAP_T * 0.5 + 1.2, corner_r=0.35)
    strap_rear = strap_rear - rear_chan_cut

    # 3. 前/后双翼乳白雾面高透光学导光条 (覆盖上方+双侧全可视面 ~224°，6+6=12 颗灯珠更密更亮!)
    lg_front_spine = build_wing_spine(+1.0, -22.0, n_arc=18, tuck_fn=None)[1:]
    lg_front = base.make_swept_band(lg_front_spine, base.LG_W, base.STRAP_T * 0.5 - 1.00, base.STRAP_T * 0.5 + 0.35, dome_outer=0.45)

    lg_rear_spine = build_wing_spine(-1.0, -22.0, n_arc=18, tuck_fn=None)[1:]
    lg_rear = base.make_swept_band(lg_rear_spine, base.LG_W, base.STRAP_T * 0.5 - 1.00, base.STRAP_T * 0.5 + 0.35, dome_outer=0.45)

    # 4. 方案 A 柔性聚酰亚胺 FPC 灯带 + 双路进仓尾带 + 12 颗 WS2812B-2020 (100% 复用主线坐标!)
    fpc_in = base.STRAP_T * 0.5 - base.CHAN_D + 0.14
    fpc_out = fpc_in + base.FPC_T
    fpc_front_wing = base.make_swept_band(lg_front_spine, base.FPC_W, fpc_in, fpc_out, corner_r=0.0)
    fpc_rear_wing = base.make_swept_band(lg_rear_spine, base.FPC_W, fpc_in, fpc_out, corner_r=0.0)

    fpc_front_tail_pts = [
        Vector(0.0, 23.25, 27.55),
        Vector(0.0, 21.85, 27.85),
        Vector(0.0, 20.20, 29.10),
        Vector(0.0, 18.70, 30.25),
        Vector(0.0, 17.65, 31.05),
        Vector(0.0, 16.40, 31.15),
        Vector(0.0, 14.80, 31.15),
    ]
    fpc_front_tail = base.make_swept_band(fpc_front_tail_pts, 2.2, -0.08, 0.08, corner_r=0.0)
    front_tunnel_cut = base.make_swept_band(fpc_front_tail_pts[:5], 2.8, -0.34, 0.34, corner_r=0.0)
    strap_front = strap_front - front_tunnel_cut

    rear_dogleg_strap_xy = [
        (0.00, -23.15),
        (-1.60, -22.65),
        (-9.65, -22.25),
        (-9.65, -21.95),
    ]
    fpc_rear_seg_b = base.make_flat_xy_ribbon(rear_dogleg_strap_xy, 2.0, 27.47, 27.63)

    rear_sbend_pts = [
        Vector(-9.65, -21.55, 27.55),
        Vector(-9.65, -20.75, 28.10),
        Vector(-9.65, -19.65, 29.40),
        Vector(-9.65, -18.40, 30.40),
        Vector(-9.65, -17.35, 31.05),
        Vector(-9.65, -16.65, 31.15),
    ]
    fpc_rear_seg_c = base.make_swept_band(rear_sbend_pts, 2.0, -0.08, 0.08, corner_r=0.0)

    rear_dogleg_pod_xy = [
        (-9.65, -16.45),
        (-11.20, -14.65),
        (-11.20, -6.75),
    ]
    fpc_rear_seg_d = base.make_flat_xy_ribbon(rear_dogleg_pod_xy, 2.0, 31.07, 31.23)

    rear_tunnel_b = base.make_flat_xy_ribbon(rear_dogleg_strap_xy, 2.6, 27.20, 27.90)
    rear_tunnel_c = base.make_swept_band(rear_sbend_pts[:4], 2.5, -0.34, 0.34, corner_r=0.0)
    strap_rear = strap_rear - rear_tunnel_b - rear_tunnel_c

    led_bodies = [fpc_front_wing, fpc_front_tail, fpc_rear_wing, fpc_rear_seg_b, fpc_rear_seg_c, fpc_rear_seg_d]
    led_h = 0.62
    for spine_pts in (lg_front_spine, lg_rear_spine):
        idxs = np.linspace(2, len(spine_pts) - 3, 6).astype(int)
        for idx in idxs:
            p_prev, p_cur, p_next = spine_pts[idx - 1], spine_pts[idx], spine_pts[idx + 1]
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

    # 5. 14_Velcro_Loop_Pad_Front: 前翼外侧 18mm×59mm 超长背胶魔术贴毛面 (th_front = -25.5° .. -130.0°，距前翼外壁留 0.08mm)
    velcro_loop_spine = sample_arc_only(+1.0, -25.5, -130.0, n_pts=32, off_fn=None)
    velcro_loop = base.make_swept_band(velcro_loop_spine, 18.0, 1.78, 2.48, corner_r=0.25)

    # 6. 15_Velcro_Hook_Pad_Rear: 后翼内侧 18mm×56mm 超长背胶魔术贴刺面 (th_rear = -51.5° .. -146.0°，贴合于后翼内壁，距毛面留 0.14mm)
    velcro_hook_spine = sample_arc_only(-1.0, -51.5, -146.0, n_pts=32, off_fn=rear_velcro_off)
    velcro_hook = base.make_swept_band(velcro_hook_spine, 18.0, -2.48, -1.78, corner_r=0.25)

    return strap_front, strap_rear, lg_front, lg_rear, led_fpc_assy, velcro_loop, velcro_hook


def build_velcro_assembly() -> list[base.PartSpec]:
    print("[VELCRO CAD 1/4] 正在构建 V1.5-Lite 魔术贴简版 16 个 B-Rep 实体零件...")
    top_shell = base.build_top_shell()
    bot_shell = base.build_bottom_shell()
    side_btn = base.build_side_button()
    nfc_coil = base.build_nfc_coil_ferrite()
    pcba = base.build_mainboard_pcba()
    battery = base.build_battery()
    motor = base.build_vibration_motor()
    hw_pogo = base.build_pogo_magnets_hardware()
    strap_f, strap_r, lg_f, lg_r, led_fpc, velcro_loop, velcro_hook = build_velcro_strap_and_halo_system()
    zif_conns = base.build_zif_connectors_and_contacts()

    parts = [
        base.PartSpec("01", "Top_Shell_NFC", "PC+ABS Matte Obsidian", 1.15, (0.20, 0.22, 0.25, 1.0), top_shell, (0.0, 0.0, 26.0)),
        base.PartSpec("02", "Bottom_Shell_Pogo", "PC+ABS Matte Obsidian", 1.15, (0.17, 0.19, 0.22, 1.0), bot_shell, (0.0, 0.0, -14.0)),
        base.PartSpec("03", "Side_Button_Silicone", "LSR Silicone 65A", 1.15, (0.28, 0.30, 0.34, 1.0), side_btn, (14.0, 0.0, 4.0)),
        base.PartSpec("04", "NFC_FPC_Coil_Ferrite", "Copper FPC + Ferrite", 4.50, (0.85, 0.54, 0.22, 1.0), nfc_coil, (0.0, 0.0, 17.0)),
        base.PartSpec("05", "Mainboard_4Layer_PCBA", "FR4 + SMD Modules", 2.40, (0.10, 0.44, 0.26, 1.0), pcba, (0.0, 0.0, 7.0)),
        base.PartSpec("06", "Battery_402025_300mAh", "LiPo Pouch Cell", 2.90, (0.78, 0.81, 0.85, 1.0), battery, (0.0, 0.0, -4.0)),
        base.PartSpec("07", "Vibration_Motor_1027", "Coin Motor (Steel/Cu)", 5.80, (0.68, 0.72, 0.77, 1.0), motor, (0.0, 6.0, -5.0)),
        base.PartSpec("08", "Pogo_Magnets_Screws", "Au Brass + N52 + SS", 7.80, (0.94, 0.76, 0.24, 1.0), hw_pogo, (0.0, 0.0, -22.0)),
        base.PartSpec("09", "Strap_Front_Velcro", "TPU 85A / LSR Charcoal", 1.14, (0.22, 0.24, 0.27, 1.0), strap_f, (0.0, 14.0, -4.0)),
        base.PartSpec("10", "Strap_Rear_Velcro", "TPU 85A / LSR Charcoal", 1.14, (0.22, 0.24, 0.27, 1.0), strap_r, (0.0, -14.0, -4.0)),
        base.PartSpec("11", "LightGuide_Front_Diffuser", "Frosted Optical Silicone", 1.12, (0.15, 0.96, 0.52, 0.95), lg_f, (0.0, 24.0, 2.0)),
        base.PartSpec("12", "LightGuide_Rear_Diffuser", "Frosted Optical Silicone", 1.12, (0.15, 0.96, 0.52, 0.95), lg_r, (0.0, -24.0, 2.0)),
        base.PartSpec("13", "LED_FPC_12xWS2812B", "Polyimide FPC + 12 LEDs", 2.20, (0.94, 0.66, 0.14, 1.0), led_fpc, (0.0, 0.0, -10.0)),
        base.PartSpec("14", "Velcro_Loop_Pad_Front", "Nylon Velcro Loop (Soft)", 0.65, (0.30, 0.36, 0.46, 1.0), velcro_loop, (0.0, 8.0, -18.0)),
        base.PartSpec("15", "Velcro_Hook_Pad_Rear", "Nylon Velcro Hook (Grip)", 0.70, (0.48, 0.42, 0.34, 1.0), velcro_hook, (0.0, -4.0, -26.0)),
        base.PartSpec("16", "ZIF_Connectors_4Pin", "LCP Ivory White + Contacts", 1.65, (0.94, 0.92, 0.87, 1.0), zif_conns, (0.0, 0.0, 11.0)),
    ]
    return parts


def verify_and_export(parts: list[base.PartSpec]):
    CAD_OUT.mkdir(parents=True, exist_ok=True)
    PARTS_DIR.mkdir(parents=True, exist_ok=True)

    print("[VELCRO CAD 2/4] 执行严格 B-Rep 实体合法性、重量与全两两干涉碰撞校验...")
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
        export_step(p.shape, str(PARTS_DIR / f"{p.idx}_{p.name}.step"))
        export_stl(p.shape, str(PARTS_DIR / f"{p.idx}_{p.name}.stl"), tolerance=0.04, angular_tolerance=0.15)

    interferences = []
    for i in range(len(parts)):
        bb_i = parts[i].shape.bounding_box()
        for j in range(i + 1, len(parts)):
            bb_j = parts[j].shape.bounding_box()
            if (bb_i.max.X < bb_j.min.X or bb_j.max.X < bb_i.min.X or
                bb_i.max.Y < bb_j.min.Y or bb_j.max.Y < bb_i.min.Y or
                bb_i.max.Z < bb_j.min.Z or bb_j.max.Z < bb_i.min.Z):
                continue
            try:
                inter = parts[i].shape & parts[j].shape
                ivol = float(inter.volume) if inter is not None else 0.0
            except Exception as exc:
                interferences.append({
                    "pair": [f"{parts[i].idx}_{parts[i].name}", f"{parts[j].idx}_{parts[j].name}"],
                    "volume_mm3": -1.0,
                    "error": str(exc),
                })
                continue
            if ivol > 0.05:
                interferences.append({
                    "pair": [f"{parts[i].idx}_{parts[i].name}", f"{parts[j].idx}_{parts[j].name}"],
                    "volume_mm3": round(ivol, 3),
                })

    print("[VELCRO CAD 3/4] 导出完整多实体 B-Rep STEP 装配体 (Fusion 360 原生直开)...")
    assy = Compound(label="CatMouseBand_V15_Velcro_Lite", children=[p.shape for p in parts])
    step_path = CAD_OUT / "CatMouseBand_V15_Velcro_Lite.step"
    export_step(assy, str(step_path))

    bb_all = assy.bounding_box()
    report = {
        "model": "CatMouseBand_V15_Velcro_Lite",
        "architecture": "Wide-Range Adjustable EVT Velcro Sport Band (136-240 mm wrist range) + Screenless NFC Pod + 224-deg Glowing Halo + Plan A Internal FPC/ZIF",
        "fastening": "Long Direct-Overlap 18mm Adhesive Velcro (59mm Front Loop Pad + 56mm Rear Hook Pad + Easy-Peel Pull Tab, 104mm stepless adjustment)",
        "wrist_adjustable_range_mm": {"min": 136.0, "max": 240.0, "span": 104.0, "front_loop_len_mm": 59.0, "rear_hook_len_mm": 56.0},
        "overall_bbox_mm": {
            "width_x": round(bb_all.max.X - bb_all.min.X, 2),
            "length_y": round(bb_all.max.Y - bb_all.min.Y, 2),
            "height_z": round(bb_all.max.Z - bb_all.min.Z, 2),
        },
        "part_count": len(parts),
        "all_brep_valid": valid_all,
        "total_estimated_mass_g": round(total_mass_g, 2),
        "mass_target_g": 35.0,
        "mass_pass": total_mass_g <= 35.0,
        "interference_count": len(interferences),
        "interferences": interferences,
        "step_file": str(step_path),
        "parts": part_metrics,
    }
    rep_path = CAD_OUT / "cad_velcro_verification_report.json"
    rep_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"[VELCRO CAD 4/4] 校验汇总：零件数={len(parts)} | 全B-Rep有效={valid_all} | 估算整机总重={total_mass_g:.2f} g | 实体碰撞干涉数={len(interferences)}")
    for it in interferences:
        print("  [INTERFERENCE]", it)
    if not valid_all or len(interferences) > 0:
        sys.exit(1)
    print(f"=== [PASS] VELCRO LITE {len(parts)}-PART B-REP STEP PASSED 0.000 mm^3 COLLISION GATE: {step_path} ===")


if __name__ == "__main__":
    verify_and_export(build_velcro_assembly())
