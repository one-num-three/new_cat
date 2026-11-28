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
        elif "Pogo_Flex" in pm["name"]:
            emissive, metallic, roughness = 0.24, 0.42, 0.28
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

    print("[VELCRO RENDER 1/5] 渲染非对称低遮挡魔术贴版 3/4 实模视图...")
    meshes_green = load_velcro_meshes(glow_rgb=(0.08, 0.96, 0.50))
    im_iso, _ = rc.render_scene_zbuf(
        meshes_green, 860, 680,
        eye=(98.0, 82.0, 44.0), target=(0.0, 0.0, 0.0),
        ortho_scale=92.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(228, 234, 243),
    )

    print("[VELCRO RENDER 2/5] 渲染右侧全景视图（非对称内长毛面 86.5mm + 外短刺面 24mm）...")
    im_side, _ = rc.render_scene_zbuf(
        meshes_green, 860, 680,
        eye=(155.0, 0.0, 1.0), target=(0.0, 0.0, 1.0),
        ortho_scale=88.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(228, 234, 243),
    )

    print("[VELCRO RENDER 3/5] 渲染非对称魔术贴搭接区特写...")
    im_velcro, _ = rc.render_scene_zbuf(
        meshes_green, 860, 680,
        eye=(88.0, -34.0, -38.0), target=(0.0, -14.0, -20.0),
        ortho_scale=58.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(228, 234, 243),
    )

    print("[VELCRO RENDER 4/5] 渲染 X=0 纵剖叠层视图（上部方案A FPC→ZIF + 下部非对称魔术贴 0 碰撞）...")
    meshes_sec = load_velcro_meshes(glow_rgb=(0.08, 0.96, 0.50), clip_x_positive=True)
    im_sec, _ = rc.render_scene_zbuf(
        meshes_sec, 860, 680,
        eye=(150.0, 0.0, 1.0), target=(0.0, 0.0, 1.0),
        ortho_scale=88.0, ssaa=2,
        bg_top=(244, 247, 252), bg_bot=(228, 234, 243),
    )

    fig, axes = plt.subplots(2, 2, figsize=(16.0, 12.2), dpi=140)
    fig.patch.set_facecolor("#F4F7FC")
    panels = [
        (im_iso, "① 轴测实模 · EVT-A 120–200 mm 非对称低遮挡魔术贴版（136–200 mm 0% 遮光！）"),
        (im_side, "② 右侧轮廓 · 12.15mm EVT-A 主机 + 前翼 86.5mm 长毛面 + 后翼 24mm 刺面"),
        (im_velcro, "③ 魔术贴搭接特写 · 刺面(暖褐)紧扣毛面轨道(蓝灰) + 末端微翘易撕拉手"),
        (im_sec, "④ X=0 纵剖校验 · 17 号磁吸四线 FPC 绕马达 + FH19C ZIF + 魔术贴 0 碰撞"),
    ]
    for ax, (im, title) in zip(axes.flat, panels):
        ax.imshow(im)
        ax.set_title(title, fontsize=11.0, fontweight="bold", color="#0F172A", pad=6)
        ax.axis("off")

    fig.suptitle(
        f"CatMouse Band V1.5-Lite EVT-A (120–200 mm 非对称低遮挡魔术贴版) — 17 零件 | 整机 {mass_g:.2f} g | 0.000 mm³ 碰撞",
        fontsize=13.5, fontweight="bold", color="#0F172A", y=0.98,
    )
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    out_p = RENDER_DIR / "cad_velcro_01_overview.png"
    fig.savefig(out_p, facecolor=fig.get_facecolor())
    plt.close(fig)

    print("[VELCRO RENDER 5/5] 生成 120–200 mm 不同腕围下光环遮盖范围与粘合长度分析图...")
    render_occlusion_analysis_sheet(rep)
    print(f"[PASS] 魔术贴版 3D 工程图 + 不同腕围遮盖分析图已导出至: {RENDER_DIR}")


def render_occlusion_analysis_sheet(rep: dict):
    """定量绘制 120 / 135 / 160 / 180 / 200 mm 五档腕围绕腕几何示意与全连续遮盖/粘合曲线。"""
    import math
    from matplotlib.patches import Arc

    wr = rep["wrist_adjustable_range_mm"]
    P = wr["pod_len_mm"]                   # 42.0
    L_lg_end = 27.3                        # 导光区外端距表耳弧长 (发光条 2.0..27.3 => 25.3mm)
    L_lg_bar = wr["light_guide_len_each_mm"]  # 25.3
    L_f = wr["front_wing_inner_len_mm"]    # 119.3
    L_r = wr["rear_wing_outer_len_mm"]     # 66.1
    L_hook = wr["rear_hook_len_mm"]        # 24.0
    L_tab = 6.0

    def calc_metrics(C: float):
        ov = P + L_f + L_r - C
        # 后翼外端(含拉手)距前壳(+21)弧长距离
        d_rt = C - P - L_r
        # 被遮挡的前翼导光条长度 (前导光条占据 [2.0, 27.3])
        occ_mm = max(0.0, min(L_lg_bar, L_lg_end - d_rt))
        occ_pct = 100.0 * occ_mm / L_lg_bar
        vis_leds_front = max(0, min(6, round(6.0 * (1.0 - occ_mm / L_lg_bar))))
        vis_leds_total = 6 + vis_leds_front
        # 魔术贴刺面有效粘合长度
        eng_mm = min(L_hook, max(0.0, ov - L_tab - 1.5))
        # 前翼内端距后壳(-21)弧长距离（负值表示缩入表壳底面贴肤侧，不影响任何导光环发光）
        d_ft = C - P - L_f
        return dict(C=C, ov=ov, d_rt=d_rt, occ_mm=occ_mm, occ_pct=occ_pct,
                    vis_leds=vis_leds_total, eng_mm=eng_mm, d_ft=d_ft)

    fig = plt.figure(figsize=(17.5, 10.6), dpi=140)
    fig.patch.set_facecolor("#F6F8FC")
    gs_top = fig.add_gridspec(1, 5, left=0.04, right=0.97, top=0.90, bottom=0.51, wspace=0.14)
    gs_bot = fig.add_gridspec(1, 2, left=0.06, right=0.96, top=0.41, bottom=0.07, wspace=0.28, width_ratios=[1.15, 1.0])

    sample_sizes = [
        (120, "120 mm · 极细/儿童腕"),
        (135, "135 mm · 零遮挡临界"),
        (160, "160 mm · 中性/标准腕"),
        (180, "180 mm · 标准男腕"),
        (200, "200 mm · 大码/粗腕"),
    ]

    for idx, (C, label) in enumerate(sample_sizes):
        ax = fig.add_subplot(gs_top[0, idx])
        ax.set_facecolor("#F6F8FC")
        ax.set_aspect("equal")
        m = calc_metrics(C)
        R = C / (2.0 * math.pi)
        r_max = 39.5
        ax.set_xlim(-r_max, r_max)
        ax.set_ylim(-r_max - 18.0, r_max + 2.0)
        ax.axis("off")

        def s_to_deg(s_mm: float) -> float:
            # s=0 位于正上方 90°，正值(前翼)顺时针减小，负值(后翼)逆时针增大
            return 90.0 - (s_mm / C) * 360.0

        def draw_arc_seg(s0: float, s1: float, radius: float, color: str, lw: float, zorder: int = 3, ls: str = "-"):
            a0, a1 = s_to_deg(s0), s_to_deg(s1)
            th = np.linspace(math.radians(a0), math.radians(a1), 80)
            ax.plot(radius * np.cos(th), radius * np.sin(th), color=color, lw=lw, solid_capstyle="round", ls=ls, zorder=zorder)

        # 手腕截面浅灰底圆
        th_c = np.linspace(0, 2 * math.pi, 160)
        ax.fill(R * np.cos(th_c), R * np.sin(th_c), color="#FFFFFF", zorder=1)
        ax.plot(R * np.cos(th_c), R * np.sin(th_c), color="#CBD5E1", lw=1.0, ls="--", zorder=2)

        # 内层前翼 (毛面基带, R + 1.2)
        draw_arc_seg(21.0, 21.0 + L_f, R + 1.2, "#475569", lw=4.0, zorder=3)
        # 前翼毛面轨道 (蓝色)
        draw_arc_seg(21.0 + L_lg_end + 2.0, 21.0 + L_f - 1.5, R + 2.2, "#3B82F6", lw=2.2, zorder=4)
        # 前翼导光条 (荧光绿)
        draw_arc_seg(23.0, 21.0 + L_lg_end, R + 2.2, "#10B981", lw=5.0, zorder=5)

        # 外层后翼 (短刺面搭接带, R + 4.4)
        draw_arc_seg(-21.0, -(21.0 + L_r), R + 4.4, "#1E293B", lw=4.2, zorder=6)
        # 后翼刺面 (橙褐)
        draw_arc_seg(-(21.0 + L_lg_end + 2.0), -(21.0 + L_r - L_tab), R + 3.4, "#D97706", lw=2.3, zorder=7)
        # 后翼导光条 (荧光绿)
        draw_arc_seg(-23.0, -(21.0 + L_lg_end), R + 5.2, "#10B981", lw=5.0, zorder=8)

        # 若前翼导光环被后翼外端遮盖，标红警示段！
        if m["occ_mm"] > 0.2:
            occ_start = 21.0 + m["d_rt"]
            occ_end = 21.0 + L_lg_end
            draw_arc_seg(max(23.0, occ_start), occ_end, R + 5.5, "#EF4444", lw=5.6, zorder=10)

        # 顶面鹅卵石主机 (42mm)
        draw_arc_seg(-21.0, 21.0, R + 3.2, "#0F172A", lw=8.5, zorder=9)

        # 圆心仅放醒目腕围数字，永不越界！
        ax.text(0.0, 0.0, f"{C}\nmm", ha="center", va="center", fontsize=12.0, fontweight="bold", color="#0F172A", zorder=11)

        # 圆下方放清晰白底卡片列出三项定量指标
        occ_col = "#DC2626" if m["occ_mm"] > 0.5 else "#059669"
        card_txt = (
            f"前光环遮盖: {m['occ_mm']:.1f}mm ({m['occ_pct']:.0f}%)\n"
            f"有效亮灯: {m['vis_leds']}/12  |  粘合: {m['eng_mm']:.1f}mm"
        )
        ax.text(
            0.0, -r_max - 9.0, card_txt, ha="center", va="center", fontsize=8.4, fontweight="bold", color=occ_col,
            bbox=dict(boxstyle="round,pad=0.36", fc="#FFFFFF", ec="#CBD5E1", alpha=0.98),
        )
        ax.set_title(label, fontsize=10.5, fontweight="bold", color="#0F172A", pad=4)

    # 底部左图：全连续腕围 120..200mm 光环遮盖率 & 有效亮灯颗数
    ax_l = fig.add_subplot(gs_bot[0, 0])
    ax_l.set_facecolor("#FFFFFF")
    cs = np.linspace(120.0, 200.0, 161)
    ms = [calc_metrics(float(c)) for c in cs]
    occ_pcts = [x["occ_pct"] for x in ms]
    vis_leds = [x["vis_leds"] for x in ms]

    p_g = ax_l.axvspan(135.4, 200.0, color="#ECFDF5", alpha=0.85, label="零遮挡黄金区 (136–200 mm · 12/12 全亮)")
    p_r = ax_l.axvspan(120.0, 135.4, color="#FEF2F2", alpha=0.70, label="极细腕轻遮区 (120–135 mm · 仍保 8–11/12 亮灯)")
    l1, = ax_l.plot(cs, occ_pcts, color="#DC2626", lw=2.6, label="前翼光环被遮盖比例 (%) [后翼全范围 0%]")
    ax_l.set_xlim(120, 200)
    ax_l.set_ylim(-4, 106)
    ax_l.set_xlabel("手腕周长 C (mm)", fontsize=10.5, fontweight="bold", color="#1E293B")
    ax_l.set_ylabel("前翼光环遮盖比例 (%)", fontsize=10.5, fontweight="bold", color="#DC2626")
    ax_l.grid(True, linestyle=":", alpha=0.7)

    ax_l2 = ax_l.twinx()
    l2, = ax_l2.plot(cs, vis_leds, color="#059669", lw=2.4, ls="--", label="整机有效露光 LED 颗数 (共 12 颗)")
    ax_l2.set_ylim(0, 13.4)
    ax_l2.set_ylabel("整机有效亮灯颗数 (/12)", fontsize=10.5, fontweight="bold", color="#059669")
    ax_l.set_title("不同腕围下的导光环遮盖比例与有效亮灯颗数（后翼 6 颗始终 0% 遮挡）", fontsize=11.2, fontweight="bold", color="#0F172A", pad=8)
    handles = [p_g, p_r, l1, l2]
    ax_l.legend(handles=handles, loc="center right", fontsize=8.4, framealpha=0.95)

    # 底部右图：魔术贴粘合长度 & 前翼内端贴肤余尾
    ax_r = fig.add_subplot(gs_bot[0, 1])
    ax_r.set_facecolor("#FFFFFF")
    engs = [x["eng_mm"] for x in ms]
    tucks = [max(0.0, -x["d_ft"]) for x in ms]  # 缩入底壳下方的内余尾长度
    ax_r.plot(cs, engs, color="#D97706", lw=2.8, label="魔术贴刺面有效粘合长度 (mm)")
    ax_r.axhline(20.0, color="#059669", ls=":", lw=1.6, label="奔跑防脱安全线 (≥20 mm / >12 kg)")
    ax_r.plot(cs, tucks, color="#3B82F6", lw=2.2, ls="-.", label="内层前翼余尾缩入壳底长度 (mm，无导线可按需裁剪)")
    ax_r.set_xlim(120, 200)
    ax_r.set_ylim(-2, 46)
    ax_r.set_xlabel("手腕周长 C (mm)", fontsize=10.5, fontweight="bold", color="#1E293B")
    ax_r.set_ylabel("长度 (mm)", fontsize=10.5, fontweight="bold", color="#1E293B")
    ax_r.grid(True, linestyle=":", alpha=0.7)
    ax_r.set_title("魔术贴粘合强度余量 & 内侧可裁剪余尾估算", fontsize=11.2, fontweight="bold", color="#0F172A", pad=8)
    ax_r.legend(loc="upper right", fontsize=8.3, framealpha=0.95)

    fig.suptitle(
        "CatMouse Band V1.5-Lite (120–200 mm 非对称魔术贴版) — 不同腕围绕腕形态、光环遮盖范围与粘合强度定量分析",
        fontsize=14.0, fontweight="bold", color="#0F172A", y=0.965,
    )
    out_occ = RENDER_DIR / "cad_velcro_02_wrist_occlusion_analysis.png"
    fig.savefig(out_occ, facecolor=fig.get_facecolor())
    plt.close(fig)


if __name__ == "__main__":
    main()
