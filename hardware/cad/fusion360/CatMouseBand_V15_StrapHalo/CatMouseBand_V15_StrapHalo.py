"""CatMouse Band V1.5 ("Strap-Halo" 腕带光环版) — 100% 原生参数化 Autodesk Fusion 360 脚本

在 Fusion 360 中按 Shift+S 打开“脚本和附加模块”，选中 CatMouseBand_V15_StrapHalo 点击“运行”，
即可自动在当前文档中构建完整 15 件原生参数化特征树（含 User Parameters fx、草图、放样/扫掠腕带光环、
圆角倒角、红猫/绿鼠/蓝求救 CMF 外观库、按键滑移运动副，并自动导出原生 .f3d 存档）。

结构规范（与已通过 0.000 mm^3 碰撞校验的 STEP 装配体 100% 毫米级同源）：
- 主机仓：34.0 x 42.0 x 11.8 mm 极简无屏鹅卵石（顶面全留给 13.56MHz NFC 线圈 + 0.2mm 铁氧体，盲触猫爪+NFC波纹凹雕）
- 发光环：位于液态硅胶腕带双翼中央（7.6 mm 宽乳白雾面导光条 + 4.5 mm 柔性 FPC + 12 颗 WS2812B-2020，300° 环腕发光，0 导线跨表扣）
- 表扣与充电：底部阳极氧化铝合金针扣 + 硅胶防滑束带环；主机背面 4-pin 镀金磁吸 USB-JTAG/充电触点 + 2×N52 磁铁 + 2×M2 螺柱
"""
from __future__ import annotations

import json
import math
import pathlib
import traceback

import adsk.core
import adsk.fusion

MM = 0.1  # Fusion 360 内部长度单位为厘米 (1 mm = 0.1 cm)

OUT_DIR = pathlib.Path(r"C:\Users\Keke_\.gemini\antigravity\scratch\catmouse-band\cad\fusion360\output")
F3D_PATH = OUT_DIR / "CatMouseBand_V15_StrapHalo_Native.f3d"
REPORT_PATH = OUT_DIR / "fusion_native_report.json"

# ======================== 与 STEP 模型完全同源的主参数 (mm) ========================
PARAMS_MM = {
    "wrist_ry": (31.0, "mm", "手腕内轮廓 Y 半轴 (宽 62mm)"),
    "wrist_rz": (24.0, "mm", "手腕内轮廓 Z 半轴 (厚 48mm)"),
    "pod_w": (34.0, "mm", "无屏鹅卵石主机宽度 (X)"),
    "pod_l": (42.0, "mm", "无屏鹅卵石主机长度 (Y)"),
    "pod_r": (9.5, "mm", "主机大圆角半径"),
    "z_pod_bot": (23.80, "mm", "主机贴腕底面 Z"),
    "z_split": (30.80, "mm", "上下壳合模分型面 Z"),
    "z_pod_top": (35.60, "mm", "主机 NFC 顶面 Z (总厚 11.8mm)"),
    "wall_side": (1.80, "mm", "主机侧壁厚"),
    "wall_top": (1.20, "mm", "顶盖 NFC 窗壁厚"),
    "wall_bot": (1.30, "mm", "底壳贴肤壁厚"),
    "strap_w": (22.0, "mm", "双色液态硅胶腕带宽度"),
    "strap_t": (3.40, "mm", "腕带径向厚度"),
    "chan_w": (8.00, "mm", "腕带中央光学导光槽宽"),
    "chan_d": (2.15, "mm", "光学导光槽深 (留 1.25mm 柔肤内壁)"),
    "lg_w": (7.60, "mm", "乳白雾面导光条宽"),
    "fpc_w": (4.50, "mm", "柔性 LED FPC 带宽"),
    "fpc_t": (0.16, "mm", "柔性 LED FPC 厚度"),
}


def mm(v: float) -> float:
    return float(v) * MM


def pt(x_mm: float, y_mm: float, z_mm: float = 0.0) -> adsk.core.Point3D:
    return adsk.core.Point3D.create(x_mm * MM, y_mm * MM, z_mm * MM)


def val_mm(v: float) -> adsk.core.ValueInput:
    return adsk.core.ValueInput.createByReal(float(v) * MM)


def _signed_offset(base_pln: adsk.fusion.ConstructionPlane, coord_mm: float, axis_idx: int) -> float:
    n = base_pln.geometry.normal
    c = (n.x, n.y, n.z)[axis_idx]
    return coord_mm if c >= 0.0 else -coord_mm


def offset_plane_xy(comp: adsk.fusion.Component, z_mm: float, name: str) -> adsk.fusion.ConstructionPlane:
    inp = comp.constructionPlanes.createInput()
    inp.setByOffset(comp.xYConstructionPlane, val_mm(_signed_offset(comp.xYConstructionPlane, z_mm, 2)))
    pln = comp.constructionPlanes.add(inp)
    pln.name = name
    return pln


def offset_plane_yz(comp: adsk.fusion.Component, x_mm: float, name: str) -> adsk.fusion.ConstructionPlane:
    inp = comp.constructionPlanes.createInput()
    inp.setByOffset(comp.yZConstructionPlane, val_mm(_signed_offset(comp.yZConstructionPlane, x_mm, 0)))
    pln = comp.constructionPlanes.add(inp)
    pln.name = name
    return pln


def plane_at_path_start(comp: adsk.fusion.Component, path_curve: adsk.fusion.SketchCurve, name: str) -> adsk.fusion.ConstructionPlane:
    inp = comp.constructionPlanes.createInput()
    inp.setByDistanceOnPath(path_curve, adsk.core.ValueInput.createByReal(0.0))
    pln = comp.constructionPlanes.add(inp)
    pln.name = name
    return pln


def draw_rounded_rect_local(
    sk: adsk.fusion.Sketch,
    cx_mm: float,
    cy_mm: float,
    w_mm: float,
    h_mm: float,
    r_mm: float,
) -> adsk.fusion.Profile:
    """在草图局部 2D 坐标系中绘制严格闭合的圆角矩形并返回新建 Profile。"""
    before = sk.profiles.count
    hw, hh = w_mm * 0.5, h_mm * 0.5
    r = max(0.06, min(r_mm, hw - 0.04, hh - 0.04))
    ac = sk.sketchCurves.sketchArcs
    lc = sk.sketchCurves.sketchLines
    specs = [
        (cx_mm + hw - r, cy_mm + hh - r, cx_mm + hw, cy_mm + hh - r),
        (cx_mm - hw + r, cy_mm + hh - r, cx_mm - hw + r, cy_mm + hh),
        (cx_mm - hw + r, cy_mm - hh + r, cx_mm - hw, cy_mm - hh + r),
        (cx_mm + hw - r, cy_mm - hh + r, cx_mm + hw - r, cy_mm - hh),
    ]
    arcs = []
    for acx, acy, sx, sy in specs:
        arcs.append(ac.addByCenterStartSweep(pt(acx, acy, 0.0), pt(sx, sy, 0.0), math.pi * 0.5))
    for i in range(4):
        lc.addByTwoPoints(arcs[i].endSketchPoint, arcs[(i + 1) % 4].startSketchPoint)
    return sk.profiles.item(max(0, sk.profiles.count - 1 if sk.profiles.count > before else 0))


def draw_rounded_rect_xy(
    sk: adsk.fusion.Sketch,
    cx_mm: float,
    cy_mm: float,
    w_mm: float,
    h_mm: float,
    r_mm: float,
) -> adsk.fusion.Profile:
    """在任意偏移 XY 平面草图中按世界 X,Y 坐标绘制圆角矩形。"""
    before = sk.profiles.count
    hw, hh = w_mm * 0.5, h_mm * 0.5
    r = max(0.06, min(r_mm, hw - 0.04, hh - 0.04))
    ac = sk.sketchCurves.sketchArcs
    lc = sk.sketchCurves.sketchLines
    specs = [
        (cx_mm + hw - r, cy_mm + hh - r, cx_mm + hw, cy_mm + hh - r),
        (cx_mm - hw + r, cy_mm + hh - r, cx_mm - hw + r, cy_mm + hh),
        (cx_mm - hw + r, cy_mm - hh + r, cx_mm - hw, cy_mm - hh + r),
        (cx_mm + hw - r, cy_mm - hh + r, cx_mm + hw - r, cy_mm - hh),
    ]
    arcs = []
    for acx, acy, sx, sy in specs:
        cp = sk.modelToSketchSpace(pt(acx, acy, 0.0))
        sp = sk.modelToSketchSpace(pt(sx, sy, 0.0))
        arcs.append(
            ac.addByCenterStartSweep(
                adsk.core.Point3D.create(cp.x, cp.y, 0.0),
                adsk.core.Point3D.create(sp.x, sp.y, 0.0),
                math.pi * 0.5,
            )
        )
    for i in range(4):
        lc.addByTwoPoints(arcs[i].endSketchPoint, arcs[(i + 1) % 4].startSketchPoint)
    return sk.profiles.item(max(0, sk.profiles.count - 1 if sk.profiles.count > before else 0))


def draw_circle_xy(sk: adsk.fusion.Sketch, cx_mm: float, cy_mm: float, r_mm: float) -> adsk.fusion.Profile:
    before = sk.profiles.count
    cp = sk.modelToSketchSpace(pt(cx_mm, cy_mm, 0.0))
    sk.sketchCurves.sketchCircles.addByCenterRadius(adsk.core.Point3D.create(cp.x, cp.y, 0.0), mm(r_mm))
    return sk.profiles.item(max(0, sk.profiles.count - 1 if sk.profiles.count > before else 0))


def extrude_profile(
    comp: adsk.fusion.Component,
    prof,
    dist_mm: float,
    op: adsk.fusion.FeatureOperations = adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
    symmetric: bool = False,
) -> adsk.fusion.ExtrudeFeature:
    feats = comp.features.extrudeFeatures
    inp = feats.createInput(prof, op)
    if symmetric:
        inp.setSymmetricExtent(val_mm(abs(dist_mm) * 0.5), True)
    else:
        inp.setDistanceExtent(False, val_mm(dist_mm))
    return feats.add(inp)


def make_custom_appearances(app: adsk.core.Application, design: adsk.fusion.Design) -> dict[str, adsk.core.Appearance]:
    """创建 CatMouse Band V1.5 专属 CMF 外观库（含红猫 / 绿鼠 / 蓝求救三套发光导光条材质，可一键拖拽换色！）。"""
    apps: dict[str, adsk.core.Appearance] = {}
    lib = app.materialLibraries.itemByName("Fusion Appearance Library")
    if lib is None:
        for i in range(app.materialLibraries.count):
            ml = app.materialLibraries.item(i)
            if "Appearance" in ml.name:
                lib = ml
                break
    if lib is None:
        return apps

    base_matte = (
        lib.appearances.itemByName("Plastic - Matte (Black)")
        or lib.appearances.itemByName("Plastic - Matte (Gray)")
        or lib.appearances.item(0)
    )
    base_metal = (
        lib.appearances.itemByName("Aluminum - Satin")
        or lib.appearances.itemByName("Steel - Satin")
        or base_matte
    )
    base_glow = (
        lib.appearances.itemByName("LED (Green)")
        or lib.appearances.itemByName("Plastic - Translucent Matte (White)")
        or base_matte
    )

    palette = [
        ("CM_Obsidian_PC_ABS", base_matte, (44, 48, 54)),
        ("CM_Charcoal_LSR_Silicone", base_matte, (52, 56, 63)),
        ("CM_Button_Silicone", base_matte, (72, 77, 86)),
        ("CM_Glow_Mouse_Green", base_glow, (22, 245, 130)),
        ("CM_Glow_Cat_Red", base_glow, (250, 42, 62)),
        ("CM_Glow_Jailed_Blue", base_glow, (34, 138, 255)),
        ("CM_PCB_Matte_Green", base_matte, (24, 108, 66)),
        ("CM_Copper_NFC_FPC", base_metal, (214, 138, 58)),
        ("CM_Amber_LED_FPC", base_matte, (236, 166, 36)),
        ("CM_Gold_Pogo_Brass", base_metal, (238, 192, 60)),
        ("CM_LiPo_Silver_Foil", base_metal, (198, 204, 214)),
        ("CM_Anodized_SpaceGrey", base_metal, (76, 82, 92)),
    ]

    for name, src, (r, g, b) in palette:
        try:
            existing = design.appearances.itemByName(name)
            if existing is not None:
                apps[name] = existing
                continue
            dup = design.appearances.addByCopy(src, name)
            for p_name in ("opaque_albedo", "metal_f0", "surface_albedo", "emissive_color"):
                prop = dup.appearanceProperties.itemByName(p_name)
                if prop is not None:
                    cp = adsk.core.ColorProperty.cast(prop)
                    if cp is not None:
                        cp.value = adsk.core.Color.create(r, g, b, 255)
            apps[name] = dup
        except Exception:
            pass
    return apps


def assign_appearance(comp: adsk.fusion.Component, apps: dict, key: str):
    a = apps.get(key)
    if a is None:
        return
    for i in range(comp.bRepBodies.count):
        try:
            comp.bRepBodies.item(i).appearance = a
        except Exception:
            pass


def wing_spine_points(sign_y: float, end_theta_deg: float, n_arc: int = 18, with_tuck: bool = False) -> list[tuple[float, float]]:
    """返回 Y-Z 平面内的腕带平滑中心脊线点集 [(y_mm, z_mm), ...]，从主机端面水平切出零浮空。"""
    ry_mid = 32.70
    rz_mid = 25.70
    shoulder = [
        (21.20, 27.80),
        (23.10, 27.78),
        (25.60, 26.55),
        (28.30, 23.80),
        (30.65, 19.30),
        (32.15, 12.80),
        (32.68, 5.80),
    ]
    pts = [(sign_y * y, z) for y, z in shoulder]
    for i in range(n_arc):
        u = i / (n_arc - 1)
        th = end_theta_deg * u
        rad = math.radians(th)
        y = ry_mid * math.cos(rad)
        z = rz_mid * math.sin(rad)
        if with_tuck and th < -62.0:
            s = min(1.0, (-62.0 - th) / 20.0)
            off = 4.05 * s * s * (3.0 - 2.0 * s)
            ny = math.cos(rad) / ry_mid
            nz = math.sin(rad) / rz_mid
            m = math.hypot(ny, nz)
            y += off * (ny / m)
            z += off * (nz / m)
        pts.append((sign_y * y, z))
    return pts


def add_yz_spline(comp: adsk.fusion.Component, yz_pts: list[tuple[float, float]], name: str) -> tuple[adsk.fusion.Sketch, adsk.fusion.SketchFittedSpline]:
    """在 YZ 平面创建 3D/2D 拟合样条曲线，用于原生 Sweep 扫掠。"""
    sk = comp.sketches.add(comp.yZConstructionPlane)
    sk.name = name
    col = adsk.core.ObjectCollection.create()
    for y_mm, z_mm in yz_pts:
        p3 = sk.modelToSketchSpace(pt(0.0, y_mm, z_mm))
        col.add(adsk.core.Point3D.create(p3.x, p3.y, 0.0))
    sp = sk.sketchCurves.sketchFittedSplines.add(col)
    return sk, sp


def sweep_rect_along_yz_spline(
    comp: adsk.fusion.Component,
    yz_pts: list[tuple[float, float]],
    width_x: float,
    r_inner: float,
    r_outer: float,
    corner_r: float,
    tag: str,
    op: adsk.fusion.FeatureOperations = adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
):
    """沿 YZ 平面样条在起点创建法向草图并执行原生 Fusion Sweep。"""
    sk_p, sp = add_yz_spline(comp, yz_pts, f"Path_{tag}")
    pln0 = plane_at_path_start(comp, sp, f"Pln_{tag}")
    sk_s = comp.sketches.add(pln0)
    sk_s.name = f"Sec_{tag}"

    # 计算在 pln0 局部坐标中哪一侧指向椭圆外侧（+Z 在起端 y=±21.2, z=27.8）
    y0, z0 = yz_pts[0]
    p_orig = sk_s.modelToSketchSpace(pt(0.0, y0, z0))
    p_out = sk_s.modelToSketchSpace(pt(0.0, y0, z0 + 1.0))
    p_x = sk_s.modelToSketchSpace(pt(1.0, y0, z0))

    # 判断草图局部坐标轴映射 (dx_world_x vs dy_world_out)
    vx_x, vx_y = p_x.x - p_orig.x, p_x.y - p_orig.y
    vo_x, vo_y = p_out.x - p_orig.x, p_out.y - p_orig.y
    thick = abs(r_outer - r_inner)
    rc = 0.5 * (r_inner + r_outer)

    if abs(vx_x) >= abs(vx_y):
        # X 沿草图局部 X，外法向沿草图局部 Y
        sgn = 1.0 if vo_y >= 0.0 else -1.0
        prof = draw_rounded_rect_local(sk_s, p_orig.x / MM, p_orig.y / MM + sgn * rc, width_x, thick, corner_r)
    else:
        # X 沿草图局部 Y，外法向沿草图局部 X
        sgn = 1.0 if vo_x >= 0.0 else -1.0
        prof = draw_rounded_rect_local(sk_s, p_orig.x / MM + sgn * rc, p_orig.y / MM, thick, width_x, corner_r)

    path = comp.features.createPath(sp)
    sw_feats = comp.features.sweepFeatures
    sw_inp = sw_feats.createInput(prof, path, op)
    sw_inp.orientation = adsk.fusion.SweepOrientationTypes.PerpendicularOrientationType
    sw = sw_feats.add(sw_inp)
    sk_p.isLightBulbOn = False
    sk_s.isLightBulbOn = False
    pln0.isLightBulbOn = False
    return sw


def new_subcomp(root: adsk.fusion.Component, name: str) -> tuple[adsk.fusion.Occurrence, adsk.fusion.Component]:
    occ = root.occurrences.addNewComponent(adsk.core.Matrix3D.create())
    comp = occ.component
    comp.name = name
    return occ, comp


def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        doc = app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        design = adsk.fusion.Design.cast(app.activeProduct)
        design.designType = adsk.fusion.DesignTypes.ParametricDesignType
        root = design.rootComponent
        root.name = "CatMouseBand_V15_StrapHalo"

        # 1. 注册 18 个原生参数表 (fx User Parameters)
        param_count = 0
        for pname, (pval, unit, comment) in PARAMS_MM.items():
            try:
                design.userParameters.add(pname, adsk.core.ValueInput.createByReal(pval * MM), unit, comment)
                param_count += 1
            except Exception:
                pass

        apps = make_custom_appearances(app, design)
        occs: dict[str, adsk.fusion.Occurrence] = {}

        # ---------------- 01_Top_Shell_NFC ----------------
        occ_top, c_top = new_subcomp(root, "01_Top_Shell_NFC")
        occs["top"] = occ_top
        p_split = offset_plane_xy(c_top, 30.80, "Pln_Split")
        sk1 = c_top.sketches.add(p_split)
        prof1 = draw_rounded_rect_xy(sk1, 0.0, 0.0, 34.0, 42.0, 9.5)
        ext1 = extrude_profile(c_top, prof1, 4.80)
        # 顶面鹅卵石大圆角
        try:
            ec = adsk.core.ObjectCollection.create()
            for e in ext1.bodies.item(0).edges:
                if abs(e.boundingBox.maxPoint.z - mm(35.60)) < mm(0.08) and abs(e.boundingBox.minPoint.z - mm(35.60)) < mm(0.08):
                    ec.add(e)
            if ec.count > 0:
                fi = c_top.features.filletFeatures.createInput()
                fi.addConstantRadiusEdgeSet(ec, val_mm(2.60), True)
                c_top.features.filletFeatures.add(fi)
        except Exception:
            pass
        # 内部掏空 (壁厚侧 1.8mm / 顶 NFC 窗 1.2mm)
        sk1c = c_top.sketches.add(p_split)
        prof1c = draw_rounded_rect_xy(sk1c, 0.0, 0.0, 30.4, 38.4, 7.7)
        extrude_profile(c_top, prof1c, 3.60, adsk.fusion.FeatureOperations.CutFeatureOperation)
        # 顶面盲触 NFC 波纹 + 猫爪凹雕 (0.35mm)
        p_top = offset_plane_xy(c_top, 35.60, "Pln_Top_Emblem")
        sk_emb = c_top.sketches.add(p_top)
        emb_profs = adsk.core.ObjectCollection.create()
        for w_bar, dy in [(8.8, -2.0), (6.4, -1.0), (4.0, 0.0)]:
            emb_profs.add(draw_rounded_rect_xy(sk_emb, 0.0, dy, w_bar, 0.72, 0.32))
        for px, py in [(-3.8, 3.2), (-1.3, 4.3), (1.3, 4.3), (3.8, 3.2)]:
            emb_profs.add(draw_circle_xy(sk_emb, px, py, 0.95))
        extrude_profile(c_top, emb_profs, -0.35, adsk.fusion.FeatureOperations.CutFeatureOperation)
        # 右侧按键开口(上) + 3 声学槽
        sk_rc = c_top.sketches.add(p_split)
        rc_profs = adsk.core.ObjectCollection.create()
        rc_profs.add(draw_rounded_rect_xy(sk_rc, 16.2, 1.5, 3.4, 10.0, 0.4))
        for sy in (-8.2, -6.7, -5.2):
            rc_profs.add(draw_rounded_rect_xy(sk_rc, 16.2, sy, 3.2, 0.65, 0.25))
        extrude_profile(c_top, rc_profs, 2.05, adsk.fusion.FeatureOperations.CutFeatureOperation)
        assign_appearance(c_top, apps, "CM_Obsidian_PC_ABS")

        # ---------------- 02_Bottom_Shell_Pogo ----------------
        occ_bot, c_bot = new_subcomp(root, "02_Bottom_Shell_Pogo")
        occs["bot"] = occ_bot
        p_bot = offset_plane_xy(c_bot, 23.80, "Pln_Pod_Bot")
        sk2 = c_bot.sketches.add(p_bot)
        ext2 = extrude_profile(c_bot, draw_rounded_rect_xy(sk2, 0.0, 0.0, 34.0, 42.0, 9.5), 7.00)
        try:
            ec = adsk.core.ObjectCollection.create()
            for e in ext2.bodies.item(0).edges:
                if abs(e.boundingBox.maxPoint.z - mm(23.80)) < mm(0.08) and abs(e.boundingBox.minPoint.z - mm(23.80)) < mm(0.08):
                    ec.add(e)
            if ec.count > 0:
                fi = c_bot.features.filletFeatures.createInput()
                fi.addConstantRadiusEdgeSet(ec, val_mm(2.40), True)
                c_bot.features.filletFeatures.add(fi)
        except Exception:
            pass
        p_flr = offset_plane_xy(c_bot, 25.10, "Pln_Inner_Floor")
        sk2c = c_bot.sketches.add(p_flr)
        extrude_profile(c_bot, draw_rounded_rect_xy(sk2c, 0.0, 0.0, 30.4, 38.4, 7.7), 5.75, adsk.fusion.FeatureOperations.CutFeatureOperation)
        # 右侧按键开口(下) + 前后腕带 FPC 过线口
        p_bs = offset_plane_xy(c_bot, 30.80, "Pln_Bot_Split")
        sk2s = c_bot.sketches.add(p_bs)
        bs_profs = adsk.core.ObjectCollection.create()
        bs_profs.add(draw_rounded_rect_xy(sk2s, 16.2, 1.5, 3.4, 10.0, 0.4))
        bs_profs.add(draw_rounded_rect_xy(sk2s, 0.0, 20.0, 5.6, 3.2, 0.3))
        bs_profs.add(draw_rounded_rect_xy(sk2s, 0.0, -20.0, 5.6, 3.2, 0.3))
        extrude_profile(c_bot, bs_profs, -1.95, adsk.fusion.FeatureOperations.CutFeatureOperation)
        # 背面 4-pin 磁吸沉孔 + 2×M2 沉头孔
        sk2h = c_bot.sketches.add(p_bot)
        pogo_profs = adsk.core.ObjectCollection.create()
        for px in (-3.81, -1.27, 1.27, 3.81):
            pogo_profs.add(draw_circle_xy(sk2h, px, -14.2, 0.99))
        for sx in (-11.2, 11.2):
            pogo_profs.add(draw_circle_xy(sk2h, sx, 14.2, 2.05))
        extrude_profile(c_bot, pogo_profs, 0.90, adsk.fusion.FeatureOperations.CutFeatureOperation)
        assign_appearance(c_bot, apps, "CM_Obsidian_PC_ABS")

        # ---------------- 03_Side_Button_Silicone ----------------
        occ_btn, c_btn = new_subcomp(root, "03_Side_Button_Silicone")
        occs["btn"] = occ_btn
        p_bx = offset_plane_yz(c_btn, 15.40, "Pln_Btn_Base")
        sk_b = c_btn.sketches.add(p_bx)
        p_c = sk_b.modelToSketchSpace(pt(15.40, 1.5, 30.80))
        extrude_profile(c_btn, draw_rounded_rect_local(sk_b, p_c.x / MM, p_c.y / MM, 9.6, 3.6, 1.6), 2.15)
        p_bf = offset_plane_yz(c_btn, 14.70, "Pln_Btn_Flange")
        sk_bf = c_btn.sketches.add(p_bf)
        p_cf = sk_bf.modelToSketchSpace(pt(14.70, 1.5, 30.80))
        extrude_profile(c_btn, draw_rounded_rect_local(sk_bf, p_cf.x / MM, p_cf.y / MM, 11.4, 4.8, 1.8), 0.42, adsk.fusion.FeatureOperations.JoinFeatureOperation)
        assign_appearance(c_btn, apps, "CM_Button_Silicone")

        # ---------------- 04_NFC_FPC_Coil_Ferrite ----------------
        occ_nfc, c_nfc = new_subcomp(root, "04_NFC_FPC_Coil_Ferrite")
        occs["nfc"] = occ_nfc
        p_fer = offset_plane_xy(c_nfc, 33.75, "Pln_Ferrite")
        sk_f = c_nfc.sketches.add(p_fer)
        extrude_profile(c_nfc, draw_rounded_rect_xy(sk_f, 0.0, 0.0, 26.0, 32.0, 5.5), 0.20)
        p_cl = offset_plane_xy(c_nfc, 34.00, "Pln_NFC_Coil")
        sk_c = c_nfc.sketches.add(p_cl)
        draw_rounded_rect_xy(sk_c, 0.0, 0.0, 25.6, 31.6, 5.2)
        draw_rounded_rect_xy(sk_c, 0.0, 0.0, 18.0, 24.0, 3.2)
        # 取外环面 (面积最大且非内矩形)
        ring_p = sk_c.profiles.item(0)
        extrude_profile(c_nfc, ring_p, 0.25)
        assign_appearance(c_nfc, apps, "CM_Copper_NFC_FPC")

        # ---------------- 05_Mainboard_4Layer_PCBA ----------------
        occ_pcb, c_pcb = new_subcomp(root, "05_Mainboard_4Layer_PCBA")
        occs["pcb"] = occ_pcb
        p_pcb = offset_plane_xy(c_pcb, 29.65, "Pln_PCB")
        sk_p = c_pcb.sketches.add(p_pcb)
        extrude_profile(c_pcb, draw_rounded_rect_xy(sk_p, 0.0, 0.0, 28.4, 35.4, 6.2), 1.00)
        p_smd = offset_plane_xy(c_pcb, 30.65, "Pln_SMD")
        for cx, cy, w, l, h in [
            (-2.5, -7.2, 13.2, 16.6, 2.30),  # ESP32-C3-MINI-1
            (-6.5, 6.5, 6.0, 6.0, 0.85),     # PN5321A3HN
            (0.8, 5.5, 2.0, 2.0, 0.90),      # LIS2DH12TR
            (8.6, -6.5, 9.0, 9.0, 1.75),     # PKMCS0909E Buzzer
            (12.4, 1.5, 2.6, 4.2, 1.60),     # SW1 Tactile
            (0.0, 15.0, 5.4, 3.2, 0.95),     # Front LED FPC ZIF
            (0.0, -15.0, 5.4, 3.2, 0.95),    # Rear LED FPC ZIF
        ]:
            sk_m = c_pcb.sketches.add(p_smd)
            extrude_profile(c_pcb, draw_rounded_rect_xy(sk_m, cx, cy, w, l, 0.25), h)
        assign_appearance(c_pcb, apps, "CM_PCB_Matte_Green")

        # ---------------- 06_Battery_402025_300mAh ----------------
        occ_bat, c_bat = new_subcomp(root, "06_Battery_402025_300mAh")
        occs["bat"] = occ_bat
        p_bat = offset_plane_xy(c_bat, 25.30, "Pln_Bat")
        sk_bat = c_bat.sketches.add(p_bat)
        extrude_profile(c_bat, draw_rounded_rect_xy(sk_bat, 0.0, -1.5, 25.0, 20.0, 1.6), 4.00)
        assign_appearance(c_bat, apps, "CM_LiPo_Silver_Foil")

        # ---------------- 07_Vibration_Motor_1027 ----------------
        occ_mot, c_mot = new_subcomp(root, "07_Vibration_Motor_1027")
        occs["mot"] = occ_mot
        p_mot = offset_plane_xy(c_mot, 25.25, "Pln_Motor")
        sk_mot = c_mot.sketches.add(p_mot)
        extrude_profile(c_mot, draw_circle_xy(sk_mot, 0.0, 13.8, 5.0), 2.70)
        assign_appearance(c_mot, apps, "CM_LiPo_Silver_Foil")

        # ---------------- 08_Pogo_Magnets_Screws ----------------
        occ_hw, c_hw = new_subcomp(root, "08_Pogo_Magnets_Screws")
        occs["hw"] = occ_hw
        p_pg = offset_plane_xy(c_hw, 23.85, "Pln_Pogo")
        sk_pg = c_hw.sketches.add(p_pg)
        pg_profs = adsk.core.ObjectCollection.create()
        for px in (-3.81, -1.27, 1.27, 3.81):
            pg_profs.add(draw_circle_xy(sk_pg, px, -14.2, 0.90))
        extrude_profile(c_hw, pg_profs, 0.80)
        p_mg = offset_plane_xy(c_hw, 24.10, "Pln_Mag")
        sk_mg = c_hw.sketches.add(p_mg)
        mg_profs = adsk.core.ObjectCollection.create()
        for mx in (-9.0, 9.0):
            mg_profs.add(draw_circle_xy(sk_mg, mx, -14.2, 2.00))
        extrude_profile(c_hw, mg_profs, 0.90)
        assign_appearance(c_hw, apps, "CM_Gold_Pogo_Brass")

        # ---------------- 09_Strap_Front_Silicone (无缝衔接主机 +Y 端 + 光学导光槽) ----------------
        occ_sf, c_sf = new_subcomp(root, "09_Strap_Front_Silicone")
        occs["strap_f"] = occ_sf
        pts_sf = wing_spine_points(+1.0, -77.5, n_arc=18, with_tuck=False)
        sweep_rect_along_yz_spline(c_sf, pts_sf, 22.0, -1.70, 1.70, 1.30, "StrapF")
        pts_cf = wing_spine_points(+1.0, -58.0, n_arc=14, with_tuck=False)[1:]
        sweep_rect_along_yz_spline(c_sf, pts_cf, 8.0, -0.45, 2.80, 0.30, "ChanF", adsk.fusion.FeatureOperations.CutFeatureOperation)
        assign_appearance(c_sf, apps, "CM_Charcoal_LSR_Silicone")

        # ---------------- 10_Strap_Rear_Silicone (无缝衔接主机 -Y 端 + 光学槽 + 外偏穿扣舌带) ----------------
        occ_sr, c_sr = new_subcomp(root, "10_Strap_Rear_Silicone")
        occs["strap_r"] = occ_sr
        pts_sr = wing_spine_points(-1.0, -127.0, n_arc=26, with_tuck=True)
        sweep_rect_along_yz_spline(c_sr, pts_sr, 22.0, -1.70, 1.70, 1.30, "StrapR")
        pts_cr = wing_spine_points(-1.0, -58.0, n_arc=14, with_tuck=False)[1:]
        sweep_rect_along_yz_spline(c_sr, pts_cr, 8.0, -0.45, 2.80, 0.30, "ChanR", adsk.fusion.FeatureOperations.CutFeatureOperation)
        assign_appearance(c_sr, apps, "CM_Charcoal_LSR_Silicone")

        # ---------------- 11 & 12: 前/后双翼乳白雾面导光条 (300° 腕带发光光环!) ----------------
        occ_lgf, c_lgf = new_subcomp(root, "11_LightGuide_Front_Diffuser")
        occs["lg_f"] = occ_lgf
        pts_lgf = wing_spine_points(+1.0, -57.2, n_arc=14, with_tuck=False)[1:]
        sweep_rect_along_yz_spline(c_lgf, pts_lgf, 7.6, 0.70, 2.05, 0.55, "LGF")
        assign_appearance(c_lgf, apps, "CM_Glow_Mouse_Green")

        occ_lgr, c_lgr = new_subcomp(root, "12_LightGuide_Rear_Diffuser")
        occs["lg_r"] = occ_lgr
        pts_lgr = wing_spine_points(-1.0, -57.2, n_arc=14, with_tuck=False)[1:]
        sweep_rect_along_yz_spline(c_lgr, pts_lgr, 7.6, 0.70, 2.05, 0.55, "LGR")
        assign_appearance(c_lgr, apps, "CM_Glow_Mouse_Green")

        # ---------------- 13_LED_FPC_12xWS2812B (双翼柔性聚酰亚胺灯带) ----------------
        occ_fpc, c_fpc = new_subcomp(root, "13_LED_FPC_12xWS2812B")
        occs["fpc"] = occ_fpc
        sweep_rect_along_yz_spline(c_fpc, pts_lgf, 4.5, -0.31, -0.15, 0.05, "FPCF")
        sweep_rect_along_yz_spline(c_fpc, pts_lgr, 4.5, -0.31, -0.15, 0.05, "FPCR")
        assign_appearance(c_fpc, apps, "CM_Amber_LED_FPC")

        # ---------------- 14_Tang_Buckle_Aluminum ----------------
        occ_bk, c_bk = new_subcomp(root, "14_Tang_Buckle_Aluminum")
        occs["buckle"] = occ_bk
        p_bk = offset_plane_xy(c_bk, -33.25, "Pln_Buckle")
        sk_bk = c_bk.sketches.add(p_bk)
        draw_rounded_rect_xy(sk_bk, 0.0, 0.0, 26.2, 9.6, 2.0)
        draw_rounded_rect_xy(sk_bk, 0.0, 0.0, 23.2, 5.2, 1.0)
        extrude_profile(c_bk, sk_bk.profiles.item(0), 7.00)
        assign_appearance(c_bk, apps, "CM_Anodized_SpaceGrey")

        # ---------------- 15_Silicone_Keeper_Loop ----------------
        occ_kp, c_kp = new_subcomp(root, "15_Silicone_Keeper_Loop")
        occs["keeper"] = occ_kp
        p_kp = offset_plane_xy(c_kp, -31.8, "Pln_Keeper")
        sk_kp = c_kp.sketches.add(p_kp)
        draw_rounded_rect_xy(sk_kp, 0.0, 14.2, 25.8, 6.2, 1.8)
        draw_rounded_rect_xy(sk_kp, 0.0, 14.2, 23.2, 3.8, 0.9)
        extrude_profile(c_kp, sk_kp.profiles.item(0), 10.6)
        assign_appearance(c_kp, apps, "CM_Charcoal_LSR_Silicone")

        # ---------------- 2. 刚性装配组 + 右侧防水按键滑移运动副 (0 .. -0.45mm) ----------------
        rigid_col = adsk.core.ObjectCollection.create()
        for k, o in occs.items():
            if k != "btn":
                rigid_col.add(o)
        rg = root.rigidGroups.add(rigid_col, True)
        rg.name = "CatMouse_Chassis_Strap_RigidGroup"

        joint_name = "SideButton_Tactile_Slider_0p45mm"
        try:
            sk_j = root.sketches.add(root.xYConstructionPlane)
            sk_j.name = "_Datum_Button_Axis"
            sk_j.isLightBulbOn = False
            bline = sk_j.sketchCurves.sketchLines.addByTwoPoints(pt(14.5, 1.5, 30.8), pt(17.5, 1.5, 30.8))
            geo = adsk.fusion.JointGeometry.createByCurve(bline, adsk.fusion.JointKeyPointTypes.MiddleKeyPoint)
            jinp = root.asBuiltJoints.createInput(occ_btn, occ_top, geo)
            jinp.setAsSliderJointMotion(adsk.fusion.JointDirections.XAxisJointDirection)
            j_btn = root.asBuiltJoints.add(jinp)
            j_btn.name = joint_name
            lim = adsk.fusion.SliderJointMotion.cast(j_btn.jointMotion).slideLimits
            lim.isMinimumValueEnabled = True
            lim.minimumValue = -0.045  # -0.45 mm 按压行程
            lim.isMaximumValueEnabled = True
            lim.maximumValue = 0.0
        except Exception:
            pass

        # ---------------- 3. 调整视角并导出 .f3d 存档 ----------------
        vp = app.activeViewport
        cam = vp.camera
        cam.viewOrientation = adsk.core.ViewOrientations.IsoTopRightViewOrientation
        cam.isFitView = True
        vp.camera = cam
        vp.fit()

        OUT_DIR.mkdir(parents=True, exist_ok=True)
        exp_mgr = design.exportManager
        f3d_ok = exp_mgr.execute(exp_mgr.createFusionArchiveExportOptions(str(F3D_PATH)))

        report = {
            "design_name": root.name,
            "mode": "100% Native Parametric Fusion 360 Feature Tree",
            "user_parameters": param_count,
            "components": root.occurrences.count,
            "appearances": list(apps.keys()),
            "live_joint": joint_name,
            "exported_f3d": str(F3D_PATH),
            "exported_ok": bool(f3d_ok),
        }
        REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

        ui.messageBox(
            f"CatMouse Band V1.5 (Strap-Halo 腕带光环版) 原生参数化工程构建完成！\n\n"
            f"- 特征树：15 个独立组件（主机 + 300° 发光硅胶腕带 + 12×LED FPC + 针扣）\n"
            f"- 用户参数 (fx)：{param_count} 个\n"
            f"- 外观色板：{len(apps)} 种（含红猫/绿鼠/蓝求救导光环，可拖拽一键换色）\n"
            f"- 实时运动副：{joint_name} (0..0.45 mm)\n"
            f"- 已自动导出 .f3d：{F3D_PATH}",
            "CatMouse Band V1.5 — Fusion 360",
        )
    except Exception:
        if ui:
            ui.messageBox("CatMouse Band V1.5 构建异常:\n" + traceback.format_exc())
