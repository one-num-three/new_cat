# 轨迹分享海报 · 不规则透明边框 v4

按用户最终确认恢复原版不规则草地／花朵边框。中央地图区域为真实透明 alpha，未使用方形边框或浅绿色占位块。三个地点共用同一套边框，地点名分别写入对应版本。

## 交付文件

| 地图 | 程序使用：透明边框 PNG | 仅供查看：无轨迹合成预览 |
|---|---|---|
| 玄武湖 | [xuanwu-overlay.png](xuanwu-overlay.png) | [xuanwu-preview.png](xuanwu-preview.png) |
| 九龙湖 | [jiulonghu-overlay.png](jiulonghu-overlay.png) | [jiulonghu-preview.png](jiulonghu-preview.png) |
| 四牌楼 | [sipailou-overlay.png](sipailou-overlay.png) | [sipailou-preview.png](sipailou-preview.png) |

全部为941×1672。overlay的中间地图孔完全透明；preview已在底部放入现有原地图，方便检查构图，正式导出请使用overlay。

已清除预画轨迹、检查点、START／FINISH及所有示例数字／单位。保留“行走距离、追逐时长、估算热量”标签；数字由程序绘制，缺少的数据保持空白。

## 程序合成顺序

1. 画完整原地图：海报上的矩形为 x=0、y=328、width=941、height=941。原地图1254×1254等比缩放到941×941。顶部和底部的少量地图被原版不规则前景遮挡，不能对地图额外裁切或拉伸。
2. 在地图层上绘制真实轨迹。坐标归一化后：posterX=0+u×941；posterY=328+v×941。
3. 将对应地点的透明overlay覆盖在地图和轨迹之上。这样轨迹不会穿进标题、草地和底部数据卡。
4. 最后按layout.json中的metrics位置绘制真实距离、追逐时长、估算热量；按实际数据格式附上单位。估算热量有值时添加必要体重／估算说明，未知则留空。

runtime-layer.cjs提供纯函数layers、drawRoutes和drawMetrics，使用Canvas 2D接口，可由小程序导出流程复用。它不取GPS、不请求服务端，也不自行判断玩家权限。应传入结算后已授权的本人轨迹；房主的全员导出沿现有权限执行。

已读取现有utils/track-export.js：暂停／阶段改变／segment改变／超过10秒缺口必须断线；无效点、超出配准范围的点也断线，避免将两段轨迹错误连成直线。runtime-layer.cjs保留这些断线规则。

## 接入现有项目

三个实际imageId分别为xuanwu-v4、seu-jiulonghu-v1、seu-sipailou-v1，源路径和SHA256见layout.json。使用项目当前venue-images.js的原图，与其模型绑定；预览不会改写原地图。

传给layers的project函数应复用项目已有投影：优先实际房间标定模型的geo-registration.project；没有房间标定时，按既有规则使用osm-art-registration.project(point,'gcj02',imageId)。实际存在但无效的房间模型返回空，不能绕过校验退回另一模型。传入GCJ-02轨迹必须走已有坐标转换逻辑，不能直接当WGS84。

```javascript
const {layers,drawRoutes,drawMetrics}=require('./runtime-layer.cjs');
const runs=layers(authorizedPlayerPoints,project,layout.mapRect);
ctx.drawImage(mapImage,0,328,941,941);
drawRoutes(ctx,runs);
ctx.drawImage(overlayImage,0,0,941,1672);
drawMetrics(ctx,layout.metrics,{
  distance:formattedDistance,
  duration:formattedChaseTime,
  calories:formattedEstimatedCalories,
  note:calorieAssumptionText
});
```

这里交付透明素材、固定坐标参数及导出辅助函数；现有正式轨迹页的按钮与服务端流程留给“实现猫鼠游戏试点版本”会话接入，不覆盖其正在进行的工作。

## 来源与验证

overlay-source.png来自内置image_gen局部编辑；PROMPT.txt保存完整提示词。build.cjs使用Sharp按固定坐标组合原地图和前景，只添加地点标签，不重新绘制地图。node build.cjs可重建。

VERIFICATION.json保存透明像素计数、源图哈希和辅助函数检查。三个预览均已目视核查，未预置路线、起终点或数值。地图数据 © OpenStreetMap contributors，ODbL；地图版权信息应在导出元信息／产品说明继续保留，参考 https://www.openstreetmap.org/copyright 。

全部文件直接保留，无压缩包。v3方框稿已停用，以本目录v4为准。
