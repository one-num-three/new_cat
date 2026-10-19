# 校区运行素材锁定

来源：`design/maps/seu-campuses-v1`。该交接目录原文件未修改；完整原画、配准、提示词与许可证仍在那里。

生成与验证：`node scripts/build-campus-runtime.cjs` / `--verify`。仅将原1254×1254PNG编码为质量86、4:4:4 JPEG，不缩放、裁切、重绘或重新拟合地图。运行图与源图分别登记SHA，记录在本目录manifest.json。两个运行图位于 `venue-maps/assets/` 资源分包。

同时生成双端相同的 `venue-images.js` 注册表和客户端 `campus-art-models.js`；禁止手工修改系数或用其他校区的模型覆盖。运行时模型保留输入WGS84/EPSG:3857、原模型哈希、无外推、未实地核验标记。微信采集GCJ-02，在显示层转换，不改变服务端抓捕和活动范围计算的坐标系。

界面继续使用现有晴日像素/Fusion Pixel/透明蓝爪、绿伙伴、金旗，不新增另一套设计风格。后续需要重新生成地图时复用原交接PROMPTS.md；重生成图片必须创建新图像身份与新配准，不能继续使用本版本SHA。
