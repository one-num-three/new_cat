# 猫鼠行动 · 固定生图提示词 v1

**所有后续素材先引用同一张母版**：`design/2026-10-09/frozen/v1/selected-icon-master.png`。图片生成工具传 `referenced_image_paths` 指向该文件。已定稿素材见同目录 `art-manifest.json` 的 SHA-256。未经设计版本升级，不改母版、角色配色、轮廓语言和现有透明源图；新图作为新文件加入。

## 每次生成必带的基底提示词

> Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji, no lettering or fake UI copy.

## 透明单体素材

`transparent_background: true`，在基底后附：

> Create ONE isolated transparent PNG of [对象及动作], square composition, centered with 12% transparent margin. One clear silhouette with no card, scenery, map, border, text or ground shadow. It must remain legible at 48 px. Do not include hidden location clues, QR codes or numerical gameplay values.

适用：角色、房间状态、被捕、重连、胜利与未来技能图标。一次只生成一枚，原图存 `design/`，运行端从原图生成带尺寸上限的副本。技能另加 `Future concept only; do not depict a working shop button or exact enemy location.`

## 页面概念稿

`transparent_background: false`，在基底后附：

> Design a 390x844 WeChat mini-program screen concept for [首页/准备/地图/动态码/结算]. Clear readable Chinese sans-serif hierarchy, sunlight-friendly contrast, safe-area spacing. Keep the map dominant when present: team, capture target and time at top, one main action at bottom; roster and event details in a drawer. Use the attached cat/mouse character style, not a new mascot. Treat all numbers and labels as placeholders for code-driven live state. Do not draw exact enemy coordinates, static catch QR codes, fictional skills or purchase controls.

页面图只用于布局评审；玩家、倒计时、二维码、胜负和区域线索继续由真实数据绘制。

## 动效分镜

在基底后附：

> Produce 4 clean keyframes of [状态变化], same fixed camera and identical character design. 0 ms resting state, 80 ms transition, 180 ms settled state, 300 ms readable final state. Motion is a single short fade, slide or scale under 8%; no flashing, spinning scan, particle storm or infinite bounce. The final frame must preserve the factual text area. Animation must start only after the server-authorized state is received.

静态关键帧用于评审；实际小程序优先用原生样式和状态机实现。不从图里提取假的技能效果或实时情报。

## 每次出图后检查

1. 和母版并排检查橘猫、小鼠、天空蓝与草地绿是否一致；图标缩到 48 px 仍可辨认。
2. 透明图检查 RGBA、边缘和浅/深背景。概念稿检查小屏、大字体、安全区、日光可读性。
3. 检查图中无敌方精确坐标、伪二维码、错误规则、错误赢家或未启用技能入口。
4. 保存原图、用途与 SHA-256；更换已定稿图须提升视觉版本并更新 manifest、运行副本和引用，不静默覆盖。
