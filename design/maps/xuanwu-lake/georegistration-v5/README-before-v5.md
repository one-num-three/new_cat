# 猫鼠行动 · 玄武湖地图成果总览

整理日期：2026-10-13。**不制作压缩包，全部文件保留在本目录。**

本目录汇总本会话的地图图片、像素材质、真实地理数据、候选锚点、图面配准结果、交互核查代码、生成提示词和历次修正记录。不包含另一个会话制作的其他小程序页面。

当前目录：`D:\cat-mouse-miniprogram\design\maps\xuanwu-lake`

## 1. 先看这里

| 你要找什么 | 文件 | 使用说明 |
| --- | --- | --- |
| **最新版完整地图** | [huanzhou-yingzhou-v3/huanzhou-yingzhou-corridor.png](huanzhou-yingzhou-v3/huanzhou-yingzhou-corridor.png) | **完整环洲＋樱洲，已将轨道式造型修正为有廊顶、立柱和步道的长廊。** 当前美术参考主版本，1154×1363。 |
| 共用像素材质图 | [two-maps-v1/materials-atlas.png](two-maps-v1/materials-atlas.png) | 草地、水面、树冠、屋顶四种材质，1254×1254。 |
| 完整双洲真实几何参考 | [huanzhou-yingzhou-v2/complete-geometry.png](huanzhou-yingzhou-v2/complete-geometry.png) | 由 OSM 矢量绘制，含两洲完整主体、道路、桥梁和花架走廊线形。 |
| 樱洲详细位置核查 | [yingzhou-verified-v1/yingzhou-audit.png](yingzhou-verified-v1/yingzhou-audit.png) | B1～B4 是桥梁核查编号；C 是藏春亭的 OSM 点位，不是建筑轮廓。 |
| 原始真实地理数据 | [source-v1/osm-source.osm](source-v1/osm-source.osm) | 下载保存的 OSM XML；地理数据的源文件。 |
| 交互核查页面 | [two-maps-v1/index.html](two-maps-v1/index.html) | 先按下文启动本地服务。展示的是**早期两张矢量绘制地图**，不是最新版长廊修正图。 |
| 所有文件 | [FILE_INDEX.md](FILE_INDEX.md) | 逐项列出本目录文件、用途、大小与图片尺寸。 |
| 本次交接校验 | [HANDOFF_CHECK.json](HANDOFF_CHECK.json) | 当前文件哈希、检查结果及历史清单差异；不替换旧版本记录。 |

**两个容易混淆的版本：**

- 看美术效果：看 `huanzhou-yingzhou-v3/huanzhou-yingzhou-corridor.png`。
- 看可计算坐标和交互：看 `source-v1/`、`two-maps-v1/` 与 `yingzhou-verified-v1/` 中的地理数据、代码和核查记录。

最新版图片仍是生图模型生成的美术稿，**尚未完成该图片自身的控制点标定、独立误差检验与现场定位测试**。早期两张地图的定位文件和检验数值不能直接套到新版图片上。

## 2. 目录与版本经过

| 目录 | 内容与用途 | 状态 |
| --- | --- | --- |
| `source-v1/` | 玄武湖及周边原始 OSM 数据；玄武门—解放门范围提取；候选锚点；地理核查图及覆盖检查 | 地理数据起点，不是完整测绘成果 |
| `two-maps-v1/` | 用户提供的一小一大两张原图、配准结果、像素材质、矢量绘图代码、PNG、世界文件、HTML 交互核查及验证脚本 | 早期确定性绘图与坐标实验版本 |
| `ai-art-reference-2026-10-13/` | 将地图和材质图交给内置生图模型后得到的两张美术参考、提示词与对照记录 | 比较美术表现的历史版本 |
| `completed-islands-v1/` | 按真实扩展范围补齐环洲北部，形成完整双洲主体；包含定位映射思路 | 首次补全版本，未包含后续全部修正 |
| `yingzhou-verified-v1/` | 以樱洲本体为主的真实数据参考、桥梁和走廊核查、像素参考图 | 中间核查版本；名称中的 verified 指相关资料核查，不代表图片已通过真实定位验收 |
| `huanzhou-yingzhou-v2/` | 恢复完整环洲＋樱洲范围，并保留樱洲走廊等数据修正 | 完整双洲版本；长廊当时仍呈轨道式外观 |
| `huanzhou-yingzhou-v3/` | 根据用户圈注，将长条结构改为清晰的园林长廊 | **当前美术主版本** |
| `reference-materials/` | 原先选定的晴日 16-bit 像素风格参考及其来源记录 | 只用于风格参照，不是本会话重新制作的界面 |

历次图片均保留，不用新版覆盖旧稿。`manifest.json`、`PROMPT.txt`、`PROMPTS.txt` 和 `REVIEW.txt` 记录各自阶段的来源、提示词与判断。

## 3. 图片与材质

### 3.1 当前主图

文件：`huanzhou-yingzhou-v3/huanzhou-yingzhou-corridor.png`

- 范围：完整环洲、樱洲，以及两洲之间的水道与连接桥梁；向外延伸的连接通道可以到达画布边缘。
- 风格：晴日公园 / 16-bit 像素 / 轻快冒险。
- 本次最终修正：长廊采用连续廊顶、立柱和步道表达，去除像铁轨的横杆结构。
- 廊顶、树冠、瓦片、水纹等是美术表达，不等于经过现场测量的材质、建筑尺寸或树木位置。
- 局部生图编辑也可能重绘周围像素，不能宣称目标区以外逐像素未变。

生成工具为内置 `image_gen`。该版本完整提示词见 [v3/PROMPT.txt](huanzhou-yingzhou-v3/PROMPT.txt)。旧稿与输出哈希见 [v3/manifest.json](huanzhou-yingzhou-v3/manifest.json)。

### 3.2 两张早期坐标实验地图

| 地图 | PNG | 尺寸 | 定位附属文件 |
| --- | --- | --- | --- |
| 小图：解放门—七星旱桥 | [map-small.png](two-maps-v1/map-small.png) | 2400×1664 | 同名 `.pgw` 与 `.prj` |
| 大图：环洲—樱洲局部 | [map-large.png](two-maps-v1/map-large.png) | 2400×2254 | 同名 `.pgw` 与 `.prj` |

两张用户初始截图保存在 `reference-small.png` 和 `reference-large.png`。材质提示词保存在 `MATERIAL-PROMPT.txt`。

`.pgw` 使用像素中心约定，`.prj` 描述 EPSG:3857 投影；它们只对应各自同名的早期 PNG。**不要把这些文件重命名后附给 v3 或其他生成图。**

## 4. 地理数据与定位状态

### 数据来源

- [OSM 原始请求](https://api.openstreetmap.org/api/0.6/map?bbox=118.77,32.06,118.82,32.105)：玄武湖及附近范围。
- [玄武湖水面关系](https://www.openstreetmap.org/relation/2138994)。
- [环洲轮廓](https://www.openstreetmap.org/way/776728664)与[樱洲轮廓](https://www.openstreetmap.org/way/776728670)。
- [景区官方樱洲介绍](https://www.xuanwuhu.net/lyzn/lyzn.aspx?mtt=49)与[环洲介绍](https://www.xuanwuhu.net/lyzn/lyzn.aspx?mtt=44)。

原始 OSM 数据为 WGS84，GeoJSON 坐标顺序是 **[经度, 纬度]**。绘图采用 Web Mercator 平面坐标；现有小程序定位代码使用 GCJ-02。参与同一套定位计算之前，需要统一坐标系。

### 已完成

- 保存 OSM 原文件及源数据哈希。
- 提取玄武门—解放门初始区域的道路、建筑、水域、城墙、入口等要素，见 `source-v1/region.wgs84.geojson`。
- 保存 8 条候选锚点记录，其中 **A4 与 A6 同点，实际只有 7 个不同位置**。
- 对两张初始截图做图面配准，并完成投影、平移、缩放和旋转的数学校验。
- 为早期矢量绘图版本制作交互核查页面和两张 PNG 的世界文件。
- 提取樱洲的桥梁及花架走廊线形，见 `yingzhou-verified-v1/yingzhou.wgs84.geojson`。

### 仍待完成

- 最新 v3 图片自身的“真实经纬度 ↔ 图片像素”标定。
- 生图局部形变检查、独立检查点残差统计和超出标定范围的处理。
- GCJ-02 与 WGS84 的统一转换和交叉核对。
- 真机定位精度、通行状况、入口与道路完整性检查。
- 原生微信小程序 WXML/WXSS/JS 的正式接入。

直接在 v3 图片上叠加定位点是可行的实现方向：固定图片版本 → 选取分散桥头/路口作为对应点 → 统一坐标系 → 拟合映射并做独立检查 → 定位点和底图共用相机变换。但当前文件包尚未完成这条链路。静态图片放大也不会自动产生新的真实地理细节。

### 现有数值的适用范围

- 小图配准 RMSE 约 **0.320366 个原截图像素**。
- 大图水面掩膜匹配 IoU 约 **0.9980123**。
- 以上数值属于最初两张截图与已有 OSM 几何的匹配，不是 GPS 精度，不适用于之后的生图结果。
- 源数据存在覆盖与口径差异：初始提取中有一项建筑多面关系未拼装；樱洲 OSM 轮廓粗算约 6.83 公顷，官网给出 6.59 公顷。本轮没有通过强行缩放掩盖差异。
- 藏春亭目前只保留 OSM 点位，不把点位当作已经获得的建筑轮廓。
- OSM 中“樱州花架走廊”的名称与官方“樱洲长廊”不自动等同；用户确认的长条结构按长廊进行美术修正。

## 5. 如何打开交互核查页面

直接查看 PNG、SVG、JSON、Markdown 不需要启动服务。

交互页面需 Python 3。现有目录的 PowerShell 启动命令：

```powershell
Set-Location 'D:\cat-mouse-miniprogram\design\maps\xuanwu-lake\two-maps-v1'
python serve.py
```

浏览器打开 [http://127.0.0.1:8768/](http://127.0.0.1:8768/)。服务只绑定本机回环地址，退出服务用 `Ctrl+C`。如果端口已经被旧预览占用，先确认旧服务是否仍在运行。

支持拖动平移、滚轮/按钮缩放、15° 旋转、复位、真实轮廓叠加和候选锚点显示。

**运行行为：**

- 页面展示的是 `two-maps-v1` 的早期矢量绘制地图，不会自动变成 v3 美术主图。
- 正常页面加载会重新导出 `map-small.png`、`map-large.png`、`browser-check.json`；需要保留某次精确文件快照时，先复制整个目录再运行。
- “导出当前地图”导出所选地图的默认完整范围，而不是屏幕上的任意平移/旋转视口。
- `maps-config.json` 是页面读取的权威配置；`maps-config.js` 为保留的早期副本，不是当前页面的配置入口。
- `register.py` 会重写配准文件，并将配置写回平面基线；它不是日常预览启动命令。
- 移动整个文件夹后，保持子目录结构即可。历史元数据里的绝对路径用于追溯原位置，不代表文件必须继续留在那台机器的原路径。

## 6. 脚本、依赖与复核

| 文件 | 用途 | 依赖/行为 |
| --- | --- | --- |
| `serve.py` | 本地核查服务及 PNG 导出落盘 | Python 3 标准库 |
| `renderer.js` | 从矢量和材质绘图、相机变换、交互与导出 | 浏览器 Canvas；树木是固定美术装饰 |
| `register.py` | 分析两张原始截图与 OSM 几何的对应关系 | Python、NumPy、Pillow、Matplotlib、SciPy；会重写多个文件 |
| `verify.cjs` | 配置、地理源哈希、初始配准和数学往返检查 | Node.js，无额外 npm 包 |
| `ROLLBACK.sh` | 将指定配置文件恢复为平面基线 | Bash；不撤销 PNG 生图、不回滚整个项目 |

在 `two-maps-v1` 中执行以下只读检查：

```powershell
node verify.cjs baseline-config.json flat
node verify.cjs maps-config.json pixel
node verify.cjs rollback-test.json flat
```

本次整理时三项均返回 PASS，退出码均为 0；具体输出见 `HANDOFF_CHECK.json`。第三项检查的是保留的回滚测试副本，本次整理没有重新覆盖主配置。

历史回滚命令 `bash ROLLBACK.sh rollback-test.json` 只恢复指定副本；不带目标参数则会恢复当前 `maps-config.json`。其历史执行证据见 `two-maps-v1/VERIFICATION.txt`。

PNG 美术稿可以重新参考提示词生成，但不能承诺生图结果逐像素复现。部分几何参考图由当时的一次性数据绘制命令产生，本目录保留了图片、数据与检查记录，不包含每一步的一键重建脚本。

## 7. 哈希与历史记录

历史 `manifest.json`、`VERIFICATION.txt` 保留当时的记录，不静默修改。

本次整理发现 `two-maps-v1/map-large.png` 的当前 SHA-256 与该目录历史 manifest 中的输出哈希不同。预览页面具有自动重导出行为，但仅凭哈希差异不判定此次变化的具体原因。新旧哈希均列在 `HANDOFF_CHECK.json` 中。

本次目录现状以根目录 `HANDOFF_CHECK.json` 为交接快照；它列出文件当前哈希，不包含自身的递归哈希。运行预览后如重新导出了 PNG，快照哈希也会相应过时。

## 8. 数据署名与交接范围

地图数据：**© OpenStreetMap contributors**，ODbL 1.0。参见 [OpenStreetMap 署名与许可](https://www.openstreetmap.org/copyright)。后续展示或分发地图时应保留相应数据署名。

本会话没有修改非地图产品页面，也没有把这些生图直接接入真实定位产品。后续接手时，请从 v3 美术主图、原始 OSM 数据、候选锚点和本 README 开始；不要把历史美术参考、早期图面配准或标注为 verified 的目录名当作现场定位验收结论。

**全部文件继续放在当前目录，没有压缩包。**
