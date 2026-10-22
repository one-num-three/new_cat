# 轨迹分享海报 v2

本版保留“行走距离、追逐时长”，将“足迹点”统计替换为“估算热量”，沿用原版晴日像素地图与猫鼠角色。内置 image_gen 编辑，完整提示词见 PROMPT.txt。

- trajectory-share-poster.png：PNG 原稿。
- trajectory-share-poster.jpg：分享用 JPG。
- VERIFICATION.json：实际尺寸、字节数、SHA256 和热量计算。

## 示例数据及估算口径

海报显示 3.2 km、42 分钟、约160千卡，均为设计示例。热量默认体重60kg，假设42分钟均在平路行走；平均速度约4.57km/h（2.84mph），采用中速平路行走 MET=3.8。

使用近似公式：总能量（kcal）≈MET×体重（kg）×时长（小时）。3.8×60×42/60=159.6，海报取约160千卡。此为含静息代谢的总能量估计，不是净活动热量；不依据追逐名称额外提高强度。实际记录中的等待、停留、跑动和地形变化需分段处理，不能把整场持续时间一律按行走计算。

海报已标注“示例数据”“示意轨迹 · 非真实记录”“热量按60kg体重估算”。接入产品时应优先使用用户自愿提供的体重；缺省60kg须保留估算标记，可使用“千卡 / kcal”单位。

依据：[Compendium Walking，17190中速平路行走3.8MET](https://pacompendium.com/walking/)；[单位换算1MET≈1kcal/kg/hr](https://pacompendium.com/unite-conversions/)。

旧版保存在 ../trajectory-share-poster-v1/，无压缩包。
