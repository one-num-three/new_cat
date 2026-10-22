# 三地图轨迹分享 · 完整模拟效果

制作日期：2026-10-21。用户明确要求模拟较长轨迹，展示全部贴图与海报效果。三张图使用现有原地图、v4不规则透明边框、独立起终点旗子和左右版本气泡，由程序合成，没有交给生图模型重新绘制地图或路线。

| 地图 | 分享图 JPG | PNG 原图 | 模拟路径 |
|---|---|---|---|
| 玄武湖 · 环洲樱洲 | [xuanwu-share.jpg](xuanwu-share.jpg) | [xuanwu-share.png](xuanwu-share.png) | [xuanwu-mock.json](xuanwu-mock.json) |
| 东南大学 · 九龙湖 | [jiulonghu-share.jpg](jiulonghu-share.jpg) | [jiulonghu-share.png](jiulonghu-share.png) | [jiulonghu-mock.json](jiulonghu-mock.json) |
| 东南大学 · 四牌楼 | [sipailou-share.jpg](sipailou-share.jpg) | [sipailou-share.png](sipailou-share.png) | [sipailou-mock.json](sipailou-mock.json) |

[三张并排对比](all-three-preview.png)。每张941×1672，保留PNG和分享JPG。全部文件直接交付，无压缩包。

## 模拟内容

- 玄武湖：43个路径控制点、378个采样点，包含西岸、内岛、桥梁和环洲南侧回环。
- 九龙湖：45个路径控制点、432个采样点，包含中央环形广场、湖侧、西南片区、南侧及东侧道路。
- 四牌楼：79个路径控制点、571个采样点，包含中央庭院、东西组团和北侧返回段。

路径沿美术地图中的道路手工选点并插值，属于原图像素坐标，不是伪造的GPS记录。里程、时长、热量均为UI模拟值，不由像素长度测量得出。海报明确标注“模拟数据”“模拟轨迹与数据 · 非真实记录”。时间戳仅用elapsedMs表示相对模拟时间，与海报示例时长一致。

每张都包含橙色轨迹、绿色起点旗、橙红终点旗、“你在这里跑得最快”“你在这里离猫最近”气泡与点位，气泡根据左右位置自动选择方向，中文保持正向。亮点位置同样为模拟效果，并非根据真实玩家或猫的位置推断。

## 合成与复现

运行 `node render.cjs`。复用现有Sharp依赖，图层顺序为原地图→白描边橙色路线→不规则透明前景→亮点气泡→起终点旗子→模拟统计。三张地图源文件SHA256与已有布局清单逐一核对；原文件保持不变。

2026-10-21 遮挡修正：起终点旗子提升到气泡上方。气泡与旗子冲突时优先切换左右方向，保持真实点不动；九龙湖的“离猫最近”气泡现向右展开，完整露出起点。运行 `node verify-layers.cjs` 对三张图的六面旗子做不透明像素检查，并核查气泡与旗子包围框无交叠。修前稿与脚本保存在 baseline-layer-v1/。

地图与前景使用trajectory-share-irregular-v4/layout.json固定布局：地图从(0,328)开始，941×941；旗杆脚和气泡尾尖分别使用素材manifest里的归一化锚点。边缘气泡复用track-bubbles-v1/placement.cjs。所有原素材仍在原目录。

本目录仅为独立设计预览和模拟素材，不写入线上记录，不替换正式导出接口。实际记录仍由程序按既有授权与配准规则叠加。地图数据署名：© OpenStreetMap contributors / ODbL，https://www.openstreetmap.org/copyright 。
