# 东南大学 · 九龙湖与四牌楼晴日像素地图

制作日期：2026-10-16。沿用玄武湖 v4 的晴日公园 16-bit 像素美术风格。两校区独立制作，全部文件原目录交付，无压缩包。

## 直接查看

| 校区 | 完整美术图 | 定位核查截图 | 真实几何 | 锚点表 | 配准模型 |
|---|---|---|---|---|---|
| 九龙湖 | [jiulonghu-art.png](jiulonghu-art.png) | [双图预览](jiulonghu-review.png) | [GeoJSON](jiulonghu-reference.geojson) | [CSV](jiulonghu-anchors.csv) | [JSON](jiulonghu-registration.json) |
| 四牌楼 | [sipailou-art.png](sipailou-art.png) | [双图预览](sipailou-review.png) | [GeoJSON](sipailou-reference.geojson) | [CSV](sipailou-anchors.csv) | [JSON](sipailou-registration.json) |

实际生成尺寸：**每张 1254×1254**。提示词请求更高分辨率，但工具实际输出以此尺寸为准；没有用插值放大冒充更多细节。美术图由内置 image_gen 生成，几何底图由真实 OSM 数据绘制。原始生成文件仍在 Codex generated_images 中，项目内已保留完整副本。

## 双图交互预览

```powershell
Set-Location 'D:\cat-mouse-miniprogram\design\maps\seu-campuses-v1'
node serve.cjs
```

打开 <http://127.0.0.1:8776/>。下拉切换校区、选择地标、显示锚点及三角网。点击美术图或真实几何图，可联动查看 WGS84 经度纬度与原画像素。服务只监听本机，不获取 GPS，不上传坐标。

## 制作与锚定

1. 以大学官方校区地址确认目标：九龙湖为南京江宁区东南大学路2号，四牌楼为南京玄武区四牌楼2号。[大学官方地址页](https://www.seu.edu.cn/xqdz1/)、[教务处联系地址](https://jwc.seu.edu.cn/lxwm/list.htm)。
2. 下载公开 OSM XML，解析真实校园范围、道路、建筑、水面与运动场；根据实际校界补齐初始检索框遗漏的西侧地块。
3. 生成 2000×2000 北向真实几何底图，将其作为几何约束，玄武湖 v4 仅作为材质与风格参考，分别交给生图模型。
4. 人工匹配每校区20个具名建筑的可见屋顶／轮廓中心与 OSM 建筑顶点均值位置；建立每校区31个三角分区，双向转换点位。
5. 保存配准检查、误差报告、原始图片、源数据、提示词与回滚记录。

九龙湖重点包括李文正图书馆、纪忠楼、体育馆、教学组团、行政办公楼及分布校园四周的建筑。四牌楼重点包括绿色穹顶大礼堂、孟芳图书馆、逸夫建筑馆、体育馆，以及西侧和东侧校园组团。草地、树木与建筑材质为风格化描绘，不是逐棵树的调查数据。

### 数据与坐标

- 九龙湖请求：`https://api.openstreetmap.org/api/0.6/map?bbox=118.803,31.880,118.828,31.898`。保存7012个节点、1015条way、71个relation。
- 四牌楼请求：`https://api.openstreetmap.org/api/0.6/map?bbox=118.780,32.052,118.797,32.062`。保存5275个节点、609条way、93个relation。
- 原始文件为 `jiulonghu.osm` 与 `sipailou.osm`。源数据采集于本轮2026-10-16，不是实地测量。
- 地理输入为 **WGS84，经度在前、纬度在后**；内部使用 EPSG:3857 局部坐标，图片原点为左上角。
- `*-geometry.pgw` 与 `*-geometry.prj` **仅对应真实几何底图**；不对应生图后的 `*-art.png`。美术图必须使用分区模型转换，不能直接套用几何底图的世界文件。

## 精度及可用范围

每校区20点，共40点、62分区；控制点处重合是插值约束，不代表实测误差为零。单点留出检查 RMS 为九龙湖约 **1.57像素**、四牌楼约 **1.91像素**，详见各模型 `quality.leaveOneOut`。这些点来自同一 OSM/生成图对照过程，是图像内部一致性检查，不是独立 GPS 验证。人工点选误差粗估约10像素，屋顶中心与地面位置可能不同。

图面全部校区已绘制，但定位只在已确认控制点的凸包内生效；边缘、未确认区域返回 `null`。没有对边缘进行坐标外推。未逐条核查所有装饰性步道，也未确认每个建筑立面与真实一致。两校区均 `fieldVerified=false`，需要后续实地点采集验证后再用于真实对局位置绘制。

本轮模型 schema 为 `piecewise-affine-wgs84-art-v1`。现有小程序定位使用 GCJ-02，现有房主标定为另一种协议；本轮未自动替换运行底图、对局规则或服务端标定数据。正式接入需处理坐标系并保留授权位置逻辑。

## 接入与复用

```javascript
const mapping = require('./mapping.js');
const model = require('./jiulonghu-registration.json'); // 或 sipailou-registration.json
const landmark = model.anchors[0];
const imagePoint = mapping.geoToPixel(landmark.wgs84, model, 'WGS84');
// imagePoint.x/y 是原图像素；u/v 是0～1归一化坐标。
// 在与底图相同的相机图层应用缩放、平移、裁切。
const location = imagePoint && mapping.pixelToGeo([imagePoint.x, imagePoint.y], model);
```

## 重建、验证、回滚

- `python build-guides.py`：用已保存 OSM 重建真实几何与候选地标，需要 Matplotlib。
- `python build-registration.py`：用人工确认控制点生成两套配准，需要 NumPy、SciPy；保留所有未用于配准的候选建筑点。两脚本不编辑美术图。
- `node verify.cjs baseline.json baseline`：基线映射关闭。
- `node verify.cjs MODIFIED_FILE.json registered`：40点、248次内部往返、两校区范围外拒绝、坐标系检查与原图哈希检查。
- `node browser-check.cjs`：Playwright＋已安装 Edge，检查切换、地标、网格、移动端、基线与回滚状态，生成截图。
- Git Bash 执行 `./ROLLBACK.sh rollback-test.json` 可恢复测试副本。不带参数会将 `MODIFIED_FILE.json` 还原为未启用；刷新预览后映射关闭，原图继续显示。
- `MODIFIED_FILE.json` 是预览总开关，`data.js` 是另存的数据快照；预览实际从 JSON 读取，回滚不会被旧内嵌数据绕过。

已在独立副本上完成回滚测试；当前主配置保持 `enabled=true`。详见 [VERIFICATION.txt](VERIFICATION.txt)、[DIFF_FILE.diff](DIFF_FILE.diff)、[browser-results.json](browser-results.json)。原图哈希、全部文件清单见 [manifest.json](manifest.json)。

## 风格与后续提示词

参见 [PROMPTS.md](PROMPTS.md)。后续沿用同一晴日像素风格，以每校区的真实几何图约束构图；继续增加道路交叉点、校门地面和桥端等容易实地确认的控制点，避免仅靠屋顶推断玩家位置。换图后必须重新配准。

地理数据署名：**© OpenStreetMap contributors，ODbL 1.0**。[许可说明](https://www.openstreetmap.org/copyright)。对外展示或分发应保留署名。现有玄武湖成果保留在相邻目录 `../xuanwu-lake/`。
