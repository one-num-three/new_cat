# CatMouse Band V1.5 EVT-A (Strap-Halo 腕带光环版) — 3D CAD & Autodesk Fusion 360 工程包

本目录包含已全量同步 **EVT-A 机电变更**（[../docs/Strap-Halo-EVT-A-机电变更.md](../docs/Strap-Halo-EVT-A-机电变更.md)）的完整 **17 零件**参数化 3D 装配体（含 `12.15 mm` 抬高顶腔、`ESP32-C3-MINI-1` BLE 真实铣空槽、Hirose `FH19C-4S-0.5SH(10)` 4P ZIF 与 `2.50×0.20×3.60 mm` 补强舌、`17_Pogo_Flex_Interposer` 磁吸四线 C 弯柔性转接板）、B-Rep 零碰撞校验报告、全套高清 CAD 工程与连接微距评审图，以及 **两版 100% 原生参数化 Autodesk Fusion 360 脚本**。

---

## 一、两种在 Autodesk Fusion 360 中打开并查看内部连接结构的方式

### 方式 A（推荐 · 1 秒直开）：打开原生多实体 B-Rep STEP 装配体
1. 在 Fusion 360 中选择 **`文件 → 打开 → 从我的电脑打开`**。
2. 选择 [output/CatMouseBand_V15_StrapHalo.step](output/CatMouseBand_V15_StrapHalo.step) 或魔术贴简版 [output/CatMouseBand_V15_Velcro_Lite.step](output/CatMouseBand_V15_Velcro_Lite.step)（均包含 17 个独立命名实体、精确 CMF 配色、全圆角、无三角面片失真，已通过 `0.000 mm³` 全两两干涉检测）。
3. **查看内部连接结构**：在 Fusion 360 左侧「浏览器」中关闭 **`01_Top_Shell_NFC`**（可一并关闭 `04_NFC_FPC_Coil_Ferrite`）的眼睛图标，即可清晰看到 BLE 真实铣空槽、前后双路琥珀色 FPC `2.50×0.20 mm` 补强舌直插白色 Hirose `FH19C` ZIF 翻盖座（`J_LED_F` / `J_LED_R`）；进一步隐藏主板 `05_Mainboard_4Layer_PCBA` 即可查看 **`17_Pogo_Flex_Interposer`** 绕开 `1027` 马达的 C 型弯折走线！

### 方式 B（可调参数特征树）：运行 100% 原生 Fusion 360 参数化脚本 (EVT-A 17 组件)
两版脚本均已同步安装到本机 Fusion Scripts 目录（仓库备份见 [fusion360/](fusion360/)）：
1. 打开 Autodesk Fusion 360，按快捷键 **`Shift + S`** 打开「脚本和附加模块」。
2. 在「脚本」列表中选中 **`CatMouseBand_V15_StrapHalo`** 或 **`CatMouseBand_V15_Velcro_Lite`** 并点击 **运行**。
3. Fusion 将自动生成 **19 个用户参数 (`fx`)**（含 `nfc_stack_lift = 0.35 mm`）、**17 个独立组件**（含 BLE 真实铣空槽、`17_Pogo_Flex_Interposer` C 弯转接板、Hirose `FH19C` 4P ZIF 与 `2.50×0.20×3.60 mm` 补强舌、双端硅胶 T 型防水锚块与 NFC 铜质 C 型下弯排线）、右侧按键滑移运动副（`0..0.45 mm`）、**红猫 / 绿鼠 / 蓝求救三套发光材质**，并自动导出 `.f3d` 存档。

---

## 二、核心机械与光学结构规格（EVT-A B-Rep 实测验证）

| 指标 | 数值 / 状态 | 说明 |
|---|---|---|
| **主机仓外形** | **`34.0 × 42.0 × 12.15 mm`**（`R = 9.5 mm`） | EVT-A 顶面抬高 `+0.35 mm`（`Z_TOP = 35.95 mm`），`ESP32-C3-MINI-1` (`2.65 mm` 包络) 上方留 `0.80 mm` 净空至 NFC 铁氧体 |
| **BLE 真实铣空槽** | **`X ∈ [-8.90, +5.50], Y ∈ [-17.70, -12.15]`**（`R = 0.60 mm`） | 4 层主板真实开槽 + `X ∈ [-8.9, +8.3], Y ≤ -11.83` 四层禁布区，与 KiCad 工程同源共享 `strap_halo_geometry.py` |
| **手腕内椭圆轮廓** | 针扣版 **`62.0 × 48.0 mm`**（`173.5 mm`） / 魔术贴版 **`120–200 mm`** | 针扣版 5 档调节覆盖 `140–210 mm`；魔术贴版非对称布局实现 `136–200 mm` `0%` 遮光 |
| **方案 A 内部连接** | Hirose **`FH19C-4S-0.5SH(10)`** + **`2.50×0.20×3.60 mm`** 补强舌 + T 型锁扣 | 前翼 4 线回环进仓直插 `J_LED_F` (`1.55 mm`)；后翼西侧绕开 BLE 铣槽直插 `J_LED_R`；底部表扣 **0 导线跨越** |
| **磁吸四线转接** | **`17_Pogo_Flex_Interposer`**（`9.60 × 0.12 mm`，`R = 1.20 mm` C 弯） | 桥接底壳 4-pin 镀金 Pogo 焊尾（`5V/GND/D−/D+`）与主板 L4 焊盘，绕开 `1027` 马达名义最小净空 **`0.125 mm`** |
| **最小壁厚** | 顶 NFC 窗 `1.20 mm` · 底壁 `1.30 mm` · 侧壁 `1.80 mm` · 腕带贴肤内壁 `1.25 mm` | 满足双色注塑 / LSR 硅胶模内包胶工艺规范 |
| **整机估算总重** | 针扣版 **`33.06 g`** / 魔术贴简版 **`35.07 g`** | 均低于 `38.0 g` 目标；按各零件真实材料密度 × B-Rep 精确体积求和 |
| **B-Rep 干涉校验** | **17/17 实体有效，136 组配合 `0` 处碰撞 (`0.000 mm³`)** | 详见 [output/cad_verification_report.json](output/cad_verification_report.json) 与 [output/cad_velcro_verification_report.json](output/cad_velcro_verification_report.json) |

---

## 三、两个并存版本与文件清单

### 共享几何真值模块
- [strap_halo_geometry.py](strap_halo_geometry.py)：3D CAD 与 KiCad 4 层主板 / 磁吸四线 FPC 共享的 EVT-A 毫米级轮廓与禁布区单源定义。

### 版本 1：V1.5 EVT-A Strap-Halo（量产针扣版 · `33.06 g`）
- [build_catmouse_cad.py](build_catmouse_cad.py)：17 零件 EVT-A 参数化建模与 `0.000 mm³` 干涉校验脚本
- [output/CatMouseBand_V15_StrapHalo.step](output/CatMouseBand_V15_StrapHalo.step)：完整 17 零件多实体 B-Rep STEP 装配体
- [fusion360/CatMouseBand_V15_StrapHalo/](fusion360/CatMouseBand_V15_StrapHalo/)：原生 Fusion 360 EVT-A 参数化脚本（17 组件）
- [renders/](renders/)：6 张高清 EVT-A CAD 工程评审图（含 [cad_05_ecad_mcad_layout_blueprint.png](renders/cad_05_ecad_mcad_layout_blueprint.png) 与 [cad_06_fpc_connection_detail.png](renders/cad_06_fpc_connection_detail.png)）

### 版本 2：V1.5-Lite EVT-A Velcro（120–200 mm 非对称低遮挡魔术贴简版 · `35.07 g`）
- **定位**：100% 沿用 EVT-A `12.15 mm` 无屏 NFC 主机、BLE 铣空槽、`17_Pogo_Flex_Interposer` 与 Hirose `FH19C` 内部连接；采用 **“前翼内侧长毛面（`86.5 × 18 mm`）+ 后翼外侧精简短刺面（`24.0 × 18 mm` + 易撕微翘拉手）”非对称布局**，展开总长 `227.4 mm`，精准覆盖 **`120–200 mm` 腕围**：
  - **`136–200 mm` 腕围**：前/后双翼导光环 **`0.0 mm (0%)` 遮挡**，`12/12` 颗 LED 100% 露光，且 `200 mm` 时仍保留 `≥ 19.9 mm` 强力粘合（`> 12 kg` 剪切力）。
  - **`120–135 mm` 极细/儿童腕**：后翼外端仍距主机 `≥ 12 mm` 绝不碰壳，后翼 6 颗灯 100% 露光 + 前翼露光 `2–5` 颗（共 `8–11 / 12` 颗亮灯）；前翼无导线内端余尾可按需剪短 `15–30 mm`。
- [build_catmouse_velcro_cad.py](build_catmouse_velcro_cad.py)：17 零件 EVT-A 非对称低遮挡魔术贴版建模与 `0.000 mm³` 干涉校验脚本（17/17 实体合法，整机 `35.07 g`）
- [output/CatMouseBand_V15_Velcro_Lite.step](output/CatMouseBand_V15_Velcro_Lite.step)：完整 17 零件魔术贴简版 B-Rep STEP 装配体
- [fusion360/CatMouseBand_V15_Velcro_Lite/](fusion360/CatMouseBand_V15_Velcro_Lite/)：原生 Fusion 360 EVT-A 魔术贴简版参数化脚本（17 组件，已同步安装到本机 Fusion Scripts 目录）
- [renders/cad_velcro_01_overview.png](renders/cad_velcro_01_overview.png) · [renders/cad_velcro_02_wrist_occlusion_analysis.png](renders/cad_velcro_02_wrist_occlusion_analysis.png)：EVT-A 魔术贴简版 4 视角 3D 工程图 & `120–200 mm` 不同腕围光环遮盖/粘合强度定量分析图
