# CatMouse Band V1.5 (Strap-Halo 腕带光环版) — 3D CAD & Autodesk Fusion 360 工程包

本目录包含面向 **“灯环在腕带上、主机极简无屏专攻 NFC 碰触”** 工业设计方案的完整 15 零件参数化 3D 装配体、B-Rep 零碰撞校验报告、高清 CAD 工程评审图，以及 **100% 原生参数化 Autodesk Fusion 360 脚本**。

---

## 一、两种在 Autodesk Fusion 360 中打开的方式

### 方式 A（推荐 · 1 秒直开）：打开原生多实体 B-Rep STEP 装配体
1. 在 Fusion 360 中选择 **`文件 → 打开 → 从我的电脑打开`**。
2. 选择 [output/CatMouseBand_V15_StrapHalo.step](output/CatMouseBand_V15_StrapHalo.step)（15 个独立命名实体，含精确 CMF 配色、全圆角、无三角面片失真，已通过 `0.000 mm³` 全两两干涉检测）。

### 方式 B（可调参数特征树）：运行 100% 原生 Fusion 360 参数化脚本
脚本已自动安装到本机 Fusion Scripts 目录（仓库备份见 [fusion360/CatMouseBand_V15_StrapHalo/](fusion360/CatMouseBand_V15_StrapHalo/)）：
1. 打开 Autodesk Fusion 360，按快捷键 **`Shift + S`** 打开「脚本和附加模块」。
2. 在「脚本」列表中选中 **`CatMouseBand_V15_StrapHalo`** 并点击 **运行**。
3. Fusion 将自动生成 **18 个用户参数 (`fx`)**、15 个独立组件、原生扫掠 300° 发光硅胶腕带、右侧按键滑移运动副（`0..0.45 mm`）、**红猫 / 绿鼠 / 蓝求救三套发光材质**（可在“外观 `A`”面板直接拖拽换色），并自动导出 `.f3d` 存档。

---

## 二、核心机械与光学结构规格（已通过 B-Rep 实测验证）

| 指标 | 数值 / 状态 | 说明 |
|---|---|---|
| **主机仓外形** | **`34.0 × 42.0 × 11.8 mm`**（`R = 9.5 mm`） | 哑光黑鹅卵石无屏主机；顶面 100% 留给无遮挡 13.56MHz NFC 线圈 + 0.2mm 铁氧体，盲触猫爪+NFC波纹凹雕 |
| **手腕内椭圆轮廓** | **`62.0 × 48.0 mm`**（名义内周长 `173.5 mm`） | 配合 5 档针扣调节覆盖 `140–210 mm` 成人/青少年腕围 |
| **腕带光环尺寸** | 腕带宽 `22.0 mm` × 厚 `3.4 mm`；**导光环宽 `7.6 mm`** | 前/后双翼 300° 连续环腕发光，微凸 `+0.35 mm` 光学透镜拱顶，白天/夜晚 360° 无死角辨识阵营 |
| **发光灯带方案** | 双翼 `4.5 mm` 柔性 FPC（前 6 + 后 6 = **12× WS2812B-2020**） | 前翼 4 线回环 `DOUT` 回主机桥接后翼，**0 导线跨越底部表扣**（IP67 防水、完全兼容既有固件 `GPIO21` / `GPIO8`） |
| **最小壁厚** | 顶 NFC 窗 `1.20 mm` · 底壁 `1.30 mm` · 侧壁 `1.80 mm` · 腕带贴肤内壁 `1.25 mm` | 满足双色注塑 / LSR 硅胶模内包胶工艺规范 |
| **整机估算总重** | **`32.77 g`**（≤ 35 g 量产目标） | 按各零件真实材料密度 × B-Rep 精确体积求和 |
| **B-Rep 干涉校验** | **15/15 实体有效，105 组配合 `0` 处碰撞 (`0.000 mm³`)** | 详见 [output/cad_verification_report.json](output/cad_verification_report.json) |

---

## 三、文件清单

- [build_catmouse_cad.py](build_catmouse_cad.py)：`build123d` / OpenCASCADE 15 零件参数化建模与 `0.000 mm³` 干涉校验脚本
- [render_cad_views.py](render_cad_views.py)：基于精确 B-Rep 网格的多视角 3D 工程图 + `X=0` 剖切渲染脚本
- [output/CatMouseBand_V15_StrapHalo.step](output/CatMouseBand_V15_StrapHalo.step)：完整 15 零件多实体 B-Rep STEP 装配体
- [output/parts/](output/parts/)：15 个独立零件的 `.step` 与 `.stl`（可直接送 3D 打印手板）
- [renders/](renders/)：4 张高清 CAD 工程评审图（三阵营实模、四视图、15 件爆炸装配图、`X=0` 内部叠层纵剖图）
- [fusion360/CatMouseBand_V15_StrapHalo/](fusion360/CatMouseBand_V15_StrapHalo/)：原生 Autodesk Fusion 360 参数化脚本与 `.manifest`
