# 轨迹亮点气泡 · 左右边缘自适应透明贴图

日期：2026-10-21。内置 image_gen 生成，延续原海报奶油白／深松绿像素气泡。两个内容各有两个方向，共四个独立透明 PNG。仅气泡尾巴方向变化，中文始终正向；不使用整体翻转。

| 内容 | 靠近左边使用：尾巴在左下，主体向右展开 | 靠近右边使用：尾巴在右下，主体向左展开 |
|---|---|---|
| 你在这里跑得最快 | [fastest-edge-left-320.png](fastest-edge-left-320.png) | [fastest-edge-right-320.png](fastest-edge-right-320.png) |
| 你在这里离猫最近 | [closest-edge-left-320.png](closest-edge-left-320.png) | [closest-edge-right-320.png](closest-edge-right-320.png) |

每张另有640宽版本及保留的original原稿；宽高比以manifest.json为准，显示时保持比例。全部保留真实alpha透明通道，无地图、点标记、底色方块或影子。完整提示词在prompts.json。

## 程序接入

manifest.json记录每张尾巴尖端的归一化anchor和可见范围visibleBounds。尖端应落在真实地理点上，不能用整张图片中心定位。

```javascript
const {place}=require('./placement.cjs');
const placement=place('fastest', projectedPoint, mapViewport, manifest, 320, 8);
// mapViewport={x,y,width,height}，与projectedPoint使用同一个坐标系。
// placement.file选择左右版本；x/y/width/height可直接绘制。
// 地理点不动。必要时气泡移位，leader连接原地理点与气泡尖端。
```

placement.cjs是独立布局辅助函数，无GPS/服务端读取，无项目依赖。它比较两个方向的越界程度，正常情况下左侧点选edge-left、右侧点选edge-right。极靠边或靠顶部时，仅移动气泡使可见部分留在安全边距内；真实点保持不变，并返回leader供程序补画连接线。空间窄时等比缩小，屏幕外的地理点返回null。

**不要对带字PNG使用scaleX(-1)、flip或flop**。本目录两个方向已分别生成，无需再镜像文字。文件名中的left/right指屏幕边缘，不是主体相对锚点的位置。

气泡数据仍来自实际有效最快点／赛后已授权最近猫摘要；没有有效数据时不显示。两个气泡相互遮挡的避让、页面相机变换与具体导出按钮由现有实现会话接入，本辅助函数只处理单个气泡的边缘布局。

## 验证与文件

- node export.cjs：重导出320/640贴图并生成manifest，原图哈希保持。
- node verify.cjs：检查四套素材真实alpha、文件哈希、120组边缘布局、方向切换、尖端地理点不变、屏幕外返回空。
- VERIFICATION.json：实际验证结果。

交付目录直接保留，不制作压缩包。已交给“实现猫鼠游戏试点版本”会话接入。
