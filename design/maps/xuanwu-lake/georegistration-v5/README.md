# 环洲＋樱洲 · v5 真实地图定位映射

日期：2026-10-15。文件直接交付，不制作压缩包。

## 先看结果

- [双图核查截图](registration-review.png)：左侧原图＋映射线；右侧北向 OSM 坐标＋原画配准有效区。
- [原画完整副本](artwork-original.jpg)：1254×1254，与小程序当前 `assets/maps/xuanwu-lake-v4.jpg` **逐字节一致**。没有重新生图、换材质或覆盖原文件。
- [北向配准有效区 PNG](registered-north-up.png)：由原图三角网重采样，透明处代表没有可靠控制点覆盖，**不是缺失的地图被补完**。外部扩绘湖面、桥尽头的小岛不作真实定位依据。
- [PGW](registered-north-up.pgw)＋[PRJ](registered-north-up.prj)：与上述 PNG 同名同目录，可供 GIS 软件读取。EPSG:3857；PGW 系数由本轮网格新算，不沿用旧美术稿边界。
- [模型](MODIFIED_FILE.json)、[锚点 CSV](anchors.csv)、[真实几何 GeoJSON](reference.geojson)、[误差报告](quality.json)。

### 交互预览

```powershell
Set-Location 'D:\cat-mouse-miniprogram\design\maps\xuanwu-lake\georegistration-v5'
node serve.cjs
```

浏览器打开 <http://127.0.0.1:8775/>。仅监听本机，不读取 GPS、不上传坐标。可选择锚点、点击任意一侧联动位置、开关桥廊与岸线、显示网格、改变原画透明度、导出北向 PNG。建议将透明度降至 0 核查 OSM 几何，再升至 1 对比原画。导出不包含叠加标记；仅导出已配准区域。

用服务打开而非直接双击 HTML，可避免浏览器对本地文件读取和画布导出的限制。`MODIFIED_FILE.json` 是启动时读取的权威模型，预览不使用过时内嵌模型。

## 本轮对齐了哪些锚点

| 图上编号 | 对象 | OSM way | 控制点数 |
|---|---|---|---:|
| B1-0～1 | 樱桥两端桥面接岸处 | 776728676 | 2 |
| B2-0～1 | 白桥两端 | 776728674 | 2 |
| B3-0～1 | 月影桥两端 | 776728672 | 2 |
| B4-0～6 | 莲桥两端与折点 | 1226671818 | 7 |
| C0～7 | 长廊端点、主折角、连续折段 | 1050092971 / 1050092972 | 8 |
| H-* / H01～13（无 H04） | 环洲接桥点与轮廓 | 776728664 等 | 15 |
| Y01～05 | 樱洲轮廓转折 | 776728670 | 5 |

共 **41 点 / 72 个三角分区**。坐标源为已保存的 2026-10-12 OSM 快照，不是本日重新测绘。每点包含 WGS84 经度纬度、1254×1254 原图像素、OSM way ID、点选方法。原点在图片左上，x 向右、y 向下；归一化 u=x/1254、v=y/1254。

长廊明确按步行长廊处理。两个 OSM way 表示相对边缘，C 点用相对顶点的中点近似中轴；不是铁轨，也没有把每条边误当作两条独立步道。原画屋顶有透视，屋脊点与地面行走点仍可能存在偏差。

## 映射方法与真实精度

1. WGS84 → EPSG:3857 局部坐标。
2. 将人工确认的原图像素与真实数据点配对。
3. 地理空间 Delaunay 三角网；每个分区使用可逆仿射变换。
4. 同一个网格负责经纬度→像素及像素→经纬度。控制点凸包外返回 `null`，不外推，不将位置夹到图片边缘。

全局单一仿射拟合的误差为 **11.14 像素 RMS / 32.64 像素最大值**，所以采用分区映射。控制点插值残差接近浮点误差，这是算法约束，**不代表真实误差为零**。

### 整组留出检查（不是实地独立验证）

每次移除一整组桥／廊控制点，用剩余点拟合再预测该组，以揭示局部形变和泛化风险。最终模型仍使用所有已确认控制点。

| 留出对象 | RMS / 原图像素 | 最大 / 原图像素 |
|---|---:|---:|
| 樱桥 | 5.18 | 7.10 |
| 白桥 | 17.41 | 19.44 |
| 月影桥 | 14.07 | 16.31 |
| 莲桥 | 9.34 | 19.26 |
| 长廊 | 10.76 | 16.23 |

另一个环洲内湾岸线点约有 **33.83 像素**偏差。它曾导致网格翻折，被移出最终控制点并保留在 `quality.json`，属于诊断后留出而非盲测。岸线泛化、装饰建筑和树木均未得到逐个实测确认。图面人工点选的 ±5–8 像素是估计值，不是统计置信区间。

本轮验证：41 个控制点双向对应、288 个分区内部往返、网格 0 翻折 / 0 边交叉、范围外返回空、坐标系标识检查、原文件 SHA256 保持、浏览器交互与移动端布局。**尚未采集独立实地坐标，`fieldVerified=false`。**

## 如何接入代码

运行时可继续使用原画而不显示变形图，只将授权位置投影到原图坐标：

```javascript
const mapping = require('./mapping.js');
const model = require('./MODIFIED_FILE.json');
// 顺序是 [经度, 纬度]；输入必须已经是 WGS84。
const p = mapping.geoToPixel([118.7880209, 32.0751575], model, 'WGS84');
if (p) {
  // p.x / p.y 是原图像素；p.u / p.v 是归一化位置。
  // 再应用与底图相同的相机缩放、平移和裁切。
}
const ll = mapping.pixelToGeo([612, 455], model);
```

现有小程序使用 GCJ-02 输入及 `affine-gcj02-v1` 标定协议；本模型为 `piecewise-affine-wgs84-art-v1`。**本轮没有直接替换该协议、产品页面、授权位置逻辑或服务端标定数据。** 接入前要显式处理坐标系，并使用至少 2～3 个不参与拟合的实地点复核；保持既有房主标定和服务端权限。切勿把 OSM WGS84 当作微信 GCJ-02，也不要把插值的低残差提交成真实采集精度。

## 重建、测试与回滚

- 构建：`python build.py`，需要 NumPy、SciPy；读取已有 OSM XML 与当前运行图片；重写本目录模型与锚点，不修改源图。此脚本只处理坐标，不编辑位图。
- 基线：`node verify.cjs baseline.json baseline`。
- 配准：`node verify.cjs MODIFIED_FILE.json registered --report`。
- 浏览器：`node browser-check.cjs`，需要 Playwright 和已安装的 Edge；使用临时本机 HTTP 服务，生成截图与 Canvas 配准 PNG。
- 回滚：在 Git Bash 中 `./ROLLBACK.sh rollback-test.json` 只恢复副本；无参数执行则恢复当前 `MODIFIED_FILE.json` 为未启用。
- 回滚后重开／刷新页面，原图仍显示，映射与北向导出关闭；浏览器不自动热更新已加载状态。
- 已完成副本回滚实测，最终 `MODIFIED_FILE.json` 仍为 `enabled=true`。PGW 和导出 PNG 是历史输出文件；回滚不删除它们。

完整命令、输入、字面输出、退出码见 [VERIFICATION.txt](VERIFICATION.txt)。变更对比见 [DIFF_FILE.diff](DIFF_FILE.diff)。

## 文件与来源

本轮目录内 `manifest.json` 包含文件 SHA256（不自包含），`test-results.json` 为数学测试，`browser-results.json` 为浏览器测试。`README-before-v5.md` 与 `FILE_INDEX-before-v5.md` 是更新总索引前的备份。

数据：© OpenStreetMap contributors，ODbL 1.0。[署名与许可](https://www.openstreetmap.org/copyright)。真实图形来自 `../source-v1/osm-source.osm`；[樱桥记录](https://www.openstreetmap.org/way/776728676)、[长廊边缘记录](https://www.openstreetmap.org/way/1050092971)。美术来源为当前已选 v4，并以 SHA256 绑定，较早 v3 不能套用这套像素控制点。

### 后续复用提示词

> 使用 georegistration-v5 的固定 1254×1254 v4 原图和模型；保持原图字节与美术风格不变。只调整经独立证据确认的控制点，显式区分 WGS84 与 GCJ-02；重跑网格翻折／交叉／双向往返和整组留出测试。对桥口、长廊地面端点增加独立实地检查，不把插值误差充当测绘精度。保留旧版本，输出可核查的锚点表与误差报告。
