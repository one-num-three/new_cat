# 02-01 全页面生图提示词档案

工具：内置 `image_gen`，每张页面单独调用；16 次生成 + 2 次单点修正。模型具体名称未由工具返回，未使用外部 API 或 CLI。

保持 visual-1.0 母版；本批是独立评审稿，不升级或覆盖冻结版本。再次生成时沿用公共风格、指定页面文本、身份可见性约束，并提供相同母版和页面参考。生成非确定性，归档提示词和参考不保证像素级重复。

## 公共风格提示词

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.

```

## 公共地图提示词

```text
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
```

## 每次实际调用

### 01 首页与加入 · 生成

选中图：`01-home.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\reports\2026-10-11\ui-review\after\home.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
SCREEN 01: 首页与加入. Reimagine the actual home screen using the master's lively flat outdoor park scene, not copying its current plain blue card. At top show the app title "猫鼠行动". Main hero: orange-white cat and small gray mouse running playfully along a curved cream path through simple grass-green foliage and clear pale-blue sky, keep faces and proportions identical to master. Integrate a large crisp heading "猫鼠行动" on a calm light area, supporting two lines "和熟人到户外" / "玩一场猫鼠追逐". Below hero create clean form section: label "你的昵称", input placeholder "先取个名字"; label "房间码", input placeholder "输入 10 位房间码". Large orange CTA "加入房间". Separate green outlined secondary "创建活动". Small footer summary "30 秒躲藏 · 6 分钟追逐". Small restrained development text link "界面调试台". Do not add permanent bottom tabs. All fields and actions fit clearly within the safe viewport without cramped text. Match supplied actual-screen reference's functional content, but improve its art direction decisively.
Input image1 is the locked character/style master; image2 is functional content reference only, not an edit target. Create a new standalone image.
```

### 02 创建活动 · 生成

选中图：`02-create.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\02-create.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
SCREEN 02 创建活动. WeChat navigation title "创建活动". Warm cream surface. Small flat cat and mouse with a venue flag illustration near the header, same master characters. Large title "组织一场追逐", subtitle "到场后确认集合点和人数". Clear compact section "本局人数" with selected picker "8 人" and a green chevron, support "2 猫 · 6 鼠". Second section "集合点与活动范围", green confirmed state "集合点已确认", secondary detail "活动范围：半径 200 米", green outlined control "重新确认位置". Short helpful line "避开车道、施工区和水边". A large orange primary "创建并邀请" anchored above safe area. Footer "30 秒躲藏 · 6 分钟追逐". No fake roomcode yet, no map gameplay positions, no invented venue marketplace. All fields should feel touchable and airy, do not fill the page with a giant illustration.
Input image1: locked style/character master. Input image2: generated home screen for the shared UI/phone-frame design bible, not an edit target. Generate ONE new standalone screen.
```

### 03 房间准备 · 生成

选中图：`03-ready.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\03-ready.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
SCREEN 03 房间准备. Nav title "房间准备". Small header with the master icon style. Heading "伙伴到齐，就出发". Sky-blue invitation block labeled "房间码", bold monospaced "A1B2C3D4E5", SMALL green outlined "复制" on the right, clearly separated from all10 code characters. Player section label "玩家准备", count "8 / 8 人". Show all eight legible list rows with small green readiness dots: "我", "小橘", "小米", "阿青", "可可", "小林", "圆圆", "阿川"; each right label "已准备". No pre-assigned team roles on this roster. Bottom concise line "人数到齐，已全部准备". Secondary small outlined "取消准备", one dominant orange primary "开始 30 秒躲藏". Footer short "2 猫 6 鼠 · 捕获目标 4 人". Keep illustration modest, eight rows and actions fit safe viewport with normal body size.
Input image1: locked style/character master. Input image2: generated home screen for the shared UI/phone-frame design bible, not an edit target. Generate ONE new standalone screen.
```

### 04 躲藏阶段 · 生成

选中图：`04-hiding-v2.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 04 躲藏阶段, cat participant. Top strip includes green/orange small role badge "猫队 · 躲藏阶段", progress "已抓 0 / 4", large clock "00:18", caption "躲藏倒计时". On the map show only the blue self position and public green venue flag, no mouse zones or enemy points. Bottom cream panel contains a modest orange-white cat calmly waiting beside a small clock motif, not placed as a map pin. Large state "鼠先躲藏", short explanation "猫请留在集合点，追逐开始后才能抓捕". No scan button during hiding. One green outlined action "队伍 · 规则". Keep map spacious, bright and uncluttered.
Input image1: locked style/character master. Input image2: generated home screen for the shared UI/phone-frame design bible, not an edit target. Generate ONE new standalone screen.
```

### 04 躲藏阶段 · 修正

选中图：`04-hiding-v2.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding.png`

`transparent_background: false`

```text
Edit ONLY the blue own-location dot in the attached hiding screen. The cat must wait at the public collection point during hiding. Remove the original blue dot from the lower-right grass entirely. Put that one blue dot immediately next to the central green flag inside the flag's small cream collection circle, with a tiny clear label "本人" that does not overlap "集合点". Preserve EVERYTHING else exactly: phone frame and portrait canvas, flat cartoon map geometry and trees/river/bridge, master cat illustration, UI type, Chinese copy, progress0/4, frozen sample clock00:18, layout, colors, button. Add no other positions or markers and no mouse intel.
```

### 05 猫队追逐地图 · 生成

选中图：`05-cat.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\05-cat.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 05 猫队追逐. Top role "猫队 · 追逐中", progress "已抓 1 / 4", large clock "04:45", caption "追逐剩余". On park map: one blue own dot labeled "本人", public green venue flag, and ONE broad translucent orange clue area with no center dot, no avatar, no tail/footprint/trail, no exact location or direction. A tiny label outside the area reads "区域线索". Bottom caption "橘色区域仅代表大致线索". One full-width orange primary "扫码确认抓捕"; small secondary text "队伍 · 规则 · 操作". No enemy coordinates, no cats/mice characters as map markers. Map open center dominates all decorative art.
Input image1: locked character/style master. Image2: generated home UI design bible. Image3: park-map/phone/UI reference: keep the SAME park geography, trees/river/bridge/collection flag, same compact top strip, same phone proportions. Generate ONE new standalone screen, not a collage. For chasing the own blue dot may move away from the public venue; it remains clearly labeled 本人. Never draw enemy points or characters on the map.
```

### 06 鼠队追逐地图 · 生成

选中图：`06-mouse-v2.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\06-mouse.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 06 鼠队追逐, normal no warning. Top role "鼠队 · 追逐中", progress "已抓 1 / 4", clock "04:45", caption "追逐剩余". Park map only blue own dot "本人" and public green venue flag "集合点"; no cat dots, no enemy areas, no alert or proximity figure. Bottom copy "留意周围环境，停下后展示动态码". One orange CTA "停下，展示动态码"; secondary "队伍 · 规则 · 操作". A tiny gray mouse head motif can appear in the role badge only, not on the map. Match cat screen components and frame exactly, but mouse badge green.
Input image1: locked character/style master. Image2: generated home UI design bible. Image3: park-map/phone/UI reference: keep the SAME park geography, trees/river/bridge/collection flag, same compact top strip, same phone proportions. Generate ONE new standalone screen, not a collage. For chasing the own blue dot may move away from the public venue; it remains clearly labeled 本人. Never draw enemy points or characters on the map.
```

### 06 鼠队追逐地图 · 修正

选中图：`06-mouse-v2.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\06-mouse-v2.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\06-mouse.png`

`transparent_background: false`

```text
Change ONLY the blue own-location dot and its 本人 callout in this attached mouse-map screen. Remove them entirely from the blue water at the upper-left. Place the SINGLE blue dot and its 本人 label on the cream walking path below and left of the central green collection flag, clearly on dry land, not on water/bridge/trees. Keep all other pixels and design invariant: portrait phone frame, park geography, header 鼠队·追逐中, captured1/4, clock04:45, bottom illustration and text, buttons, palette and flat master cartoon style. Add no enemy position, no warning or intel, and no extra blue points.
```

### 07 鼠队近距预警 · 生成

选中图：`07-alert.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\07-alert.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 07 鼠队近距预警. Same mouse screen components as 06: role "鼠队 · 追逐中", "已抓 1 / 4", "04:45", caption "追逐剩余". Map shows only blue self and green public venue flag. Bottom panel contains a pale warm orange warning band, small filled alert motif, readable exact warning "附近有猫，请注意观察"; line "停下后再操作手机". Orange action "停下，展示动态码" remains clearly visible under warning, small link "队伍 · 规则 · 操作". WARNING expresses only a coarse boolean: no cat avatar, position, meters, distance, compass arrow, radar ripple, bearing or identity. No precise enemy cue anywhere.
Input image1: locked character/style master. Image2: generated home UI design bible. Image3: park-map/phone/UI reference: keep the SAME park geography, trees/river/bridge/collection flag, same compact top strip, same phone proportions. Generate ONE new standalone screen, not a collage. For chasing the own blue dot may move away from the public venue; it remains clearly labeled 本人. Never draw enemy points or characters on the map.
```

### 08 动态抓捕码 · 生成

选中图：`08-code.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\08-code.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
SCREEN 08 动态抓捕码. Navigation "动态抓捕码". Green role badge "鼠队 · 抓捕确认". Large centered heading "停下，展示动态码". Two-line instruction "和猫当面确认后再展示" / "GPS 只作辅助校验". A large clean white bordered rounded code frame with four subtle green corner marks; INSIDE MUST BE a plainly non-scannable demonstration placeholder: dotted ring or a simple friendly check motif, exact large label "演示码", smaller "不可扫描". DO NOT draw anything resembling a real QR matrix, barcode or credential. Below it show orange small timer "15 秒有效期 · 示例" (not actual credential validity). Pale warning strip "请停在安全位置，不要跑动操作". Large green outlined CTA "返回地图". Small footer "扫码成功才算抓捕". Character art may be tiny outside the code card; do not put a mascot inside a real-looking QR. All code text stays fully readable.
Input image1 is the locked master; image2 is the home UI design bible. Create ONE complete standalone screen; do not copy text or game state from a different reference.
```

### 09 被捕状态 · 生成

选中图：`09-captured.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\09-captured.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 09 被捕出局. Top role "鼠队 · 本轮出局", progress "已抓 1 / 4", clock "04:45", caption "追逐剩余". Top small status "仅查看公开状态". Remove ALL player dots, team markers, orange intel and real-time locations; only the public green venue flag remains. Bottom cream state panel uses a small master gray mouse resting calmly, not imprisoned or harmed, with orange check ribbon. Large text "本轮已出局"; short instruction "返回集合点，等待本局结算". Only secondary green outlined "队伍 · 规则". No scan, no code, no revive, no new-round button while current round still active. Illustration should be modest and warm, map public scene remains dominant.
Input image1 is the locked master; image2 is the home UI design bible. Image3 is the same park geography and phone/map layout reference. Keep river/bridge/trees/collection flag fixed but REMOVE all blue dots and player marks for this public-only state. Create ONE complete standalone screen; do not copy text or game state from a different reference.
```

### 10 暂停状态 · 生成

选中图：`10-paused.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\10-paused.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 10 暂停, organizer view. Top role "猫队 · 已暂停", progress "已抓 1 / 4", clock "04:45", caption "计时已冻结". No live player dots, no orange clues; only public green venue flag. Bottom panel shows small master cat and mouse calmly resting together beside a pause symbol, all as panel art not map positions. Large text "本局暂停", reason "组织者暂停", instruction "请原地等待，重新定位后恢复". One dominant orange primary "恢复本局"; secondary green text "队伍 · 规则 · 操作". Do not display "继续跑" or countdown animation; frozen state must read as frozen. Cancellation stays within details, not an equally prominent main action.
Input image1 is the locked master; image2 is the home UI design bible. Image3 is the same park geography and phone/map layout reference. Keep river/bridge/trees/collection flag fixed but REMOVE all blue dots and player marks for this public-only state. Create ONE complete standalone screen; do not copy text or game state from a different reference.
```

### 11 断线重连 · 生成

选中图：`11-offline.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\11-offline.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 11 断网重连. Top badge "猫队 · 重连中", progress "已抓 1 / 4", time "--:--", caption "等待同步". All player markers, clues and directional guides absent; even self blue dot should disappear. Public park scene may be muted but stays pale and readable. Bottom light sky-blue information panel uses a small cat and mouse waiting near a broken-link/reconnecting arc, with no spinning radar. Large clear headline "连接中断，正在重连". Text "已隐藏战术位置和旧倒计时" and "请停下等待连接恢复". No scan, code, pause, resume, winner, or invented reconnect percentage. Only secondary "队伍 · 规则", with no unsafe tactical actions. Warm, reassuring and calm.
Input image1: locked master; image2: home UI design bible; image3: map layout and park geography reference. Keep the same trees/river/bridge/green public venue flag. Remove all blue player dots and orange tactical areas. Use ONLY this specified state and its exact Chinese copy, not the hiding state in the reference. ONE complete standalone screen.
```

### 12 猫队胜利 · 生成

选中图：`12-catWin.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\12-catWin.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 12 猫队胜利. Top compact strip "猫队 · 本局结束", progress "已抓 4 / 4", time field "已结束", small caption "结果已确认". Public park background only, no players or intel dots. One spacious bottom/central settlement panel. Illustration: the exact orange-and-cream master cat cheerfully holding a little grassy-green flag with check mark, gray mouse friendly nearby only if part of settlement illustration, not map position. Small inline badge "本局结算", dominant heading "猫队获胜", reason "已达到捕获目标", tiny clear summary "捕获 4 / 6 人". One orange primary "再来一局", secondary "查看对局详情". No points, coins, ranking, loot, skill rewards or client choice of winning team. Celebration restrained, no confetti storm.
Input image1: locked master; image2: home UI design bible; image3: map layout and park geography reference. Keep the same trees/river/bridge/green public venue flag. Remove all blue player dots and orange tactical areas. Use ONLY this specified state and its exact Chinese copy, not the hiding state in the reference. ONE complete standalone screen.
```

### 13 鼠队胜利 · 生成

选中图：`13-mouseWin.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\13-mouseWin.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 13 鼠队胜利. Top compact strip "鼠队 · 本局结束", progress "已抓 3 / 4", time field "已结束", small caption "结果已确认". Public park background only, no tactical markers. Same settlement panel/layout and button family as catWin. Illustration: small charcoal-gray master mouse proudly holds a grassy-green flag with a check, orange-white master cat friendly and calm as optional panel companion, no antagonistic injury. Small inline badge "本局结算", large heading "鼠队获胜", reason "追逐时间已到", summary "捕获 3 / 6 人，未达目标". One orange primary "再来一局"; secondary "查看对局详情". No 00:00 pretending game still active, no scores, rewards, skills, shop or ranking.
Input image1 is the locked master; image2 is the home UI design bible. Image3 is the same park geography and phone/map layout reference. Keep river/bridge/trees/collection flag fixed but REMOVE all blue dots and player marks for this public-only state. Create ONE complete standalone screen; do not copy text or game state from a different reference.
```

### 14 取消结算 · 生成

选中图：`14-cancelled.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\14-cancelled.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\04-hiding-v2.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 14 取消结算. Top strip "猫队 · 本局取消", progress "已抓 1 / 4", field "已结束", caption "结果已确认". Public park schematic, no real-time position or intel. Single calm cream panel: small master cat and gray mouse resting beside an unraised folded flag, no trophy, no celebration, no winner check badge. Inline small badge "本局记录", large text "本局取消", prominent clarification "不计胜负", short support "这局记录保留，下一轮使用新的对局". Orange primary "再来一局"; secondary "查看对局详情". Do not imply either team won. Match all other screen proportions and style.
Input image1 is the locked master; image2 is the home UI design bible. Image3 is the same park geography and phone/map layout reference. Keep river/bridge/trees/collection flag fixed but REMOVE all blue dots and player marks for this public-only state. Create ONE complete standalone screen; do not copy text or game state from a different reference.
```

### 15 界面调试台 · 生成

选中图：`15-dev.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\15-dev.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
SCREEN 15 界面调试台, development-only selector. Nav "界面调试台". Small master cat/mouse illustration in header, heading "每个状态，都能预览", green small pill "开发预览". Plain exact explanation "样例数据 · 不连接真实对局". Clean organized list with ample text sizes, custom filled small icons and green chevrons; two-column grouped buttons allowed to fit14 core states without tiny type. Group "活动准备": "首页与加入", "创建活动", "房间准备". Group "游戏进行": "猫队地图", "鼠队地图", "近距预警", "躲藏阶段", "动态码". Group "异常状态": "本轮出局", "暂停", "断线重连". Group "本局结果": "猫队胜利", "鼠队胜利", "取消结算". Bottom secondary "返回首页". These are preview choices, not production bottom tabs; no debug consoles, code or error traces. Short labels crisp Chinese, consistent with home layout.
Input image1 is the locked master; image2 is the home UI design bible. Create ONE complete standalone screen; do not copy text or game state from a different reference.
```

### 16 对局详情抽屉 · 生成

选中图：`16-drawer.png`。本次输出：`D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\16-drawer.png`。

输入引用（依次）：
1. `D:\cat-mouse-miniprogram\design\2026-10-09\frozen\v1\selected-icon-master.png`
2. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\01-home.png`
3. `D:\cat-mouse-miniprogram\design\2026-10-11\page-concepts-v1\05-cat.png`

`transparent_background: false`

```text
Use case: ui-mockup. Asset type: one standalone WeChat mini-program screen concept, not an implementation screenshot.
STYLE LOCK visual-1.0 / chosen 02-01: Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji. The illustration itself has no lettering or fake UI copy; the interface uses ONLY the exact Chinese text specified below.
DESIGN BIBLE for all screens: playful consumer light theme, bold rounded Chinese system-like sans-serif titles, comfortably large dark teal body type. Cream #F5FAF1 background, ink #213638, orange #F36A34 primary action, green #286B47 secondary / mouse team, pale blue #DDF3FF information panels. Flat matte vector-like surfaces, untextured crisp backgrounds, generous 24px gutters and 16px spacing, restrained 16–20px corner radii, filled custom cat/mouse/paw icons matching the master, no emoji. WeChat title bar and top-right capsule, small 9:41 status bar, clear bottom safe area. Portrait 1024x1536 canvas: ONE complete screen in a very slim charcoal rounded phone outline, centered, equal outer margins on plain warm off-white. Same phone proportion and restrained framing throughout; no perspective, no glossy hardware or heavy shadow. Content dominates the image.
CONSTRAINTS: existing pilot-0.2 only: 8 players = 2 cats + 6 mice; hide30s, chase6min, capture target4/6, elimination not revival, cancellation no winner. No shop, currency, points, skills, infection, battle weapons, invented tabs, or social feed. Short accurate Chinese copy, very readable, no tiny decorative text. One clear primary action. No desktop chrome, code, watermark, marketing annotations or multi-screen board.
Use the same master character identity and the attached generated home UI's phone frame, text weight, cream panels and buttons. The title bar is "猫鼠行动". Map occupies at least 60% of the usable screen. Draw a clean readable flat park schematic with pale-green fields, cream walking paths, restrained rounded trees at outer edges, and a clearly labeled green boundary/flag "集合点"; keep the center open. It is a concept schematic, not GPS evidence. No avatar/cat/mouse enemy pins, no enemy point under an orange area, no red location pins or compass bearing. A blue dot can mean only "本人"; green flag means public venue. Use a compact top status strip for team, target and clock; a single clear bottom action panel. Never add a decorative cat or mouse figure standing on the map as if it were a live location.
SCREEN 16 对局详情抽屉, active CAT round. Behind a SINGLE pale translucent mask show the same cat-map layout with role "猫队 · 追逐中", "已抓 1 / 4", "04:45"; map behind stays muted, no enemy points. One bottom sheet occupies lower72%, one rounded cream top edge, clear fixed header "对局详情" and SMALL right action "关闭". Sheet content shows compact team groups "猫队 · 2 人": "我", "小橘"; "鼠队 · 6 人": "小米 · 被捕", "阿青", "可可", "小林", "圆圆", "阿川". Use readable compact two-column names to avoid tiny text. Next section "最近事件": "本局开始", "追逐开始", "完成一次抓捕". Section "本局规则": "30 秒躲藏 · 6 分钟追逐", "猫抓满 4 人获胜", "取消不计胜负". Indicate internal scrolling with a subtle scrollbar, no second floating panel. At bottom show green outlined "紧急暂停", small secondary "退出本局"; only one sheet, no duplicated settlement card competing above it. Match phone frame and style of all other screens.
Input image1 is the locked character/style master; image2 is the home UI design bible; image3 is the active cat map backdrop reference. Keep one compact role strip behind a single mask and one readable details bottom sheet. The rule sentence is conditional, not a second current capture count. Create ONE complete standalone screen.
```


