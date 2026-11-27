"""
CatMouse Band V1.5-Lite ("Velcro 魔术贴简版") — 4 视角高清 3D CAD 工程评审图生成器
直接复用 render_cad_views.py 的纯 NumPy Z-Buffer + Bloom 渲染引擎，输出：
  - cad/renders/cad_velcro_01_overview.png (轴测实模 / 右侧轮廓 / 底部魔术贴微距特写 / X=0 纵剖叠层)
"""
from __future__ import annotations

import json
import pathlib
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import trimesh

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import render_cad_views as rc  # noqa: E402

ROOT = rc.ROOT
CAD_OUT = rc.CAD_OUT
PARTS_DIR = CAD_OUT / "parts_velcro"
RENDER_DIR = rc.RENDER_DIR


def load_velcro_meshes(glow_rgb=(0.08, 0.96, 0.50), clip_x_positive: bool = False) -> list[rc.MeshItem]:
    report = json.loads((CAD_OUT / "cad_velcro_verification_report.json").read_text(encoding="utf-8"))
    items = []
    for pm in report["parts"]:
        stl_path = PARTS_DIR / f"{pm['id']}_{pm['name']}.stl"
        m = trimesh.load(str(stl_path), force="mesh")
        verts = np.asarray(m.vertices, dtype=np.float32)
        faces = np.asarray(m.faces, dtype=np.int32)
        if clip_x_positive:
            verts, faces = rc.clip_mesh_x_le_zero(verts, faces)
        if len(faces) == 0:
            continue
        v0, v1, v2 = verts[faces[:, 0]], verts[faces[:, 1]], verts[faces[:, 2]]
        fn = np.cross(v1 - v0, v2 - v0)
        fn = fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-8)

        rgba = tuple(pm["rgba"])
        emissive, metallic, roughness = 0.0, 0.08, 0.55
        if "LightGuide" in pm["name"]:
            rgba = (*glow_rgb, 1.0)
            emissive, roughness = 0.72, 0.30
        elif "Pogo" in pm["name"] or "NFC" in pm["name"]:
            metallic, roughness = 0.75, 0.25
        elif "Motor" in pm["name"] or "Battery" in pm["name"]:
            metallic, roughness = 0.55, 0.35
        elif "LED_FPC" in pm["name"]:
            emissive, metallic, roughness = 0.22, 0.35, 0.32
        elif "ZIF_Connectors" in pm["name"]:
            emissive, metallic, roughness = 0.06, 0.12, 0.35
        elif "Velcro" in pm["name"]:
            metallic, roughness = 0.02, 0.85

        items.append(
            rc.MeshItem(
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


def main():
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    rep = json.loads((CAD_OUT / "cad_velcro_verification_report.json").read_text(encoding="utf-8"))
    mass_g = rep["total_estimated_mass_g"]

    print("[VELCRO RENDER 1/4] 渲染魔术贴简版 3/4 实模视图...")
    meshes_green = load_velcro_meshes(glow_rgb=(0.08, 0.96, 0.50))
    im_iso, _ = rc.render_scene_zbuf(
        meshes_green, 860, 680,
        eye=(95.0, 78.0, 42.0), target=(0.0, 0.0, 1.0),
        ortho_scale=88.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(228, 234, 243),
    )

    print("[VELCRO RENDER 2/4] 渲染右侧全景视图（300° 光环 + 底部魔术贴搭接）...")
    im_side, _ = rc.render_scene_zbuf(
        meshes_green, 860, 680,
        eye=(150.0, 0.0, 2.0), target=(0.0, 0.0, 2.0),
        ortho_scale=84.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(228, 234, 243),
    )

    print("[VELCRO RENDER 3/4] 渲染底部魔术贴直接搭接特写...")
    im_velcro, _ = rc.render_scene_zbuf(
        meshes_green, 860, 680,
        eye=(82.0, 28.0, -48.0), target=(0.0, 4.0, -27.5),
        ortho_scale=42.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(228, 234, 243),
    )

    print("[VELCRO RENDER 4/4] 渲染 X=0 纵剖叠层视图（上部方案A FPC→ZIF + 底部魔术贴零干涉叠层）...")
    meshes_sec = load_velcro_meshes(glow_rgb=(0.08, 0.96, 0.50), clip_x_positive=True)
    im_sec, _ = rc.render_scene_zbuf(
        meshes_sec, 860, 680,
        eye=(145.0, 0.0, 2.0), target=(0.0, 0.0, 2.0),
        ortho_scale=82.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(228, 234, 243),
    )

    fig, axes = plt.subplots(2, 2, figsize=(16.0, 12.2), dpi=140)
    fig.patch.set_facecolor("#F4F7FC")
    panels = [
        (im_iso, "① 轴测实模 · 保留无屏 NFC 主机 + 300° 发光腕带，极简零金属表扣"),
        (im_side, "② 右侧轮廓 · 前/后导光环止于 -57°，底部纯魔术贴搭接（0 冲孔/0 表扣）"),
        (im_velcro, "③ 底部魔术贴特写 · 18mm 背胶毛面(蓝灰) + 刺面(暖褐) + 末端微翘易撕拉手"),
        (im_sec, "④ X=0 纵剖校验 · 上部方案 A FPC→ZIF 保持一致，底部魔术贴搭接 0 碰撞"),
    ]
    for ax, (im, title) in zip(axes.flat, panels):
        ax.imshow(im)
        ax.set_title(title, fontsize=11.0, fontweight="bold", color="#0F172A", pad=6)
        ax.axis("off")

    fig.suptitle(
        f"CatMouse Band V1.5-Lite (EVT 魔术贴简版) — 16 零件 B-Rep 实模 | 整机 {mass_g:.2f} g | 0.000 mm³ 碰撞干涉",
        fontsize=14.0, fontweight="bold", color="#0F172A", y=0.98,
    )
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    out_p = RENDER_DIR / "cad_velcro_01_overview.png"
    fig.savefig(out_p, facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"[PASS] 魔术贴简版 4 视角评审图已导出至: {out_p}")


if __name__ == "__main__":
    main()
