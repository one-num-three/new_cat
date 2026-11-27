# CatMouse Band V1.5 (Strap-Halo 腕带光环版) — 3D CAD & Autodesk Fusion 360 工程包

本目录包含面向 **“灯环在腕带上、主机极简无屏专攻 NFC 碰触 + 方案 A 内埋式柔性 FPC 直插 ZIF 防水连接”** 工业设计方案的完整 **16 零件**参数化 3D 装配体、B-Rep 零碰撞校验报告、6 张高清 CAD 工程与连接微距评审图，以及 **100% 原生参数化 Autodesk Fusion 360 脚本 (v3)**。

---

## 一、两种在 Autodesk Fusion 360 中打开并查看内部连接结构的方式

### 方式 A（推荐 · 1 秒直开）：打开原生多实体 B-Rep STEP 装配体
1. 在 Fusion 360 中选择 **`文件 → 打开 → 从我的电脑打开`**。
2. 选择 [output/CatMouseBand_V15_StrapHalo.step](output/CatMouseBand_V15_StrapHalo.step)（16 个独立命名实体，含精确 CMF 配色、全圆角、无三角面片失真，已通过 `0.000 mm³` 全两两干涉检测）。
3. **查看内部连接结构**：在 Fusion 360 左侧「浏览器」中点击关闭 **`01_Top_Shell_NFC`**（可一并关闭 `04_NFC_FPC_Coil_Ferrite`）的眼睛图标，即可清晰看到前后双路琥珀色 FPC 排线穿过硅胶 T 型防水密封锁扣并深入插接主板白色 4-Pin ZIF 翻盖座（`J_LED_F` / `J_LED_R`）！

### 方式 B（可调参数特征树）：运行 100% 原生 Fusion 360 参数化脚本 (v3)
脚本已自动安装到本机 Fusion Scripts 目录（仓库备份见 [fusion360/CatMouseBand_V15_StrapHalo/](fusion360/CatMouseBand_V15_StrapHalo/)）：
1. 打开 Autodesk Fusion 360，按快捷键 **`Shift + S`** 打开「脚本和附加模块」。
2. 在「脚本」列表中选中 **`CatMouseBand_V15_StrapHalo`** 并点击 **运行**。
3. Fusion 将自动生成 **18 个用户参数 (`fx`)**、**16 个独立组件**（含方案 A 前后翼内埋 FPC 排线、白色开槽 ZIF 翻盖座、双端硅胶 T 型防水锚块与 NFC 铜质 C 型下弯排线）、右侧按键滑移运动副（`0..0.45 mm`）、**红猫 / 绿鼠 / 蓝求救三套发光材质**，并自动导出 `.f3d` 存档。

---

## 二、核心机械与光学结构规格（已通过 B-Rep 实测验证）

| 指标 | 数值 / 状态 | 说明 |
|---|---|---|
| **主机仓外形** | **`34.0 × 42.0 × 11.8 mm`**（`R = 9.5 mm`） | 哑光黑鹅卵石无屏主机；顶面 100% 留给无遮挡 13.56MHz NFC 线圈 + 0.2mm 铁氧体，盲触猫爪+NFC波纹凹雕 |
| **手腕内椭圆轮廓** | **`62.0 × 48.0 mm`**（名义内周长 `173.5 mm`） | 配合 5 档针扣调节覆盖 `140–210 mm` 成人/青少年腕围 |
| **腕带光环尺寸** | 腕带宽 `22.0 mm` × 厚 `3.4 mm`；**导光环宽 `7.6 mm`** | 前/后双翼 300° 连续环腕发光，微凸 `+0.35 mm` 光学透镜拱顶，白天/夜晚 360° 无死角辨识阵营 |
| **方案 A 内部连接** | 双翼内埋 `2.0–2.2 mm` FPC 尾带 + `J_LED_F`/`J_LED_R` 4-Pin ZIF + 双端硅胶 T 型防水锁扣 | 前翼 4 线回环进仓插接 `J_LED_F`；后翼在腕带肩部向西侧折弯经独立防水塞绕开 BLE 天线直插 `J_LED_R`；底部表扣 **0 导线跨越** |
| **最小壁厚** | 顶 NFC 窗 `1.20 mm` · 底壁 `1.30 mm` · 侧壁 `1.80 mm` · 腕带贴肤内壁 `1.25 mm` | 满足双色注塑 / LSR 硅胶模内包胶工艺规范 |
| **整机估算总重** | **`32.98 g`**（≤ 35 g 量产目标） | 按各零件真实材料密度 × B-Rep 精确体积求和 |
| **B-Rep 干涉校验** | **16/16 实体有效，120 组配合 `0` 处碰撞 (`0.000 mm³`)** | 详见 [output/cad_verification_report.json](output/cad_verification_report.json) |

---

## 三、两个并存版本与文件清单

### 版本 1：V1.5 Strap-Halo（量产针扣版 · `32.98 g`）
- [build_catmouse_cad.py](build_catmouse_cad.py)：16 零件参数化建模与 `0.000 mm³` 干涉校验脚本
- [output/CatMouseBand_V15_StrapHalo.step](output/CatMouseBand_V15_StrapHalo.step)：完整 16 零件多实体 B-Rep STEP 装配体
- [fusion360/CatMouseBand_V15_StrapHalo/](fusion360/CatMouseBand_V15_StrapHalo/)：原生 Fusion 360 参数化脚本 (v3)
- [renders/](renders/)：6 张高清 CAD 工程评审图（含 [cad_06_fpc_connection_detail.png](renders/cad_06_fpc_connection_detail.png) 内部连接 4 视角微距详图）

### 版本 2：V1.5-Lite Velcro（EVT 魔术贴简版 · `32.16 g` · 零金属表扣 / 适合 3D 打印手板）
- **定位**：100% 沿用 V1.5 无屏 NFC 主机、300° 发光导光环与方案 A 内部 FPC→ZIF / T 型密封结构；取消底部 CNC 铝合金针扣、硅胶束带环与 5 个冲孔，改为极简 **18mm 背胶魔术贴直接搭接（前毛面 + 后刺面 + 末端微翘易撕拉手）**，0 导线跨魔术贴区，最适合前期 3D 打印 TPU 手板与外场实测。
- [build_catmouse_velcro_cad.py](build_catmouse_velcro_cad.py)：16 零件魔术贴简版建模与 `0.000 mm³` 干涉校验脚本（16/16 实体合法，整机 `32.16 g`）
- [output/CatMouseBand_V15_Velcro_Lite.step](output/CatMouseBand_V15_Velcro_Lite.step)：完整 16 零件魔术贴简版 B-Rep STEP 装配体
- [fusion360/CatMouseBand_V15_Velcro_Lite/](fusion360/CatMouseBand_V15_Velcro_Lite/)：原生 Fusion 360 魔术贴简版参数化脚本（已同步安装到本机 Fusion Scripts 目录）
- [renders/cad_velcro_01_overview.png](renders/cad_velcro_01_overview.png)：魔术贴简版 4 视角高清工程评审图（轴测 / 侧视 / 底部魔术贴特写 / `X=0` 纵剖）
