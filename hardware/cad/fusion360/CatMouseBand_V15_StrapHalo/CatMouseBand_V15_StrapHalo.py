"""CatMouse Band V1.5 ("Strap-Halo" 腕带光环版) — 100% 原生参数化 Autodesk Fusion 360 脚本 (v2 稳健版)

已严格对齐本机 Autodesk Fusion 360 API 实测规范：
- 全部拉伸使用 DistanceExtentDefinition + 平面法向自检 + participantBodies
- 全部腕带扫掠使用 3D 样条 + setByPath(ProportionalPathDistanceType, 0.0) + NewBody 扫掠 + Combine(Cut)
- 圆角使用 edgeSetInputs.addConstantRadiusEdgeSet
- 外观使用 appearance.properties + ColorProperty（含红猫/绿鼠/蓝求救三套发光导光条材质）
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


def _dir_positive(pln: adsk.fusion.ConstructionPlane, dx: float, dy: float, dz: float) -> bool:
    n = pln.geometry.normal
    return (n.x * dx + n.y * dy + n.z * dz) >= 0.0


def offset_plane_xy(comp: adsk.fusion.Component, z_mm: float, name: str) -> adsk.fusion.ConstructionPlane:
    inp = comp.constructionPlanes.createInput()
    inp.setByOffset(comp.xYConstructionPlane, val_mm(_signed_offset(comp.xYConstructionPlane, z_mm, 2)))
    pln = comp.constructionPlanes.add(inp)
    pln.name = name
    pln.isLightBulbOn = False
    return pln


def offset_plane_yz(comp: adsk.fusion.Component, x_mm: float, name: str) -> adsk.fusion.ConstructionPlane:
    inp = comp.constructionPlanes.createInput()
    inp.setByOffset(comp.yZConstructionPlane, val_mm(_signed_offset(comp.yZConstructionPlane, x_mm, 0)))
    pln = comp.constructionPlanes.add(inp)
    pln.name = name
    pln.isLightBulbOn = False
    return pln


def draw_rounded_rect_local(
    sk: adsk.fusion.Sketch,
    cx_mm: float,
    cy_mm: float,
    w_mm: float,
    h_mm: float,
    r_mm: float,
) -> None:
    """在草图局部 2D 平面中绘制严格闭合 CCW 圆角矩形（或直角矩形当 r<=0.05）。"""
    hw, hh = w_mm * 0.5, h_mm * 0.5
    lc = sk.sketchCurves.sketchLines
    if r_mm <= 0.05:
        p0 = pt(cx_mm - hw, cy_mm - hh, 0.0)
        p1 = pt(cx_mm + hw, cy_mm - hh, 0.0)
        p2 = pt(cx_mm + hw, cy_mm + hh, 0.0)
        p3 = pt(cx_mm - hw, cy_mm + hh, 0.0)
        l0 = lc.addByTwoPoints(p0, p1)
        l1 = lc.addByTwoPoints(l0.endSketchPoint, p2)
        l2 = lc.addByTwoPoints(l1.endSketchPoint, p3)
        lc.addByTwoPoints(l2.endSketchPoint, l0.startSketchPoint)
        return
    r = max(0.06, min(r_mm, hw - 0.04, hh - 0.04))
    ac = sk.sketchCurves.sketchArcs
    specs = [
        (cx_mm + hw - r, cy_mm + hh - r, cx_mm + hw, cy_mm + hh - r),
        (cx_mm - hw + r, cy_mm + hh - r, cx_mm - hw + r, cy_mm + hh),
        (cx_mm - hw + r, cy_mm - hh + r, cx_mm - hw, cy_mm - hh + r),
        (cx_mm + hw - r, cy_mm - hh + r, cx_mm + hw - r, cy_mm - hh),
    ]
    arcs = [ac.addByCenterStartSweep(pt(acx, acy, 0.0), pt(sx, sy, 0.0), math.pi * 0.5) for acx, acy, sx, sy in specs]
    for i in range(4):
        lc.addByTwoPoints(arcs[i].endSketchPoint, arcs[(i + 1) % 4].startSketchPoint)


def draw_rounded_rect_xy(sk: adsk.fusion.Sketch, cx_mm: float, cy_mm: float, w_mm: float, h_mm: float, r_mm: float) -> None:
    """在偏移 XY 平面中按世界 (X, Y) 绘制严格闭合 CCW 圆角矩形（自动处理坐标系手性）。"""
    c_mid = sk.modelToSketchSpace(pt(cx_mm, cy_mm, 0.0))
    px = sk.modelToSketchSpace(pt(cx_mm + 1.0, cy_mm, 0.0))
    py = sk.modelToSketchSpace(pt(cx_mm, cy_mm + 1.0, 0.0))
    ux, uy = px.x - c_mid.x, px.y - c_mid.y
    vx, vy = py.x - c_mid.x, py.y - c_mid.y
    # 检查 2D 草图坐标系相对世界 XY 的方向
    if abs(ux) >= abs(uy):
        draw_rounded_rect_local(sk, c_mid.x / MM, c_mid.y / MM, w_mm, h_mm, r_mm)
    else:
        draw_rounded_rect_local(sk, c_mid.x / MM, c_mid.y / MM, h_mm, w_mm, r_mm)


def draw_circle_xy(sk: adsk.fusion.Sketch, cx_mm: float, cy_mm: float, r_mm: float) -> None:
    cp = sk.modelToSketchSpace(pt(cx_mm, cy_mm, 0.0))
    sk.sketchCurves.sketchCircles.addByCenterRadius(adsk.core.Point3D.create(cp.x, cp.y, 0.0), mm(r_mm))


def draw_closed_poly_xy(sk: adsk.fusion.Sketch, xy_pts: list[tuple[float, float]]) -> None:
    """在偏移 XY 平面中按世界 (X, Y) 顶点绘制严格闭合单环多边形（用于可展开扁平 FPC 与穿线隧道）。"""
    lc = sk.sketchCurves.sketchLines
    spts = []
    for x_mm, y_mm in xy_pts:
        p = sk.modelToSketchSpace(pt(x_mm, y_mm, 0.0))
        spts.append(adsk.core.Point3D.create(p.x, p.y, 0.0))
    prev = None
    first_start = None
    for i in range(len(spts)):
        if i == 0:
            prev = lc.addByTwoPoints(spts[0], spts[1])
            first_start = prev.startSketchPoint
        elif i < len(spts) - 1:
            prev = lc.addByTwoPoints(prev.endSketchPoint, spts[i + 1])
        else:
            lc.addByTwoPoints(prev.endSketchPoint, first_start)


def extrude_z_poly(
    comp: adsk.fusion.Component,
    xy_pts: list[tuple[float, float]],
    z0_mm: float,
    z1_mm: float,
    op: adsk.fusion.FeatureOperations,
    name: str,
    target_bodies: list[adsk.fusion.BRepBody] | None = None,
) -> adsk.fusion.ExtrudeFeature:
    pln = offset_plane_xy(comp, min(z0_mm, z1_mm), f"_Pln_{name}")
    sk = comp.sketches.add(pln)
    sk.name = f"_Sk_{name}"
    sk.isLightBulbOn = False
    draw_closed_poly_xy(sk, xy_pts)
    return extrude_one_side(
        comp,
        sk.profiles.item(0),
        abs(z1_mm - z0_mm),
        op,
        positive=_dir_positive(pln, 0.0, 0.0, 1.0),
        target_bodies=target_bodies,
        name=name,
    )


def all_profiles(sk: adsk.fusion.Sketch) -> adsk.core.ObjectCollection:
    col = adsk.core.ObjectCollection.create()
    for i in range(sk.profiles.count):
        col.add(sk.profiles.item(i))
    return col


def ring_profile(sk: adsk.fusion.Sketch) -> adsk.fusion.Profile:
    """从同心双环草图中精确选取环形外轮廓（profileLoops.count == 2）。"""
    for i in range(sk.profiles.count):
        p = sk.profiles.item(i)
        if p.profileLoops.count >= 2:
            return p
    return sk.profiles.item(0)


def extrude_one_side(
    comp: adsk.fusion.Component,
    prof,
    dist_mm: float,
    op: adsk.fusion.FeatureOperations,
    positive: bool = True,
    target_bodies: list[adsk.fusion.BRepBody] | None = None,
    name: str = "",
) -> adsk.fusion.ExtrudeFeature:
    inp = comp.features.extrudeFeatures.createInput(prof, op)
    direction = (
        adsk.fusion.ExtentDirections.PositiveExtentDirection
        if positive
        else adsk.fusion.ExtentDirections.NegativeExtentDirection
    )
    inp.setOneSideExtent(adsk.fusion.DistanceExtentDefinition.create(val_mm(abs(dist_mm))), direction)
    if target_bodies is not None and op in (
        adsk.fusion.FeatureOperations.CutFeatureOperation,
        adsk.fusion.FeatureOperations.IntersectFeatureOperation,
    ):
        inp.participantBodies = target_bodies
    feat = comp.features.extrudeFeatures.add(inp)
    if name:
        feat.name = name
    return feat


def extrude_z_rect(
    comp: adsk.fusion.Component,
    cx_mm: float,
    cy_mm: float,
    w_mm: float,
    h_mm: float,
    r_mm: float,
    z0_mm: float,
    z1_mm: float,
    op: adsk.fusion.FeatureOperations,
    name: str,
    target_bodies: list[adsk.fusion.BRepBody] | None = None,
) -> adsk.fusion.ExtrudeFeature:
    pln = offset_plane_xy(comp, min(z0_mm, z1_mm), f"_Pln_{name}")
    sk = comp.sketches.add(pln)
    sk.name = f"_Sk_{name}"
    sk.isLightBulbOn = False
    draw_rounded_rect_xy(sk, cx_mm, cy_mm, w_mm, h_mm, r_mm)
    return extrude_one_side(
        comp,
        sk.profiles.item(0),
        abs(z1_mm - z0_mm),
        op,
        positive=_dir_positive(pln, 0.0, 0.0, 1.0),
        target_bodies=target_bodies,
        name=name,
    )


def extrude_z_cyl(
    comp: adsk.fusion.Component,
    cx_mm: float,
    cy_mm: float,
    r_mm: float,
    z0_mm: float,
    z1_mm: float,
    op: adsk.fusion.FeatureOperations,
    name: str,
    target_bodies: list[adsk.fusion.BRepBody] | None = None,
) -> adsk.fusion.ExtrudeFeature:
    pln = offset_plane_xy(comp, min(z0_mm, z1_mm), f"_Pln_{name}")
    sk = comp.sketches.add(pln)
    sk.name = f"_Sk_{name}"
    sk.isLightBulbOn = False
    draw_circle_xy(sk, cx_mm, cy_mm, r_mm)
    return extrude_one_side(
        comp,
        sk.profiles.item(0),
        abs(z1_mm - z0_mm),
        op,
        positive=_dir_positive(pln, 0.0, 0.0, 1.0),
        target_bodies=target_bodies,
        name=name,
    )


def combine_bodies(
    comp: adsk.fusion.Component,
    target: adsk.fusion.BRepBody,
    tools: list[adsk.fusion.BRepBody],
    op: adsk.fusion.FeatureOperations,
    name: str,
) -> adsk.fusion.CombineFeature:
    col = adsk.core.ObjectCollection.create()
    for t in tools:
        col.add(t)
    inp = comp.features.combineFeatures.createInput(target, col)
    inp.operation = op
    inp.isKeepToolBodies = False
    feat = comp.features.combineFeatures.add(inp)
    feat.name = name
    return feat


def try_fillet_z_edges(comp: adsk.fusion.Component, body: adsk.fusion.BRepBody, z_mm: float, r_mm: float, name: str):
    try:
        col = adsk.core.ObjectCollection.create()
        for e in body.edges:
            if abs(e.boundingBox.maxPoint.z - mm(z_mm)) < mm(0.08) and abs(e.boundingBox.minPoint.z - mm(z_mm)) < mm(0.08):
                col.add(e)
        if col.count > 0:
            inp = comp.features.filletFeatures.createInput()
            inp.edgeSetInputs.addConstantRadiusEdgeSet(col, val_mm(r_mm), True)
            f = comp.features.filletFeatures.add(inp)
            f.name = name
    except Exception:
        pass


def make_custom_appearances(app: adsk.core.Application, design: adsk.fusion.Design) -> dict[str, adsk.core.Appearance]:
    """创建 CatMouse Band V1.5 CMF 外观色板（使用 Fusion 实测兼容的 appearance.properties + ColorProperty API）。"""
    palette = {
        "CM_Obsidian_PC_ABS": (44, 48, 54),
        "CM_Charcoal_LSR_Silicone": (52, 56, 63),
        "CM_Button_Silicone": (72, 77, 86),
        "CM_Glow_Mouse_Green": (22, 245, 130),
        "CM_Glow_Cat_Red": (250, 42, 62),
        "CM_Glow_Jailed_Blue": (34, 138, 255),
        "CM_PCB_Matte_Green": (24, 108, 66),
        "CM_Copper_NFC_FPC": (214, 138, 58),
        "CM_Amber_LED_FPC": (236, 166, 36),
        "CM_Gold_Pogo_Brass": (238, 192, 60),
        "CM_LiPo_Silver_Foil": (198, 204, 214),
        "CM_Anodized_SpaceGrey": (76, 82, 92),
        "CM_ZIF_Ivory_LCP": (240, 235, 222),
    }
    base_app = None
    for lib in app.materialLibraries:
        for item in lib.appearances:
            if any(k in item.name.lower() for k in ("plastic - matte", "abs", "matte", "plastic", "paint")):
                for prop in item.properties:
                    if prop.objectType == adsk.core.ColorProperty.classType() and not prop.isReadOnly:
                        base_app = item
                        break
            if base_app is not None:
                break
        if base_app is not None:
            break
    if base_app is None and design.appearances.count > 0:
        base_app = design.appearances.item(0)

    out: dict[str, adsk.core.Appearance] = {}
    if base_app is None:
        return out
    for name, (r, g, b) in palette.items():
        try:
            existing = design.appearances.itemByName(name)
            if existing is not None:
                out[name] = existing
                continue
            new_app = design.appearances.addByCopy(base_app, name)
            col = adsk.core.Color.create(r, g, b, 255)
            done = False
            for prop in new_app.properties:
                if prop.objectType == adsk.core.ColorProperty.classType() and not prop.isReadOnly:
                    cp = adsk.core.ColorProperty.cast(prop)
                    pid = (cp.id or "").lower()
                    if any(k in pid for k in ("albedo", "diffuse", "color", "base")) or not done:
                        if cp.hasConnectedTexture:
                            cp.hasConnectedTexture = False
                        cp.value = col
                        done = True
            out[name] = new_app
        except Exception:
            pass
    return out


def assign_appearance(comp: adsk.fusion.Component, apps: dict, key: str):
    a = apps.get(key)
    if a is None:
        return
    for i in range(comp.bRepBodies.count):
        try:
            comp.bRepBodies.item(i).appearance = a
        except Exception:
            pass


def wing_spine_points(sign_y: float, end_theta_deg: float, n_arc: int = 16, with_tuck: bool = False) -> list[tuple[float, float]]:
    """返回 Y-Z 平面内从主机端面水平切出、无缝衔接手腕椭圆的平滑中心脊线。"""
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


def sweep_band_new_body(
    comp: adsk.fusion.Component,
    yz_pts: list[tuple[float, float]],
    width_x: float,
    r_inner: float,
    r_outer: float,
    corner_r: float,
    tag: str,
    x_mm: float = 0.0,
) -> adsk.fusion.BRepBody:
    """使用实测稳健的常 X 3D 样条 + setByPath(ProportionalPathDistanceType, 0.0) 扫掠实体。"""
    sk_p = comp.sketches.add(comp.xYConstructionPlane)
    sk_p.name = f"_Path_{tag}"
    sk_p.isLightBulbOn = False
    pcol = adsk.core.ObjectCollection.create()
    for y_mm, z_mm in yz_pts:
        pcol.add(pt(x_mm, y_mm, z_mm))
    sp = sk_p.sketchCurves.sketchFittedSplines.add(pcol)
    path = comp.features.createPath(sp, False)

    cp_inp = comp.constructionPlanes.createInput()
    cp_inp.setByPath(path, adsk.fusion.PathDistanceTypes.ProportionalPathDistanceType, adsk.core.ValueInput.createByReal(0.0))
    pln0 = comp.constructionPlanes.add(cp_inp)
    pln0.name = f"_Pln_{tag}"
    pln0.isLightBulbOn = False

    sk_s = comp.sketches.add(pln0)
    sk_s.name = f"_Sec_{tag}"
    sk_s.isLightBulbOn = False

    y0, z0 = yz_pts[0]
    p_orig = sk_s.modelToSketchSpace(pt(x_mm, y0, z0))
    p_out = sk_s.modelToSketchSpace(pt(x_mm, y0, z0 + 1.0))
    p_x = sk_s.modelToSketchSpace(pt(x_mm + 1.0, y0, z0))

    vx_x, vx_y = p_x.x - p_orig.x, p_x.y - p_orig.y
    vo_x, vo_y = p_out.x - p_orig.x, p_out.y - p_orig.y
    thick = abs(r_outer - r_inner)
    rc = 0.5 * (r_inner + r_outer)

    if abs(vx_x) >= abs(vx_y):
        sgn = 1.0 if vo_y >= 0.0 else -1.0
        draw_rounded_rect_local(sk_s, p_orig.x / MM, p_orig.y / MM + sgn * rc, width_x, thick, corner_r)
    else:
        sgn = 1.0 if vo_x >= 0.0 else -1.0
        draw_rounded_rect_local(sk_s, p_orig.x / MM + sgn * rc, p_orig.y / MM, thick, width_x, corner_r)

    sw_inp = comp.features.sweepFeatures.createInput(
        sk_s.profiles.item(0), path, adsk.fusion.FeatureOperations.NewBodyFeatureOperation
    )
    sw_feat = comp.features.sweepFeatures.add(sw_inp)
    sw_feat.name = f"Sweep_{tag}"
    return sw_feat.bodies.item(0)


def new_subcomp(root: adsk.fusion.Component, name: str) -> tuple[adsk.fusion.Occurrence, adsk.fusion.Component]:
    occ = root.occurrences.addNewComponent(adsk.core.Matrix3D.create())
    comp = occ.component
    comp.name = name
    return occ, comp


def run(context):
    ui = None
    step = "init"
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        design = adsk.fusion.Design.cast(app.activeProduct)
        design.designType = adsk.fusion.DesignTypes.ParametricDesignType
        root = design.rootComponent
        root.name = "CatMouseBand_V15_StrapHalo"

        # 1. 注册 18 个原生参数 (fx)
        step = "user_parameters"
        param_count = 0
        for pname, (pval, unit, comment) in PARAMS_MM.items():
            if design.userParameters.itemByName(pname) is None:
                design.userParameters.add(pname, val_mm(pval), unit, comment)
                param_count += 1

        step = "appearances"
        apps = make_custom_appearances(app, design)
        occs: dict[str, adsk.fusion.Occurrence] = {}

        # ---------------- 01_Top_Shell_NFC ----------------
        step = "01_Top_Shell_NFC"
        occ_top, c_top = new_subcomp(root, "01_Top_Shell_NFC")
        occs["top"] = occ_top
        f_top = extrude_z_rect(c_top, 0.0, 0.0, 34.0, 42.0, 9.5, 30.80, 35.60, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "Top_Body")
        b_top = f_top.bodies.item(0)
        try_fillet_z_edges(c_top, b_top, 35.60, 2.60, "Fillet_Top_Pebble")
        # 挖空内部腔体 (侧壁 1.8mm，顶 NFC 窗 1.20mm)
        extrude_z_rect(c_top, 0.0, 0.0, 30.4, 38.4, 7.7, 30.75, 34.40, adsk.fusion.FeatureOperations.CutFeatureOperation, "Cut_Top_Cavity", [b_top])
        # 顶面盲触 NFC 波纹 + 猫爪凹雕 (0.35mm)
        p_top = offset_plane_xy(c_top, 35.60, "_Pln_Emblem")
        sk_emb = c_top.sketches.add(p_top)
        sk_emb.isLightBulbOn = False
        for w_bar, dy in [(8.8, -2.0), (6.4, -1.0), (4.0, 0.0)]:
            draw_rounded_rect_xy(sk_emb, 0.0, dy, w_bar, 0.72, 0.30)
        for px, py in [(-3.8, 3.2), (-1.3, 4.3), (1.3, 4.3), (3.8, 3.2)]:
            draw_circle_xy(sk_emb, px, py, 0.95)
        extrude_one_side(c_top, all_profiles(sk_emb), 0.35, adsk.fusion.FeatureOperations.CutFeatureOperation, positive=_dir_positive(p_top, 0.0, 0.0, -1.0), target_bodies=[b_top], name="Cut_NFC_Emblem")
        # 右侧按键开口(上) + 3 声学槽（正对蜂鸣器 Y=-5.2）
        p_sp = offset_plane_xy(c_top, 30.80, "_Pln_Top_SideCuts")
        sk_rc = c_top.sketches.add(p_sp)
        sk_rc.isLightBulbOn = False
        draw_rounded_rect_xy(sk_rc, 16.2, 1.5, 3.4, 10.0, 0.35)
        for sy in (-6.7, -5.2, -3.7):
            draw_rounded_rect_xy(sk_rc, 16.2, sy, 3.2, 0.65, 0.20)
        extrude_one_side(c_top, all_profiles(sk_rc), 2.05, adsk.fusion.FeatureOperations.CutFeatureOperation, positive=_dir_positive(p_sp, 0.0, 0.0, 1.0), target_bodies=[b_top], name="Cut_Top_Btn_Acoustic")
        assign_appearance(c_top, apps, "CM_Obsidian_PC_ABS")

        # ---------------- 02_Bottom_Shell_Pogo ----------------
        step = "02_Bottom_Shell_Pogo"
        occ_bot, c_bot = new_subcomp(root, "02_Bottom_Shell_Pogo")
        occs["bot"] = occ_bot
        f_bot = extrude_z_rect(c_bot, 0.0, 0.0, 34.0, 42.0, 9.5, 23.80, 30.80, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "Bot_Body")
        b_bot = f_bot.bodies.item(0)
        try_fillet_z_edges(c_bot, b_bot, 23.80, 2.40, "Fillet_Bot_Pebble")
        extrude_z_rect(c_bot, 0.0, 0.0, 30.4, 38.4, 7.7, 25.10, 30.85, adsk.fusion.FeatureOperations.CutFeatureOperation, "Cut_Bot_Cavity", [b_bot])
        # 前/后端内侧加厚 T 型防拉脱压紧凸台 (Join 到 b_bot)
        for tag_c, sy in (("Front", +1.0), ("Rear", -1.0)):
            extrude_z_rect(c_bot, 0.0, sy * 18.725, 18.4, 1.15, 0.0, 25.10, 30.80, adsk.fusion.FeatureOperations.JoinFeatureOperation, f"Join_TCollar_{tag_c}")
        # 右侧按键开口(下)
        extrude_z_rect(c_bot, 16.2, 1.5, 3.4, 10.0, 0.35, 28.85, 30.85, adsk.fusion.FeatureOperations.CutFeatureOperation, "Cut_Bot_Btn", [b_bot])
        # 前/后对称 T 型硅胶腕带防拉脱锁扣槽（顶部敞口至 Z=30.80）
        for tag_c, sy in (("Front", +1.0), ("Rear", -1.0)):
            extrude_z_rect(c_bot, 0.0, sy * 20.50, 12.4, 1.60, 0.0, 26.60, 30.85, adsk.fusion.FeatureOperations.CutFeatureOperation, f"Cut_TNeck_{tag_c}", [b_bot])
            extrude_z_rect(c_bot, 0.0, sy * 19.275, 15.6, 0.95, 0.0, 26.60, 30.85, adsk.fusion.FeatureOperations.CutFeatureOperation, f"Cut_THead_{tag_c}", [b_bot])
        # 前翼中心 FPC 过线口 + 后翼西侧独立防水 FPC 过线口 (X=-9.65，绕开 -Y BLE 天线净空区!)
        extrude_z_rect(c_bot, 0.0, 18.50, 3.8, 0.90, 0.0, 29.00, 30.85, adsk.fusion.FeatureOperations.CutFeatureOperation, "Cut_FPC_Slot_F", [b_bot])
        extrude_z_rect(c_bot, -9.65, -19.60, 2.7, 3.40, 0.0, 27.00, 30.85, adsk.fusion.FeatureOperations.CutFeatureOperation, "Cut_FPC_Slot_R_West", [b_bot])
        # 背面 +Y 侧 4-pin 磁吸沉孔 (Y=+14.8) + 2×M2 沉头孔 (X=±12.6, Y=+11.0)
        p_bh = offset_plane_xy(c_bot, 23.80, "_Pln_Bot_Holes")
        sk_bh = c_bot.sketches.add(p_bh)
        sk_bh.isLightBulbOn = False
        for px in (-3.81, -1.27, 1.27, 3.81):
            draw_circle_xy(sk_bh, px, 14.8, 0.99)
        for sx in (-12.6, 12.6):
            draw_circle_xy(sk_bh, sx, 11.0, 2.05)
        extrude_one_side(c_bot, all_profiles(sk_bh), 0.90, adsk.fusion.FeatureOperations.CutFeatureOperation, positive=_dir_positive(p_bh, 0.0, 0.0, 1.0), target_bodies=[b_bot], name="Cut_Bot_Pogo_M2")
        assign_appearance(c_bot, apps, "CM_Obsidian_PC_ABS")

        # ---------------- 03_Side_Button_Silicone ----------------
        step = "03_Side_Button_Silicone"
        occ_btn, c_btn = new_subcomp(root, "03_Side_Button_Silicone")
        occs["btn"] = occ_btn
        p_bx = offset_plane_yz(c_btn, 15.40, "_Pln_Btn_Cap")
        sk_b = c_btn.sketches.add(p_bx)
        sk_b.isLightBulbOn = False
        pc = sk_b.modelToSketchSpace(pt(15.40, 1.5, 30.80))
        py_dir = sk_b.modelToSketchSpace(pt(15.40, 2.5, 30.80))
        if abs(py_dir.x - pc.x) >= abs(py_dir.y - pc.y):
            draw_rounded_rect_local(sk_b, pc.x / MM, pc.y / MM, 9.6, 3.6, 1.6)
        else:
            draw_rounded_rect_local(sk_b, pc.x / MM, pc.y / MM, 3.6, 9.6, 1.6)
        f_btn = extrude_one_side(c_btn, sk_b.profiles.item(0), 2.15, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, positive=_dir_positive(p_bx, 1.0, 0.0, 0.0), name="Btn_Cap")
        # 内部防水裙边 (14.70 -> 15.50，与外部按键帽重叠 0.10mm 确保 Join 100% 成功!)
        p_bf = offset_plane_yz(c_btn, 14.70, "_Pln_Btn_Flange")
        sk_bf = c_btn.sketches.add(p_bf)
        sk_bf.isLightBulbOn = False
        pcf = sk_bf.modelToSketchSpace(pt(14.70, 1.5, 30.80))
        pyf = sk_bf.modelToSketchSpace(pt(14.70, 2.5, 30.80))
        if abs(pyf.x - pcf.x) >= abs(pyf.y - pcf.y):
            draw_rounded_rect_local(sk_bf, pcf.x / MM, pcf.y / MM, 11.4, 4.8, 1.8)
        else:
            draw_rounded_rect_local(sk_bf, pcf.x / MM, pcf.y / MM, 4.8, 11.4, 1.8)
        extrude_one_side(c_btn, sk_bf.profiles.item(0), 0.80, adsk.fusion.FeatureOperations.JoinFeatureOperation, positive=_dir_positive(p_bf, 1.0, 0.0, 0.0), name="Btn_Flange")
        assign_appearance(c_btn, apps, "CM_Button_Silicone")

        # ---------------- 04_NFC_FPC_Coil_Ferrite (含铜质 C 型下弯触点尾带!) ----------------
        step = "04_NFC_FPC_Coil_Ferrite"
        occ_nfc, c_nfc = new_subcomp(root, "04_NFC_FPC_Coil_Ferrite")
        occs["nfc"] = occ_nfc
        extrude_z_rect(c_nfc, 0.0, 2.25, 25.0, 24.5, 5.0, 33.75, 33.95, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "NFC_Ferrite")
        p_cl = offset_plane_xy(c_nfc, 34.00, "_Pln_NFC_Coil")
        sk_c = c_nfc.sketches.add(p_cl)
        sk_c.isLightBulbOn = False
        draw_rounded_rect_xy(sk_c, 0.0, 2.25, 24.6, 24.1, 4.8)
        draw_rounded_rect_xy(sk_c, 0.0, 2.25, 17.2, 16.7, 3.0)
        extrude_one_side(c_nfc, ring_profile(sk_c), 0.25, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, positive=_dir_positive(p_cl, 0.0, 0.0, 1.0), name="NFC_Copper_Coil")
        # 铜质 C 型柔性下弯触点排线 (X=-6.8，绕过铁氧体前缘压接主板 J_NFC_SPRING 弹片座)
        nfc_tail_yz = [
            (13.80, 34.12),
            (14.85, 34.04),
            (15.35, 33.25),
            (14.65, 32.15),
            (13.00, 31.52),
            (11.40, 31.49),
        ]
        sweep_band_new_body(c_nfc, nfc_tail_yz, 3.0, -0.09, 0.09, 0.0, "NFC_Flex_Tail", x_mm=-6.8)
        assign_appearance(c_nfc, apps, "CM_Copper_NFC_FPC")

        # ---------------- 05_Mainboard_4Layer_PCBA (单面 L1 贴片 · RF 净空与分区布局) ----------------
        step = "05_Mainboard_4Layer_PCBA"
        occ_pcb, c_pcb = new_subcomp(root, "05_Mainboard_4Layer_PCBA")
        occs["pcb"] = occ_pcb
        f_pcb = extrude_z_rect(c_pcb, 0.0, 0.0, 28.4, 35.4, 6.2, 29.65, 30.65, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "FR4_4L_Board")
        b_pcb = f_pcb.bodies.item(0)
        for sx in (-12.6, 12.6):
            extrude_z_cyl(c_pcb, sx, 11.0, 2.1, 29.55, 30.75, adsk.fusion.FeatureOperations.CutFeatureOperation, f"PCB_M2_Notch_{int(sx)}", [b_pcb])
        for mname, cx, cy, w, l, h in [
            ("ESP32_C3_MINI", -1.7, -9.2, 13.2, 16.6, 2.30),
            ("PN532_QFN40", -6.8, 6.2, 6.0, 6.0, 0.85),
            ("Y1_27M12", -11.8, 6.2, 2.5, 3.2, 0.80),
            ("LIS2DH12_IMU", 0.5, 4.2, 2.0, 2.0, 0.90),
            ("PKMCS0909E_Buzzer", 9.6, -5.2, 9.0, 9.0, 1.75),
            ("PMIC_MCP73831", 5.2, 5.2, 2.9, 2.8, 1.10),
            ("LDO_AP2112K", 8.6, 5.2, 2.9, 2.8, 1.10),
            ("Q1_LED_PMOS", 5.2, 9.0, 2.9, 2.8, 1.10),
            ("Q2Q3_Drivers", 8.6, 9.0, 2.9, 2.8, 1.10),
            ("SW1_Tactile", 12.5, 1.5, 2.6, 4.2, 1.60),
        ]:
            extrude_z_rect(c_pcb, cx, cy, w, l, 0.20, 30.65, 30.65 + h, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, mname)
        assign_appearance(c_pcb, apps, "CM_PCB_Matte_Green")

        # ---------------- 06_Battery_402025_300mAh ----------------
        step = "06_Battery_402025_300mAh"
        occ_bat, c_bat = new_subcomp(root, "06_Battery_402025_300mAh")
        occs["bat"] = occ_bat
        extrude_z_rect(c_bat, 0.0, -1.05, 23.6, 16.9, 1.6, 25.30, 29.30, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "Battery_LiPo")
        assign_appearance(c_bat, apps, "CM_LiPo_Silver_Foil")

        # ---------------- 07_Vibration_Motor_1027 ----------------
        step = "07_Vibration_Motor_1027"
        occ_mot, c_mot = new_subcomp(root, "07_Vibration_Motor_1027")
        occs["mot"] = occ_mot
        extrude_z_cyl(c_mot, 0.0, 12.8, 5.0, 25.25, 27.95, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "Motor_1027")
        assign_appearance(c_mot, apps, "CM_LiPo_Silver_Foil")

        # ---------------- 08_Pogo_Magnets_Screws ----------------
        step = "08_Pogo_Magnets_Screws"
        occ_hw, c_hw = new_subcomp(root, "08_Pogo_Magnets_Screws")
        occs["hw"] = occ_hw
        for i, px in enumerate((-3.81, -1.27, 1.27, 3.81)):
            extrude_z_cyl(c_hw, px, 14.8, 0.90, 23.85, 24.65, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, f"Pogo_{i+1}")
        for i, mx in enumerate((-8.5, 8.5)):
            extrude_z_cyl(c_hw, mx, 14.8, 2.00, 24.10, 25.00, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, f"N52_Mag_{i+1}")
        for i, sx in enumerate((-12.6, 12.6)):
            extrude_z_cyl(c_hw, sx, 11.0, 1.85, 23.95, 24.50, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, f"M2_Head_{i+1}")
            extrude_z_cyl(c_hw, sx, 11.0, 0.95, 24.50, 28.90, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, f"M2_Shaft_{i+1}")
        assign_appearance(c_hw, apps, "CM_Gold_Pogo_Brass")

        # 方案 A 前/后翼进仓 FPC 共享路径定义（腕带穿线隧道与 FPC 实体共用同一套坐标，保证 0 干涉！）
        fpc_front_tail_yz = [
            (23.25, 27.55),
            (21.85, 27.85),
            (20.20, 29.10),
            (18.70, 30.25),
            (17.65, 31.05),
            (16.40, 31.15),
            (14.80, 31.15),
        ]
        rear_sbend_yz = [
            (-21.55, 27.55),
            (-20.75, 28.10),
            (-19.65, 29.40),
            (-18.40, 30.40),
            (-17.35, 31.05),
            (-16.65, 31.15),
        ]
        # 单环闭合多边形：后翼腕带肩部横向折弯段 (X: 0 -> -9.65)
        rear_dogleg_strap_poly = [
            (-10.65, -23.35), (1.00, -23.35), (1.00, -21.55),
            (-8.65, -21.55), (-8.65, -21.25), (-10.65, -21.25),
        ]
        rear_tunnel_strap_poly = [
            (-10.90, -23.60), (1.30, -23.60), (1.30, -21.30),
            (-8.40, -21.30), (-8.40, -21.05), (-10.90, -21.05),
        ]
        # 单环闭合多边形：后翼仓内绕行段 (绕开 ESP32 BLE 天线，沿 X=-11.20 直插 J_LED_R 槽口!)
        rear_dogleg_pod_poly = [
            (-10.65, -17.05), (-8.65, -17.05), (-8.65, -16.25),
            (-10.20, -14.45), (-10.20, -5.85), (-12.20, -5.85),
            (-12.20, -14.85), (-10.65, -16.65),
        ]

        # ---------------- 09_Strap_Front_Silicone (含一体 T 型防拉脱防水密封头 + 内埋 FPC 隧道!) ----------------
        step = "09_Strap_Front_Silicone"
        occ_sf, c_sf = new_subcomp(root, "09_Strap_Front_Silicone")
        occs["strap_f"] = occ_sf
        pts_sf = wing_spine_points(+1.0, -77.5, n_arc=16, with_tuck=False)
        b_sf = sweep_band_new_body(c_sf, pts_sf, 22.0, -1.70, 1.70, 1.25, "StrapF")
        # 一体成型 T 型防拉脱密封头 (Join 到 b_sf)
        extrude_z_rect(c_sf, 0.0, 20.625, 12.10, 1.85, 0.0, 26.75, 29.48, adsk.fusion.FeatureOperations.JoinFeatureOperation, "Front_TAnchor_Neck")
        extrude_z_rect(c_sf, 0.0, 19.335, 15.30, 0.77, 0.0, 26.75, 30.65, adsk.fusion.FeatureOperations.JoinFeatureOperation, "Front_TAnchor_Head")
        pts_cf = wing_spine_points(+1.0, -58.0, n_arc=13, with_tuck=False)[1:]
        b_cf_tool = sweep_band_new_body(c_sf, pts_cf, 8.0, -0.45, 2.50, 0.0, "ChanF_Tool")
        b_tf_tun = sweep_band_new_body(c_sf, fpc_front_tail_yz[:5], 2.8, -0.34, 0.34, 0.0, "TunnelF_Tool", x_mm=0.0)
        combine_bodies(c_sf, b_sf, [b_cf_tool, b_tf_tun], adsk.fusion.FeatureOperations.CutFeatureOperation, "Cut_ChanF_And_Tunnel")
        assign_appearance(c_sf, apps, "CM_Charcoal_LSR_Silicone")

        # ---------------- 10_Strap_Rear_Silicone (含一体 T 型锚块 + 西侧防水塞 + 内埋 FPC 隧道!) ----------------
        step = "10_Strap_Rear_Silicone"
        occ_sr, c_sr = new_subcomp(root, "10_Strap_Rear_Silicone")
        occs["strap_r"] = occ_sr
        pts_sr = wing_spine_points(-1.0, -127.0, n_arc=22, with_tuck=True)
        b_sr = sweep_band_new_body(c_sr, pts_sr, 22.0, -1.70, 1.70, 1.25, "StrapR")
        extrude_z_rect(c_sr, 0.0, -20.625, 12.10, 1.85, 0.0, 26.75, 29.48, adsk.fusion.FeatureOperations.JoinFeatureOperation, "Rear_TAnchor_Neck")
        extrude_z_rect(c_sr, 0.0, -19.335, 15.30, 0.77, 0.0, 26.75, 30.65, adsk.fusion.FeatureOperations.JoinFeatureOperation, "Rear_TAnchor_Head")
        extrude_z_rect(c_sr, -9.65, -20.325, 2.40, 2.25, 0.0, 27.15, 30.65, adsk.fusion.FeatureOperations.JoinFeatureOperation, "Rear_West_Gland")
        pts_cr = wing_spine_points(-1.0, -58.0, n_arc=13, with_tuck=False)[1:]
        b_cr_tool = sweep_band_new_body(c_sr, pts_cr, 8.0, -0.45, 2.50, 0.0, "ChanR_Tool")
        b_tr_tun_b = extrude_z_poly(c_sr, rear_tunnel_strap_poly, 27.20, 27.90, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "TunnelR_B_Tool").bodies.item(0)
        b_tr_tun_c = sweep_band_new_body(c_sr, rear_sbend_yz[:4], 2.5, -0.34, 0.34, 0.0, "TunnelR_C_Tool", x_mm=-9.65)
        combine_bodies(c_sr, b_sr, [b_cr_tool, b_tr_tun_b, b_tr_tun_c], adsk.fusion.FeatureOperations.CutFeatureOperation, "Cut_ChanR_And_Tunnel")
        assign_appearance(c_sr, apps, "CM_Charcoal_LSR_Silicone")

        # ---------------- 11 & 12: 前/后双翼乳白雾面导光条 (300° 腕带发光光环!) ----------------
        step = "11_LightGuide_Front"
        occ_lgf, c_lgf = new_subcomp(root, "11_LightGuide_Front_Diffuser")
        occs["lg_f"] = occ_lgf
        pts_lgf = wing_spine_points(+1.0, -57.2, n_arc=13, with_tuck=False)[1:]
        sweep_band_new_body(c_lgf, pts_lgf, 7.6, 0.70, 2.05, 0.50, "LGF")
        assign_appearance(c_lgf, apps, "CM_Glow_Mouse_Green")

        step = "12_LightGuide_Rear"
        occ_lgr, c_lgr = new_subcomp(root, "12_LightGuide_Rear_Diffuser")
        occs["lg_r"] = occ_lgr
        pts_lgr = wing_spine_points(-1.0, -57.2, n_arc=13, with_tuck=False)[1:]
        sweep_band_new_body(c_lgr, pts_lgr, 7.6, 0.70, 2.05, 0.50, "LGR")
        assign_appearance(c_lgr, apps, "CM_Glow_Mouse_Green")

        # ---------------- 13_LED_FPC_12xWS2812B (双翼灯带 + 方案 A 进仓排线直插 ZIF!) ----------------
        step = "13_LED_FPC_12xWS2812B"
        occ_fpc, c_fpc = new_subcomp(root, "13_LED_FPC_12xWS2812B")
        occs["fpc"] = occ_fpc
        sweep_band_new_body(c_fpc, pts_lgf, 4.5, -0.31, -0.15, 0.0, "FPCF_Wing")
        sweep_band_new_body(c_fpc, fpc_front_tail_yz, 2.2, -0.08, 0.08, 0.0, "FPCF_Tail_To_ZIF", x_mm=0.0)
        sweep_band_new_body(c_fpc, pts_lgr, 4.5, -0.31, -0.15, 0.0, "FPCR_Wing")
        extrude_z_poly(c_fpc, rear_dogleg_strap_poly, 27.47, 27.63, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "FPCR_Strap_Dogleg")
        sweep_band_new_body(c_fpc, rear_sbend_yz, 2.0, -0.08, 0.08, 0.0, "FPCR_West_SBend", x_mm=-9.65)
        extrude_z_poly(c_fpc, rear_dogleg_pod_poly, 31.07, 31.23, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "FPCR_Pod_To_ZIF")
        assign_appearance(c_fpc, apps, "CM_Amber_LED_FPC")

        # ---------------- 14_Tang_Buckle_Aluminum ----------------
        step = "14_Tang_Buckle_Aluminum"
        occ_bk, c_bk = new_subcomp(root, "14_Tang_Buckle_Aluminum")
        occs["buckle"] = occ_bk
        p_bk = offset_plane_xy(c_bk, -33.25, "_Pln_Buckle")
        sk_bk = c_bk.sketches.add(p_bk)
        sk_bk.isLightBulbOn = False
        draw_rounded_rect_xy(sk_bk, 0.0, 0.0, 26.2, 9.6, 2.0)
        draw_rounded_rect_xy(sk_bk, 0.0, 0.0, 23.2, 5.2, 1.0)
        extrude_one_side(c_bk, ring_profile(sk_bk), 7.00, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, positive=_dir_positive(p_bk, 0.0, 0.0, 1.0), name="Buckle_Frame")
        assign_appearance(c_bk, apps, "CM_Anodized_SpaceGrey")

        # ---------------- 15_Silicone_Keeper_Loop ----------------
        step = "15_Silicone_Keeper_Loop"
        occ_kp, c_kp = new_subcomp(root, "15_Silicone_Keeper_Loop")
        occs["keeper"] = occ_kp
        p_kp = offset_plane_xy(c_kp, -31.8, "_Pln_Keeper")
        sk_kp = c_kp.sketches.add(p_kp)
        sk_kp.isLightBulbOn = False
        draw_rounded_rect_xy(sk_kp, 0.0, 14.2, 25.8, 6.2, 1.8)
        draw_rounded_rect_xy(sk_kp, 0.0, 14.2, 23.2, 3.8, 0.9)
        extrude_one_side(c_kp, ring_profile(sk_kp), 10.6, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, positive=_dir_positive(p_kp, 0.0, 0.0, 1.0), name="Keeper_Ring")
        assign_appearance(c_kp, apps, "CM_Charcoal_LSR_Silicone")

        # ---------------- 16_ZIF_Connectors_4Pin (高对比白色 4-Pin ZIF 翻盖座 + NFC 弹片座!) ----------------
        step = "16_ZIF_Connectors_4Pin"
        occ_zif, c_zif = new_subcomp(root, "16_ZIF_Connectors_4Pin")
        occs["zif"] = occ_zif
        # 1. J_LED_F (+Y 开口直迎前翼 FPC)
        b_jf = extrude_z_rect(c_zif, 0.0, 14.6, 5.4, 3.2, 0.0, 30.67, 31.82, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "J_LED_F_Body").bodies.item(0)
        extrude_z_rect(c_zif, 0.0, 13.45, 4.4, 0.85, 0.0, 31.80, 32.12, adsk.fusion.FeatureOperations.JoinFeatureOperation, "J_LED_F_FlipLock")
        for tag_e, sx in (("L", -2.90), ("R", 2.90)):
            extrude_z_rect(c_zif, sx, 14.2, 0.60, 1.6, 0.0, 30.67, 31.17, adsk.fusion.FeatureOperations.JoinFeatureOperation, f"J_LED_F_Ear_{tag_e}")
        extrude_z_rect(c_zif, 0.0, 15.325, 2.80, 1.85, 0.0, 30.91, 31.39, adsk.fusion.FeatureOperations.CutFeatureOperation, "J_LED_F_Slot", [b_jf])
        # 2. J_LED_R (-Y 开口直迎西侧绕行后翼 FPC)
        b_jr = extrude_z_rect(c_zif, -11.2, -5.8, 4.6, 3.2, 0.0, 30.67, 31.82, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "J_LED_R_Body").bodies.item(0)
        extrude_z_rect(c_zif, -11.2, -4.65, 3.8, 0.85, 0.0, 31.80, 32.12, adsk.fusion.FeatureOperations.JoinFeatureOperation, "J_LED_R_FlipLock")
        for tag_e, sx in (("L", -13.70), ("R", -8.70)):
            extrude_z_rect(c_zif, sx, -5.4, 0.60, 1.6, 0.0, 30.67, 31.17, adsk.fusion.FeatureOperations.JoinFeatureOperation, f"J_LED_R_Ear_{tag_e}")
        extrude_z_rect(c_zif, -11.2, -6.525, 2.80, 1.85, 0.0, 30.91, 31.39, adsk.fusion.FeatureOperations.CutFeatureOperation, "J_LED_R_Slot", [b_jr])
        # 3. J_NFC_SPRING (13.56MHz 双弹片接触底座)
        extrude_z_rect(c_zif, -6.8, 11.4, 4.2, 2.4, 0.0, 30.67, 31.11, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, "J_NFC_Spring_Base")
        for tag_p, dx in (("L", -1.0), ("R", 1.0)):
            extrude_z_rect(c_zif, -6.8 + dx, 11.4, 0.90, 1.50, 0.0, 31.08, 31.32, adsk.fusion.FeatureOperations.JoinFeatureOperation, f"J_NFC_Contact_{tag_p}")
        assign_appearance(c_zif, apps, "CM_ZIF_Ivory_LCP")

        # ---------------- 2. 刚性装配组 + 右侧按键滑移运动副 ----------------
        step = "joints"
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
            lim.minimumValue = -0.045
            lim.isMaximumValueEnabled = True
            lim.maximumValue = 0.0
        except Exception:
            pass

        # ---------------- 3. 调整视角并导出 .f3d 存档 ----------------
        step = "export_f3d"
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
            "mode": "100% Native Parametric Fusion 360 Feature Tree (v3 - Plan A Internal FPC/ZIF/T-Anchor)",
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
            f"- 特征树：16 个独立组件（含方案 A 前/后翼内埋 FPC 排线尾带、白色开槽 ZIF 翻盖座、双端 T 型防水锚块与 NFC 下弯弹片）\n"
            f"- 提示：在左侧浏览器关闭 01_Top_Shell_NFC (眼睛图标)，即可直接透视内部 FPC→ZIF 插接结构！\n"
            f"- 用户参数 (fx)：{param_count} 个\n"
            f"- 外观色板：{len(apps)} 种（按 A 键可拖拽红猫/绿鼠/蓝求救导光环一键换色）\n"
            f"- 实时运动副：{joint_name} (0..0.45 mm)\n"
            f"- 已自动导出 .f3d：{F3D_PATH}",
            "CatMouse Band V1.5 — Fusion 360",
        )
    except Exception:
        if ui:
            ui.messageBox(f"CatMouse Band V1.5 在步骤 [{step}] 异常:\n" + traceback.format_exc())
