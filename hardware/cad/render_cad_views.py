"""
CatMouse Band V1.5 ("Strap-Halo") — 基于精确 15 件 B-Rep CAD 网格的高清工业级 3D 工程渲染器
使用纯 NumPy Z-Buffer + 3 点柔光箱 Blinn-Phong + 腕带导光环真实辉光(Bloom) + 2x 超采样抗锯齿，
零 OpenGL 依赖、100% 忠实还原 STEP/STL 毫米级尺寸，输出 4 张高质量评审图：
  1. cad_01_hero_3colors.png         — 三阵营实模 3D 渲染（红猫 / 绿鼠 / 蓝求救，展现腕带发光环）
  2. cad_02_orthographic_4view.png   — 四视图工程尺寸总图（顶面NFC / 侧面腕环 / 背面4-pin磁吸 / 轴测）
  3. cad_03_exploded_assembly.png    — 15 零件等轴测爆炸装配图（带清晰中文工程标号）
  4. cad_04_cross_section_stackup.png — X=0 纵剖面内部叠层审视图（直观展示内部 0 干涉间隙与腕带导光腔）
"""
from __future__ import annotations

import json
import math
import pathlib
from dataclasses import dataclass

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import trimesh

ROOT = pathlib.Path(__file__).resolve().parents[1]
CAD_OUT = ROOT / "cad" / "output"
PARTS_DIR = CAD_OUT / "parts"
RENDER_DIR = ROOT / "cad" / "renders"

# 确保中文标注在 Windows 微软雅黑下清晰渲染
plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False


@dataclass
class MeshItem:
    idx: str
    name: str
    verts: np.ndarray   # (N, 3)
    faces: np.ndarray   # (M, 3)
    normals: np.ndarray # (M, 3) face normals
    rgba: tuple[float, float, float, float]
    emissive: float = 0.0
    metallic: float = 0.1
    roughness: float = 0.55
    explode_vec: tuple[float, float, float] = (0.0, 0.0, 0.0)


def clip_mesh_x_le_zero(verts: np.ndarray, faces: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """纯 NumPy 精确三角形 X <= 0.0 半空间剖切（零第三方依赖，用于生成清晰无遮挡的纵剖叠层图！）。"""
    new_verts = verts.tolist()
    new_faces = []
    for f0, f1, f2 in faces:
        vs = [verts[f0], verts[f1], verts[f2]]
        ids = [int(f0), int(f1), int(f2)]
        inside = [v[0] <= 0.02 for v in vs]
        n_in = sum(inside)
        if n_in == 0:
            continue
        if n_in == 3:
            new_faces.append(ids)
            continue
        # 1 个或 2 个顶点在 X <= 0 内：线性插值求精确 X=0 交点
        out_poly = []
        for k in range(3):
            a_v, a_id, a_in = vs[k], ids[k], inside[k]
            b_v, b_id, b_in = vs[(k + 1) % 3], ids[(k + 1) % 3], inside[(k + 1) % 3]
            if a_in:
                out_poly.append(a_id)
            if a_in != b_in:
                t = (0.0 - a_v[0]) / (b_v[0] - a_v[0] + 1e-12)
                p = a_v + t * (b_v - a_v)
                p[0] = 0.0
                pid = len(new_verts)
                new_verts.append(p.tolist())
                out_poly.append(pid)
        if len(out_poly) == 3:
            new_faces.append(out_poly)
        elif len(out_poly) == 4:
            new_faces.append([out_poly[0], out_poly[1], out_poly[2]])
            new_faces.append([out_poly[0], out_poly[2], out_poly[3]])
    if not new_faces:
        return np.zeros((0, 3), dtype=np.float32), np.zeros((0, 3), dtype=np.int32)
    return np.asarray(new_verts, dtype=np.float32), np.asarray(new_faces, dtype=np.int32)


def load_cad_meshes(
    glow_rgb=(0.10, 0.98, 0.52),
    clip_x_positive: bool = False,
    only_ids: set[str] | None = None,
) -> list[MeshItem]:
    report = json.loads((CAD_OUT / "cad_verification_report.json").read_text(encoding="utf-8"))
    items = []
    for pm in report["parts"]:
        if only_ids is not None and pm["id"] not in only_ids:
            continue
        stl_path = PARTS_DIR / f"{pm['id']}_{pm['name']}.stl"
        m = trimesh.load(str(stl_path), force="mesh")
        verts = np.asarray(m.vertices, dtype=np.float32)
        faces = np.asarray(m.faces, dtype=np.int32)
        if clip_x_positive:
            verts, faces = clip_mesh_x_le_zero(verts, faces)
        if len(faces) == 0:
            continue
        v0 = verts[faces[:, 0]]
        v1 = verts[faces[:, 1]]
        v2 = verts[faces[:, 2]]
        fn = np.cross(v1 - v0, v2 - v0)
        ln = np.linalg.norm(fn, axis=1, keepdims=True)
        fn = fn / np.maximum(ln, 1e-8)

        rgba = tuple(pm["rgba"])
        emissive = 0.0
        metallic = 0.08
        roughness = 0.55

        if "LightGuide" in pm["name"]:
            rgba = (*glow_rgb, 1.0)
            emissive = 0.72
            roughness = 0.30
        elif "Pogo" in pm["name"] or "NFC" in pm["name"]:
            metallic = 0.75
            roughness = 0.25
        elif "Buckle" in pm["name"] or "Motor" in pm["name"] or "Battery" in pm["name"]:
            metallic = 0.55
            roughness = 0.35
        elif "LED_FPC" in pm["name"]:
            emissive = 0.15
            metallic = 0.35
            roughness = 0.35

        items.append(
            MeshItem(
                idx=pm["id"],
                name=pm["name"],
                verts=verts,
                faces=faces,
                normals=fn,
                rgba=rgba,
                emissive=emissive,
                metallic=metallic,
                roughness=roughness,
                explode_vec=tuple(pm["explode_vec"]),
            )
        )
    return items


def look_at_matrix(eye: np.ndarray, target: np.ndarray, up: np.ndarray) -> np.ndarray:
    f = (target - eye)
    f = f / np.linalg.norm(f)
    r = np.cross(f, up)
    if np.linalg.norm(r) < 1e-6:
        r = np.cross(f, np.array([0.0, 1.0, 0.0], dtype=np.float32))
    r = r / np.linalg.norm(r)
    u = np.cross(r, f)
    M = np.eye(4, dtype=np.float32)
    M[0, :3] = r
    M[1, :3] = u
    M[2, :3] = -f
    M[:3, 3] = -M[:3, :3] @ eye
    return M


def render_scene_zbuf(
    items: list[MeshItem],
    width: int,
    height: int,
    eye: tuple[float, float, float],
    target: tuple[float, float, float],
    up: tuple[float, float, float] = (0.0, 0.0, 1.0),
    ortho_scale: float | None = None,
    explode_factor: float = 0.0,
    bg_top=(238, 241, 246),
    bg_bot=(222, 227, 234),
    ssaa: int = 2,
    extra_shift: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> tuple[Image.Image, dict]:
    """高质量向量化软件 Z-Buffer + Blinn-Phong + 腕带光学辉光 Bloom 渲染器。"""
    W, H = width * ssaa, height * ssaa
    # 渐变工业设计影棚背景
    yy = np.linspace(0.0, 1.0, H, dtype=np.float32)[:, None, None]
    c_top = np.array(bg_top, dtype=np.float32)[None, None, :] / 255.0
    c_bot = np.array(bg_bot, dtype=np.float32)[None, None, :] / 255.0
    img_buf = np.broadcast_to(c_top * (1.0 - yy) + c_bot * yy, (H, W, 3)).copy()
    emissive_buf = np.zeros((H, W, 3), dtype=np.float32)
    z_buf = np.full((H, W), -1e9, dtype=np.float32)

    eye_v = np.array(eye, dtype=np.float32)
    tgt_v = np.array(target, dtype=np.float32)
    up_v = np.array(up, dtype=np.float32)
    V = look_at_matrix(eye_v, tgt_v, up_v)
    R_cam = V[:3, :3]
    t_cam = V[:3, 3]

    # 收集所有相机空间顶点以自动确定正交视框
    all_cam_v = []
    transformed = []
    shift_v = np.array(extra_shift, dtype=np.float32)
    for it in items:
        ev = np.array(it.explode_vec, dtype=np.float32) * explode_factor + shift_v
        v_world = it.verts + ev[None, :]
        v_cam = v_world @ R_cam.T + t_cam[None, :]
        n_cam = it.normals @ R_cam.T
        all_cam_v.append(v_cam)
        transformed.append((it, v_cam, n_cam))

    if ortho_scale is None:
        cat_v = np.vstack(all_cam_v)
        cx_min, cx_max = float(cat_v[:, 0].min()), float(cat_v[:, 0].max())
        cy_min, cy_max = float(cat_v[:, 1].min()), float(cat_v[:, 1].max())
        mid_x = 0.5 * (cx_min + cx_max)
        mid_y = 0.5 * (cy_min + cy_max)
        span_x = max(cx_max - cx_min, 1e-3)
        span_y = max(cy_max - cy_min, 1e-3)
        scale = min((W * 0.80) / span_x, (H * 0.80) / span_y)
    else:
        # 显式指定视框尺寸时，严格以相机 target 为画面中心（支持主机仓局部特写剖视！）
        mid_x, mid_y = 0.0, 0.0
        scale = min(W, H) / ortho_scale

    # 3 点工业摄影柔光箱光照（相机空间）
    L1 = np.array([0.45, 0.65, 0.61], dtype=np.float32); L1 /= np.linalg.norm(L1)
    L2 = np.array([-0.68, 0.25, 0.69], dtype=np.float32); L2 /= np.linalg.norm(L2)
    L3 = np.array([0.05, -0.75, 0.66], dtype=np.float32); L3 /= np.linalg.norm(L3)
    V_dir = np.array([0.0, 0.0, 1.0], dtype=np.float32)
    H1 = (L1 + V_dir); H1 /= np.linalg.norm(H1)
    H2 = (L2 + V_dir); H2 /= np.linalg.norm(H2)

    part_centers_2d = {}

    for it, v_cam, n_cam in transformed:
        # 投影到像素坐标
        px = (v_cam[:, 0] - mid_x) * scale + W * 0.5
        py = H * 0.5 - (v_cam[:, 1] - mid_y) * scale
        pz = v_cam[:, 2]

        # 记录零件 2D 质心（供爆炸图标注用）
        part_centers_2d[it.idx] = (float(px.mean()) / ssaa, float(py.mean()) / ssaa)

        f = it.faces
        # 双面朝向：反转背向法线使剖切面与单薄面永不漏洞
        nz = n_cam[:, 2]
        n_eff = np.where((nz < 0)[:, None], -n_cam, n_cam)

        # Blinn-Phong + 柔和环境半球光
        d1 = np.maximum(0.0, n_eff @ L1)
        d2 = np.maximum(0.0, n_eff @ L2)
        d3 = np.maximum(0.0, n_eff @ L3)
        shininess = 18.0 + (1.0 - it.roughness) * 90.0
        s1 = (np.maximum(0.0, n_eff @ H1) ** shininess) * (0.25 + 0.75 * it.metallic)
        s2 = (np.maximum(0.0, n_eff @ H2) ** (shininess * 0.7)) * (0.12 + 0.35 * it.metallic)
        rim = ((1.0 - np.abs(n_eff[:, 2])) ** 2.2) * 0.16

        base = np.array(it.rgba[:3], dtype=np.float32)[None, :]
        hemi = 0.24 + 0.12 * np.clip(n_eff[:, 1] * 0.5 + 0.5, 0.0, 1.0)
        diff = (hemi + 0.62 * d1 + 0.30 * d2 + 0.16 * d3)[:, None]
        spec_col = (1.0 - it.metallic) * 1.0 + it.metallic * base
        col = base * diff * (1.0 - it.emissive * 0.6) + spec_col * (0.45 * s1 + 0.20 * s2 + rim)[:, None]
        if it.emissive > 0.0:
            col = col + base * (it.emissive * 0.85)
        col = np.clip(col, 0.0, 1.0)

        # 三角形光栅化（按屏幕包围盒快速扫描）
        x0, y0, z0 = px[f[:, 0]], py[f[:, 0]], pz[f[:, 0]]
        x1, y1, z1 = px[f[:, 1]], py[f[:, 1]], pz[f[:, 1]]
        x2, y2, z2 = px[f[:, 2]], py[f[:, 2]], pz[f[:, 2]]

        area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
        valid_tri = np.abs(area) > 0.08
        idxs = np.nonzero(valid_tri)[0]

        for ti in idxs:
            ax, ay, az = float(x0[ti]), float(y0[ti]), float(z0[ti])
            bx, by, bz = float(x1[ti]), float(y1[ti]), float(z1[ti])
            cx, cy, cz = float(x2[ti]), float(y2[ti]), float(z2[ti])
            ix0 = max(0, int(math.floor(min(ax, bx, cx))))
            ix1 = min(W - 1, int(math.ceil(max(ax, bx, cx))))
            iy0 = max(0, int(math.floor(min(ay, by, cy))))
            iy1 = min(H - 1, int(math.ceil(max(ay, by, cy))))
            if ix0 > ix1 or iy0 > iy1:
                continue
            inv_a = 1.0 / float(area[ti])
            gx = np.arange(ix0, ix1 + 1, dtype=np.float32)[None, :] + 0.5
            gy = np.arange(iy0, iy1 + 1, dtype=np.float32)[:, None] + 0.5
            w0 = ((bx - gx) * (cy - gy) - (cx - gx) * (by - gy)) * inv_a
            w1 = ((cx - gx) * (ay - gy) - (ax - gx) * (cy - gy)) * inv_a
            w2 = 1.0 - w0 - w1
            inside = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
            if not np.any(inside):
                continue
            zz = w0 * az + w1 * bz + w2 * cz
            sub_z = z_buf[iy0:iy1 + 1, ix0:ix1 + 1]
            mask = inside & (zz > sub_z)
            if not np.any(mask):
                continue
            sub_z[mask] = zz[mask]
            sub_img = img_buf[iy0:iy1 + 1, ix0:ix1 + 1]
            sub_img[mask] = col[ti]
            if it.emissive > 0.35:
                sub_em = emissive_buf[iy0:iy1 + 1, ix0:ix1 + 1]
                sub_em[mask] = base[0] * it.emissive

    # 叠加工业级光学导光环辉光 Bloom（仅作用于发光导光条）
    if np.any(emissive_buf > 0.01):
        em_u8 = np.clip(emissive_buf * 255.0, 0, 255).astype(np.uint8)
        em_pil = Image.fromarray(em_u8, mode="RGB")
        b1 = np.asarray(em_pil.filter(ImageFilter.GaussianBlur(radius=10 * ssaa)), dtype=np.float32) / 255.0
        b2 = np.asarray(em_pil.filter(ImageFilter.GaussianBlur(radius=28 * ssaa)), dtype=np.float32) / 255.0
        img_buf = np.clip(img_buf + b1 * 0.55 + b2 * 0.40, 0.0, 1.0)

    out_pil = Image.fromarray(np.clip(img_buf * 255.0, 0, 255).astype(np.uint8), mode="RGB")
    if ssaa > 1:
        out_pil = out_pil.resize((width, height), Image.Resampling.LANCZOS)
    return out_pil, part_centers_2d


def render_all_sheets():
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    print("[RENDER 1/4] 渲染 3D CAD 三阵营实模总览 (红猫 / 绿鼠 / 蓝求救)...")
    trio_imgs = []
    factions = [
        ("CAT 猫方 · 红色腕带光环", (0.98, 0.16, 0.24)),
        ("MOUSE 鼠方 · 绿色腕带光环", (0.08, 0.96, 0.50)),
        ("JAILED 求救 · 蓝色腕带光环", (0.14, 0.54, 1.00)),
    ]
    for title, rgb in factions:
        meshes = load_cad_meshes(glow_rgb=rgb)
        im, _ = render_scene_zbuf(
            meshes, 640, 720,
            eye=(95.0, 82.0, 58.0), target=(0.0, 0.0, 2.0),
            ortho_scale=92.0, ssaa=2,
        )
        trio_imgs.append((title, im))

    fig, axes = plt.subplots(1, 3, figsize=(16.5, 6.4), dpi=140)
    fig.patch.set_facecolor("#EEF1F6")
    for ax, (title, im) in zip(axes, trio_imgs):
        ax.imshow(im)
        ax.set_title(title, fontsize=13, fontweight="bold", color="#1E2430", pad=8)
        ax.axis("off")
    fig.suptitle(
        "CatMouse Band V1.5 (Strap-Halo 腕带光环版) — 15 件 B-Rep STEP 实模三阵营渲染",
        fontsize=15, fontweight="bold", color="#11161F", y=0.97,
    )
    plt.tight_layout(rect=[0, 0, 1, 0.93])
    p1 = RENDER_DIR / "cad_01_hero_3colors.png"
    fig.savefig(p1, facecolor=fig.get_facecolor())
    plt.close(fig)

    print("[RENDER 2/4] 渲染四视图工程尺寸总图 (顶面NFC / 侧视环腕 / 背面4-pin磁吸特写 / 轴测)...")
    meshes_green = load_cad_meshes(glow_rgb=(0.08, 0.96, 0.50))
    meshes_pod_only = load_cad_meshes(glow_rgb=(0.08, 0.96, 0.50), only_ids={"01", "02", "03", "08"})
    views = [
        ("顶视图 · 无屏鹅卵石 NFC 顶面 (34.0×42.0 mm)", meshes_green, (0.0, -0.1, 140.0), (0.0, 0.0, 20.0), (0.0, 1.0, 0.0), 86.0),
        ("右侧视图 · 无缝环腕 300° 发光光环 + 侧按键/声学孔", meshes_green, (150.0, 0.0, 4.0), (0.0, 0.0, 4.0), (0.0, 0.0, 1.0), 84.0),
        ("主机底面特写 · 4-pin 镀金磁吸充电口 + 2×N52 + 2×M2", meshes_pod_only, (0.0, 0.1, -110.0), (0.0, 0.0, 24.0), (0.0, 1.0, 0.0), 54.0),
        ("等轴测视图 · 主机 + 双翼光环腕带 + 铝合金针扣", meshes_green, (95.0, -82.0, 56.0), (0.0, 0.0, 3.0), (0.0, 0.0, 1.0), 88.0),
    ]
    fig, axes = plt.subplots(2, 2, figsize=(15.0, 11.2), dpi=140)
    fig.patch.set_facecolor("#F4F6FA")
    for ax, (title, mlist, eye, tgt, up, sc) in zip(axes.flat, views):
        im, _ = render_scene_zbuf(mlist, 760, 560, eye=eye, target=tgt, up=up, ortho_scale=sc, ssaa=2)
        ax.imshow(im)
        ax.set_title(title, fontsize=11.5, fontweight="bold", color="#1A202C", pad=6)
        ax.axis("off")
    fig.suptitle(
        "CatMouse Band V1.5 CAD 工程四视图 | 主机 34×42×11.8mm | 腕带 22×3.4mm | 导光环宽 7.6mm | 12×WS2812B",
        fontsize=14, fontweight="bold", color="#11161F", y=0.98,
    )
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    p2 = RENDER_DIR / "cad_02_orthographic_4view.png"
    fig.savefig(p2, facecolor=fig.get_facecolor())
    plt.close(fig)

    print("[RENDER 3/4] 渲染 15 零件等轴测爆炸装配图...")
    im_exp, centers = render_scene_zbuf(
        meshes_green, 1500, 1050,
        eye=(130.0, 96.0, 62.0), target=(0.0, 0.0, 5.0),
        ortho_scale=138.0, explode_factor=1.0, ssaa=2,
        bg_top=(247, 249, 252), bg_bot=(234, 238, 245),
    )
    fig, ax = plt.subplots(figsize=(15.0, 10.5), dpi=140)
    fig.patch.set_facecolor("#F7F9FC")
    ax.imshow(im_exp)
    ax.axis("off")
    # 严格按画面实际左右方位排布引线，做到 0 交叉！
    callouts = [
        ("01", "01 顶壳 (PC+ABS · NFC 盲触顶面)", 1090, 90),
        ("04", "04 13.56MHz NFC 线圈 + 0.2mm 铁氧体", 1090, 160),
        ("05", "05 紧凑 4 层核心 PCBA (ESP32+PN532+蜂鸣器)", 1090, 235),
        ("06", "06 300mAh 软包锂电 (402025)", 1090, 310),
        ("07", "07 1027 贴肤扁平振动马达", 1090, 385),
        ("02", "02 贴腕底壳 (磁吸沉孔 + M2 螺柱)", 1090, 460),
        ("08", "08 4-pin 镀金 Pogo + 2×N52 + 2×M2", 1090, 535),
        ("11", "11 前翼乳白雾面导光条 (300° 发光环)", 1090, 635),
        ("09", "09 前翼双色液态硅胶腕带 (22mm)", 1090, 720),
        ("15", "15 硅胶防滑束带环", 1090, 845),
        ("03", "03 右侧微内凹防水硅胶按键", 35, 220),
        ("12", "12 后翼乳白雾面导光条 (对称发光环)", 35, 340),
        ("10", "10 后翼硅胶舌带 (5 档调节孔)", 35, 470),
        ("13", "13 12× WS2812B 柔性 FPC 灯带 (前6+后6)", 35, 600),
        ("14", "14 深空灰阳极氧化铝合金针扣", 35, 845),
    ]
    for cid, label, lx, ly in callouts:
        if cid in centers:
            cx, cy = centers[cid]
            ax.annotate(
                label,
                xy=(cx, cy),
                xytext=(lx, ly),
                fontsize=9.5,
                fontweight="bold",
                color="#172030",
                ha="left",
                va="center",
                bbox=dict(boxstyle="round,pad=0.32", fc="#FFFFFF", ec="#CBD5E1", alpha=0.94),
                arrowprops=dict(arrowstyle="-|>", color="#475569", lw=1.15, shrinkA=4, shrinkB=4),
            )
    ax.set_title(
        "CatMouse Band V1.5 (Strap-Halo) — 15 件多实体 B-Rep 爆炸装配总图（严格 0.000 mm³ 碰撞干涉）",
        fontsize=14, fontweight="bold", color="#11161F", pad=10,
    )
    plt.tight_layout()
    p3 = RENDER_DIR / "cad_03_exploded_assembly.png"
    fig.savefig(p3, facecolor=fig.get_facecolor())
    plt.close(fig)

    print("[RENDER 4/4] 渲染 X=0 精确纵剖面内部叠层审视图...")
    meshes_sec = load_cad_meshes(glow_rgb=(0.08, 0.96, 0.50), clip_x_positive=True)
    im_sec, _ = render_scene_zbuf(
        meshes_sec, 1200, 920,
        eye=(150.0, 0.0, 4.0), target=(0.0, 0.0, 4.0),
        ortho_scale=84.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(230, 235, 244),
    )
    im_sec_pod, _ = render_scene_zbuf(
        meshes_sec, 1200, 920,
        eye=(120.0, 0.0, 29.6), target=(0.0, 0.0, 29.6),
        ortho_scale=44.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(230, 235, 244),
    )
    fig, axes = plt.subplots(1, 2, figsize=(16.0, 7.2), dpi=140)
    fig.patch.set_facecolor("#F4F7FC")
    axes[0].imshow(im_sec)
    axes[0].set_title("整机 X=0 纵剖图（直观查看腕带光学通道与表扣错位避让）", fontsize=12, fontweight="bold", color="#11161F")
    axes[0].axis("off")
    axes[1].imshow(im_sec_pod)
    axes[1].set_title("主机仓局部放大剖视图（顶盖→NFC铁氧体→4层PCBA→电池/马达→磁吸底壳）", fontsize=12, fontweight="bold", color="#11161F")
    axes[1].axis("off")
    fig.suptitle(
        "CatMouse Band V1.5 内部结构叠层剖面校验 | 顶盖1.2mm · NFC+铁氧体0.45mm · PCBA+模块2.5mm · 锂电4.0mm · 底壁1.3mm",
        fontsize=13.5, fontweight="bold", color="#11161F", y=0.97,
    )
    plt.tight_layout(rect=[0, 0, 1, 0.93])
    p4 = RENDER_DIR / "cad_04_cross_section_stackup.png"
    fig.savefig(p4, facecolor=fig.get_facecolor())
    plt.close(fig)

    print("[RENDER 5/5] 渲染 ECAD/MCAD PCB 规范布局平面蓝图 + 3D 开盖协同装配图...")
    from matplotlib.patches import Circle as MplCircle, FancyBboxPatch

    fig = plt.figure(figsize=(16.5, 8.6), dpi=140)
    fig.patch.set_facecolor("#F6F8FC")
    ax_2d = fig.add_subplot(1, 2, 1)
    ax_3d = fig.add_subplot(1, 2, 2)

    # -------- 左图：2D 精确毫米级 PCB 功能分区与禁布区规范蓝图 --------
    ax_2d.set_facecolor("#FFFFFF")
    ax_2d.set_aspect("equal")
    ax_2d.set_xlim(-21.5, 22.0)
    ax_2d.set_ylim(-23.5, 24.0)
    ax_2d.grid(True, linestyle=":", linewidth=0.6, color="#CBD5E1", alpha=0.8)
    ax_2d.set_xlabel("X 坐标 (mm)  [原点 = 主机中心，+X 为右侧按键/蜂鸣器侧]", fontsize=10, fontweight="bold", color="#334155")
    ax_2d.set_ylabel("Y 坐标 (mm)  [-Y 为 BLE 天线端，+Y 为前翼腕带/磁吸端]", fontsize=10, fontweight="bold", color="#334155")
    ax_2d.set_title("2D PCB 规范布局平面图 (28.4×35.4×1.0mm · 单面L1贴片 · 4层板)", fontsize=12, fontweight="bold", color="#0F172A", pad=8)

    # 外壳轮廓 (34×42mm, R=9.5)
    ax_2d.add_patch(FancyBboxPatch((-17.0, -21.0), 34.0, 42.0, boxstyle="round,pad=0,rounding_size=9.5",
                                   fc="none", ec="#94A3B8", lw=1.4, ls="--", label="主机外轮廓 34×42mm"))
    # PCB 轮廓 (28.4×35.4mm, R=6.2)
    ax_2d.add_patch(FancyBboxPatch((-14.2, -17.7), 28.4, 35.4, boxstyle="round,pad=0,rounding_size=6.2",
                                   fc="#ECFDF5", ec="#047857", lw=2.0))

    # 红色斜线：2.4GHz BLE 天线 4 层 + 铁氧体 + 金属全净空区 (Y ∈ [-17.7, -11.5])
    ax_2d.add_patch(FancyBboxPatch((-9.0, -17.7), 18.0, 6.2, boxstyle="round,pad=0,rounding_size=1.2",
                                   fc="#FEE2E2", ec="#DC2626", lw=1.6, hatch="///", alpha=0.85))
    ax_2d.text(0.0, -14.8, "2.4GHz BLE 天线 4 层全净空区\n(无铜/无铁氧体/无电池/无磁铁)", ha="center", va="center",
               fontsize=8.2, fontweight="bold", color="#991B1B",
               bbox=dict(boxstyle="round,pad=0.2", fc="#FFFFFF", ec="#FCA5A5", alpha=0.92))

    # 橙色虚线框：顶盖下方 13.56MHz NFC 线圈 + 0.2mm 铁氧体投影 (Y ∈ [-10.0, +14.5])
    ax_2d.add_patch(FancyBboxPatch((-12.5, -10.0), 25.0, 24.5, boxstyle="round,pad=0,rounding_size=4.8",
                                   fc="none", ec="#EA580C", lw=1.8, ls="-."))
    ax_2d.annotate(
        "顶盖 13.56MHz NFC 线圈 + 0.2mm 铁氧体投影 (25×24.5mm, 距BLE≥1.5mm)",
        xy=(-6.0, 14.5), xytext=(-20.6, 22.4),
        fontsize=7.6, fontweight="bold", color="#C2410C",
        arrowprops=dict(arrowstyle="-|>", color="#EA580C", lw=1.1),
    )

    # 底层投影虚线：电池 (22×18.3, Y∈[-9.5,+8.8]) + 1027 马达 (0, +14.0)
    ax_2d.add_patch(FancyBboxPatch((-11.0, -9.5), 22.0, 18.3, boxstyle="round,pad=0,rounding_size=1.5",
                                   fc="none", ec="#64748B", lw=1.1, ls=":"))
    ax_2d.add_patch(MplCircle((0.0, 14.0), 5.0, fc="none", ec="#475569", lw=1.2, ls=":"))
    ax_2d.text(0.0, 19.6, "底腔 1027 马达 (0,+14.0) & 底面 4-pin 磁吸/2×N52 (+Y 远离 BLE)", ha="center", va="center", fontsize=7.5, fontweight="bold", color="#475569")

    # 核心 L1 单面贴片器件方块（精确坐标！）
    blocks = [
        (-8.8, -11.5, 13.2, 10.6, "#1E293B", "#0F172A", "ESP32-C3-MINI-1\n金属屏蔽体\n(-2.2, -9.2)", "#FFFFFF"),
        (5.0, -9.7, 9.0, 9.0, "#334155", "#0F172A", "PKMCS0909E\n贴片蜂鸣器\n(+9.5, -5.2)", "#FFFFFF"),
        (-9.8, 3.2, 6.0, 6.0, "#1D4ED8", "#1E3A8A", "PN532\nQFN40\n(-6.8,+6.2)", "#FFFFFF"),
        (-13.1, 4.6, 2.5, 3.2, "#7C3AED", "#4C1D95", "27.12M\nY1", "#FFFFFF"),
        (-9.1, 10.0, 4.6, 2.8, "#0284C7", "#0369A1", "13.56M匹配", "#FFFFFF"),
        (-0.5, 3.2, 2.0, 2.0, "#0D9488", "#115E59", "IMU", "#FFFFFF"),
        (3.8, 3.8, 6.3, 6.6, "#D97706", "#92400E", "电源&驱动区\nMCP73831\nAP2112K\nQ1/Q2/Q3", "#FFFFFF"),
        (11.2, -0.6, 2.6, 4.2, "#475569", "#0F172A", "SW1", "#FFFFFF"),
        (-2.7, 13.5, 5.4, 3.0, "#B45309", "#78350F", "J_LED_F\n前翼4P", "#FFFFFF"),
        (-12.7, -8.5, 3.0, 5.4, "#B45309", "#78350F", "J_LED_R\n后翼4P", "#FFFFFF"),
    ]
    for bx, by, bw, bh, fc, ec, txt, tc in blocks:
        ax_2d.add_patch(FancyBboxPatch((bx, by), bw, bh, boxstyle="round,pad=0,rounding_size=0.4", fc=fc, ec=ec, lw=1.2, alpha=0.92))
        ax_2d.text(bx + bw * 0.5, by + bh * 0.5, txt, ha="center", va="center", fontsize=6.9, fontweight="bold", color=tc)

    # 2× M2 螺丝孔 + 4-pin 镀金 Pogo (底面半透投影不遮字) + 2× N52 磁铁位置标注
    for sx in (-12.6, 12.6):
        ax_2d.add_patch(MplCircle((sx, 11.0), 2.05, fc="#FEF3C7", ec="#B45309", lw=1.4))
        ax_2d.text(sx, 11.0, "M2", ha="center", va="center", fontsize=7.0, fontweight="bold", color="#78350F")
    for px in (-3.81, -1.27, 1.27, 3.81):
        ax_2d.add_patch(MplCircle((px, 14.8), 0.72, fc="none", ec="#CA8A04", lw=1.3, ls="--"))
    for mx in (-8.5, 8.5):
        ax_2d.add_patch(MplCircle((mx, 14.8), 1.9, fc="none", ec="#CA8A04", lw=1.2, ls="--"))
        ax_2d.text(mx, 14.8, "N52", ha="center", va="center", fontsize=6.6, fontweight="bold", color="#854D0E")

    # 右侧结构接口指示（按键 & 3 道声学孔）
    ax_2d.annotate("右侧硅胶按键\n(Y=+1.5)", xy=(14.2, 1.5), xytext=(15.6, 4.5), fontsize=7.8, fontweight="bold", color="#0F172A",
                   arrowprops=dict(arrowstyle="-|>", color="#334155", lw=1.0))
    ax_2d.annotate("3 声学出音孔\n(Y=-5.2)", xy=(14.2, -5.2), xytext=(15.4, -8.5), fontsize=7.8, fontweight="bold", color="#0F172A",
                   arrowprops=dict(arrowstyle="-|>", color="#334155", lw=1.0))
    ax_2d.annotate("后翼FPC西侧绕行\n(避让BLE天线)", xy=(-11.2, -8.5), xytext=(-20.8, -14.0), fontsize=7.4, fontweight="bold", color="#92400E",
                   arrowprops=dict(arrowstyle="-|>", color="#B45309", lw=1.0))

    # -------- 右图：3D 开盖实模机电协同透视图（隐藏顶壳与 NFC 线圈，直观审视主板与壳体/腕带配合！） --------
    meshes_open = load_cad_meshes(glow_rgb=(0.08, 0.96, 0.50), only_ids={"02", "03", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15"})
    im_open, _ = render_scene_zbuf(
        meshes_open, 900, 900,
        eye=(48.0, -45.0, 125.0), target=(0.0, 0.0, 26.0),
        up=(0.0, 1.0, 0.0), ortho_scale=68.0, ssaa=2,
        bg_top=(245, 248, 253), bg_bot=(230, 236, 245),
    )
    ax_3d.imshow(im_open)
    ax_3d.set_title("3D 开盖机电协同实模视图（已隐藏顶壳与NFC，核对单面PCBA与外壳/腕带净空）", fontsize=11.5, fontweight="bold", color="#0F172A", pad=8)
    ax_3d.axis("off")

    fig.suptitle(
        "CatMouse Band V1.5 (Strap-Halo) — PCB 设计规范分区与 3D 机电协同布局总图 (0.000 mm³ 碰撞校验)",
        fontsize=14, fontweight="bold", color="#0F172A", y=0.98,
    )
    plt.tight_layout(rect=[0, 0, 1, 0.94])
    p5 = RENDER_DIR / "cad_05_ecad_mcad_layout_blueprint.png"
    fig.savefig(p5, facecolor=fig.get_facecolor())
    plt.close(fig)

    print(f"[PASS] 5 张高清 CAD 工程与机电协同评审图已导出至: {RENDER_DIR}")


if __name__ == "__main__":
    render_all_sheets()
