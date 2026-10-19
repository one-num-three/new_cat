# 全部文件索引

整理日期：2026-10-13。文件保持原目录，不制作压缩包。

[返回 README](README.md)

本目录共有 **65 个文件**（包括 README、本索引和交接校验记录）。

## 根目录

| 文件 | 用途 |
| --- | --- |
| [README.md](README.md) | 总说明、最新版入口、运行方法和定位状态 |
| [FILE_INDEX.md](FILE_INDEX.md) | 本索引 |
| [HANDOFF_CHECK.json](HANDOFF_CHECK.json) | 当前文件哈希与本次只读核查结果 |

## source-v1 · 真实地理数据与最初区域核查

| 文件 | 大小（字节） | 图片尺寸 | 用途 |
| --- | ---: | --- | --- |
| [anchors-candidates.json](source-v1/anchors-candidates.json) | 4,111 | — | 候选锚点记录，8条记录/7个不同位置 |
| [data-audit.json](source-v1/data-audit.json) | 1,721 | — | 源数据覆盖与几何完整性核查 |
| [geographic-check.svg](source-v1/geographic-check.svg) | 76,082 | — | 初始区域地理核查图 |
| [osm-source.osm](source-v1/osm-source.osm) | 7,901,858 | — | 完整保留的下载源文件（OSM XML） |
| [region.wgs84.geojson](source-v1/region.wgs84.geojson) | 172,788 | — | 初始区域要素提取，WGS84 |
| [SOURCE-REPORT.txt](source-v1/SOURCE-REPORT.txt) | 3,091 | — | 数据来源、处理步骤与待核验项 |

## two-maps-v1 · 初始双地图、材质、配准、代码和验证

| 文件 | 大小（字节） | 图片尺寸 | 用途 |
| --- | ---: | --- | --- |
| [baseline-config.json](two-maps-v1/baseline-config.json) | 2,098 | — | 平面绘制基线配置 |
| [browser-check.json](two-maps-v1/browser-check.json) | 389 | — | 最近一次预览自动导出记录 |
| [DELIVERY.txt](two-maps-v1/DELIVERY.txt) | 2,177 | — | 早期双地图交付说明 |
| [DIFF_FILE.diff](two-maps-v1/DIFF_FILE.diff) | 288 | — | 基线与像素配置差异 |
| [index.html](two-maps-v1/index.html) | 3,300 | — | 早期双地图交互核查页面 |
| [manifest.json](two-maps-v1/manifest.json) | 1,572 | — | 该版本的来源、文件尺寸、哈希与状态 |
| [map-large.pgw](two-maps-v1/map-large.pgw) | 110 | — | PNG像素中心世界文件，仅对应同名早期地图 |
| [map-large.png](two-maps-v1/map-large.png) | 1,340,288 | 2400 × 2254 | 早期大图：环洲—樱洲局部 |
| [map-large.prj](two-maps-v1/map-large.prj) | 487 | — | 同名早期地图的EPSG:3857投影定义 |
| [map-small.pgw](two-maps-v1/map-small.pgw) | 110 | — | PNG像素中心世界文件，仅对应同名早期地图 |
| [map-small.png](two-maps-v1/map-small.png) | 696,984 | 2400 × 1664 | 早期小图：解放门—七星旱桥 |
| [map-small.prj](two-maps-v1/map-small.prj) | 487 | — | 同名早期地图的EPSG:3857投影定义 |
| [maps-config.js](two-maps-v1/maps-config.js) | 2,120 | — | 早期配置副本，当前页面未读取 |
| [maps-config.json](two-maps-v1/maps-config.json) | 2,101 | — | 当前预览页面权威配置 |
| [MATERIAL-PROMPT.txt](two-maps-v1/MATERIAL-PROMPT.txt) | 1,485 | — | 共用材质图的完整生成提示词 |
| [materials-atlas.png](two-maps-v1/materials-atlas.png) | 1,568,257 | 1254 × 1254 | 共用草地/水面/树冠/屋顶材质图 |
| [reference-large.png](two-maps-v1/reference-large.png) | 53,390 | 346 × 350 | 用户提供的大图原始截图副本 |
| [reference-small.png](two-maps-v1/reference-small.png) | 17,999 | 199 × 138 | 用户提供的小图原始截图副本 |
| [register.py](two-maps-v1/register.py) | 4,699 | — | 原图配准脚本；会重写配准与基线配置 |
| [registration.json](two-maps-v1/registration.json) | 2,657 | — | 初始两张截图的配准结果、范围与适用说明 |
| [renderer.js](two-maps-v1/renderer.js) | 12,638 | — | 矢量绘图、像素材质、相机和交互代码 |
| [rollback-test.json](two-maps-v1/rollback-test.json) | 2,098 | — | 保留的回滚测试配置副本 |
| [ROLLBACK.sh](two-maps-v1/ROLLBACK.sh) | 255 | — | 恢复指定配置为平面基线的脚本 |
| [serve.py](two-maps-v1/serve.py) | 1,095 | — | 本机预览服务及PNG导出写入接口 |
| [source-data.js](two-maps-v1/source-data.js) | 176,079 | — | 供浏览器使用的内嵌地理数据及锚点 |
| [VERIFICATION.txt](two-maps-v1/VERIFICATION.txt) | 3,004 | — | 当时的基线/修改/回滚及浏览器验证记录 |
| [verify.cjs](two-maps-v1/verify.cjs) | 1,822 | — | 只读配置、配准和坐标数学核查脚本 |

## ai-art-reference-2026-10-13 · 生图模型双地图美术参考

| 文件 | 大小（字节） | 图片尺寸 | 用途 |
| --- | ---: | --- | --- |
| [large-ai-reference.png](ai-art-reference-2026-10-13/large-ai-reference.png) | 2,652,702 | 1294 × 1216 | 模型绘制的大图美术参考 |
| [manifest.json](ai-art-reference-2026-10-13/manifest.json) | 1,849 | — | 该版本的来源、文件尺寸、哈希与状态 |
| [PROMPTS.txt](ai-art-reference-2026-10-13/PROMPTS.txt) | 5,929 | — | 该批次完整内置生图提示词 |
| [REVIEW.txt](ai-art-reference-2026-10-13/REVIEW.txt) | 1,553 | — | 该阶段美术/地理对照与未完成项 |
| [small-ai-reference.png](ai-art-reference-2026-10-13/small-ai-reference.png) | 2,340,826 | 1506 × 1045 | 模型绘制的小图美术参考 |

## completed-islands-v1 · 首次补全环洲北侧的双洲版本

| 文件 | 大小（字节） | 图片尺寸 | 用途 |
| --- | ---: | --- | --- |
| [completed-islands.png](completed-islands-v1/completed-islands.png) | 2,526,126 | 1154 × 1363 | 首次完整双洲补全美术图 |
| [full-islands-geometry.png](completed-islands-v1/full-islands-geometry.png) | 290,278 | 1536 × 1813 | 首次补全时的真实几何参考图 |
| [geometry-guide.json](completed-islands-v1/geometry-guide.json) | 11,190 | — | 补全参考范围与几何说明 |
| [manifest.json](completed-islands-v1/manifest.json) | 648 | — | 该版本的来源、文件尺寸、哈希与状态 |
| [MAPPING-NOTES.txt](completed-islands-v1/MAPPING-NOTES.txt) | 1,945 | — | 直接在美术图上做定位映射的待办说明 |
| [PROMPT.txt](completed-islands-v1/PROMPT.txt) | 2,946 | — | 该版本完整内置生图提示词 |

## yingzhou-verified-v1 · 樱洲专项资料核查与参考图

| 文件 | 大小（字节） | 图片尺寸 | 用途 |
| --- | ---: | --- | --- |
| [manifest.json](yingzhou-verified-v1/manifest.json) | 815 | — | 该版本的来源、文件尺寸、哈希与状态 |
| [PROMPT.txt](yingzhou-verified-v1/PROMPT.txt) | 3,222 | — | 该版本完整内置生图提示词 |
| [REVIEW.txt](yingzhou-verified-v1/REVIEW.txt) | 2,141 | — | 该阶段美术/地理对照与未完成项 |
| [source-audit.json](yingzhou-verified-v1/source-audit.json) | 2,299 | — | 官方/OSM资料、桥梁、走廊与数据差异 |
| [yingzhou-audit.png](yingzhou-verified-v1/yingzhou-audit.png) | 389,866 | 1600 × 1687 | 樱洲B1～B4桥梁与C点位核查图 |
| [yingzhou-geometry.png](yingzhou-verified-v1/yingzhou-geometry.png) | 385,807 | 1600 × 1687 | 樱洲岸线、道路、桥梁、走廊参考图 |
| [yingzhou-pixel-reference.png](yingzhou-verified-v1/yingzhou-pixel-reference.png) | 3,068,871 | 1221 × 1289 | 樱洲本体像素参考图 |
| [yingzhou.wgs84.geojson](yingzhou-verified-v1/yingzhou.wgs84.geojson) | 36,291 | — | 樱洲区域要素与来源链接 |

## huanzhou-yingzhou-v2 · 完整环洲＋樱洲第二版

| 文件 | 大小（字节） | 图片尺寸 | 用途 |
| --- | ---: | --- | --- |
| [complete-geometry.png](huanzhou-yingzhou-v2/complete-geometry.png) | 321,001 | 1536 × 1813 | 完整双洲的矢量几何参考图 |
| [geometry-check.json](huanzhou-yingzhou-v2/geometry-check.json) | 553 | — | 双洲范围及边界包含检查 |
| [huanzhou-yingzhou-complete.png](huanzhou-yingzhou-v2/huanzhou-yingzhou-complete.png) | 2,869,449 | 1154 × 1363 | 完整双洲第二版美术图 |
| [manifest.json](huanzhou-yingzhou-v2/manifest.json) | 867 | — | 该版本的来源、文件尺寸、哈希与状态 |
| [PROMPT.txt](huanzhou-yingzhou-v2/PROMPT.txt) | 2,818 | — | 该版本完整内置生图提示词 |

## huanzhou-yingzhou-v3 · 最新版：长廊外观修正

| 文件 | 大小（字节） | 图片尺寸 | 用途 |
| --- | ---: | --- | --- |
| [huanzhou-yingzhou-corridor.png](huanzhou-yingzhou-v3/huanzhou-yingzhou-corridor.png) | 2,624,840 | 1154 × 1363 | 当前最新版：连续廊顶、立柱和步道 |
| [manifest.json](huanzhou-yingzhou-v3/manifest.json) | 978 | — | 该版本的来源、文件尺寸、哈希与状态 |
| [PROMPT.txt](huanzhou-yingzhou-v3/PROMPT.txt) | 2,520 | — | 该版本完整内置生图提示词 |

## reference-materials · 选定视觉参考及来源

| 文件 | 大小（字节） | 图片尺寸 | 用途 |
| --- | ---: | --- | --- |
| [provenance.json](reference-materials/provenance.json) | 1,259 | — | 风格参考的原始清单条目与来源 |
| [selected-style-reference.png](reference-materials/selected-style-reference.png) | 1,741,769 | 1024 × 1536 | 选定的晴日16-bit页面原稿，仅作风格参照 |

