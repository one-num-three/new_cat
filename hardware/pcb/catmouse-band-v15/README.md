# CatMouse Band V1.5 EVT — KiCad 10 4 层紧凑主板工程

本目录为 **KiCad 10.0 原生 4 层 PCB 工程**，所有原理图符号与 PCB 封装均已自包含嵌入，双击 `catmouse-band-v15.kicad_pro` 即可直接打开，无需安装任何第三方库。

## 文件说明

| 文件 / 目录 | 说明 |
|---|---|
| `catmouse-band-v15.kicad_pro` | KiCad 10 工程配置与嘉立创 4 层工艺约束 |
| `catmouse-band-v15.kicad_dru` | 自定义设计规则（最小间距 `0.127mm`、电源线宽、板边净空 `0.30mm`） |
| `catmouse-band-v15.kicad_sch` | 80 器件 / 55 网络完整原理图（5 大功能分区，官方 ERC 0 违规） |
| `catmouse-band-v15.kicad_pcb` | 40.0 × 46.0 mm（R=14mm）4 层紧凑主板（L1 发光环 / L2 完整 GND / L3 +3V3 / L4 核心芯片） |
| `catmouse-band-v15.net` | KiCad 10 官方导出网表（已与 EVT 固件 12 引脚校验 100% 对齐） |
| `erc_report.json` / `drc_report.json` | KiCad 10.0.8 官方 ERC 与 DRC 完整检查报告 |
| `fab_jlcpcb/` | 嘉立创 4 层打样生产包（11 层 Gerber + Excellon 钻孔 + SMT 贴片坐标 CPL + BOM） |
| `previews/` | KiCad 10 官方渲染的高清 3D 正面/背面/透视图 + 原理图 PDF + 分层 SVG |

## 嘉立创 4 层打样推荐参数

- **层数**：4 层（`F.Cu` / `In1.Cu` / `In2.Cu` / `B.Cu`）
- **板厚**：`1.0 mm`（叠层 `JLC04101H-7628`）
- **表面工艺**：**沉金（ENIG）**（推荐，保证背面 4-pin 磁吸充电烧录触点长期插拔耐磨）
- **阻焊颜色**：哑光黑（提升正面 12 颗 `WS2812B-2020` 发光环在白天户外的高对比度！）
- **过孔覆盖**：过孔盖油（标准免费工艺，最小过孔 `0.20 / 0.45 mm`）
