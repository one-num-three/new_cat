# 技能视觉库（概念，当前试点未启用）

这组素材遵循已选定的 `02-01` 明亮扁平卡通图标风格。`PROJECT_PLAN.md` 记录了历史首发道具“隐身”和未上线的鹰眼、金身、轰炸、加速、雷达；后续游戏审计把技能从 `pilot-0.2` 标准玩法中移除。本目录只供设计评审和未来规则探索，不代表已有购买、冷却、作用范围、持续时间或服务端技能裁决。

| 历史名称 | 透明 PNG | 动效 SVG | 视觉表达 |
| --- | --- | --- | --- |
| 隐身 | [invisible.png](source/invisible.png) | [invisible.svg](motion/invisible.svg) | 鼠轮廓渐隐 |
| 鹰眼 | [eagle-eye.png](source/eagle-eye.png) | [eagle-eye.svg](motion/eagle-eye.svg) | 宽域观察，不画敌方精确点 |
| 金身 | [golden-body.png](source/golden-body.png) | [golden-body.svg](motion/golden-body.svg) | 柔和保护圈 |
| 轰炸 | [bombard-area.png](source/bombard-area.png) | [bombard-area.svg](motion/bombard-area.svg) | 改画成非武器的“区域标记”；名称和规则待审 |
| 加速 | [speed.png](source/speed.png) | [speed.svg](motion/speed.svg) | 短动线 |
| 雷达 | [radar.png](source/radar.png) | [radar.svg](motion/radar.svg) | 宽域扫描，不画敌方坐标 |

[技能页预览](skill-panel-preview.png)与[可编辑分层 SVG](skill-panel-layered.svg)：背景、标题、六张卡和底部说明是命名图层；每张卡中的 PNG 图标为独立 `<image>` 元素，可替换或隐藏。SVG 内嵌原始 PNG 数据，单文件可打开。`build_assets.py` 可从 `source/` 重建分层稿和动效 SVG，不改动图标像素。

六段动效是可播放的 SVG，浏览器打开可查看轻微位移、淡化或脉冲。它们是视觉提案，没有接入微信端，也未测真机性能与减少动态效果。实现时应由服务端授权状态触发，不要把动画本身当作技能生效或敌方位置证据。金身、轰炸等复杂技能需先建立新的规则版本并验证线下判定，再考虑启用。

当前只保存在 `design/`；发布包中不包含这些技能素材。模型原图透明边缘在深色底可能有少量杂色，运行时还需在目标尺寸、深色底和户外日光下重新检查。
