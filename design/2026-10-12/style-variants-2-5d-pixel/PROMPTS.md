# 猫鼠行动：2.5D 与像素风概念图

日期：2026-10-12
生成方式：内置 image_gen；使用 imagegen-frontend-mobile 工作流。
4 张图均为 1536 × 1024，均已复制并读取验证，源图和项目副本 SHA-256 一致。

## 交付图

- 01_2.5D_软陶微缩公园.png
- 02_2.5D_亚克力城市积木.png
- 03_像素_晴日16bit冒险.png
- 04_像素_复古掌机行动.png

这些是视觉探索概念图，地图为生成式地理示意，不是实时地图数据。第 03 图的“抓住所有老鼠”“收集线索”小字偏离 pilot-0.2；当前玩法仍按达到抓捕目标、鼠方无收集任务理解。现有程序与已选美术基线保持原样。

## 01 / 02 的共同提示词

```text
Use case: ui-mockup.
Create a high-resolution, carefully art-directed Chinese MOBILE PRODUCT CONCEPT BOARD for the existing WeChat mini-program "猫鼠行动": a real-world outdoor cat-and-mouse chase for 6–12 friends. This is a coherent functional mobile app, not a website, an actual video-game virtual world, or a poster inside a phone.

Composition: wide landscape board with exactly THREE large, equally scaled, upright portrait phones in one row. Thin subtle charcoal frames, completely visible, equal gutters and outer margins. Phones occupy almost all canvas height and about 85% of width; UI content remains the hero. Small overall Chinese style title only, restrained supportive studio backdrop. Each phone has correct safe areas and small WeChat top-right capsule, no extra tab bar. Same design system and consistent type scale across all screens. Short, large, crisp Chinese text with deep contrast.

Screens left to right:
1) Room preparation. Header "房间准备". A gorgeous visual header with orange-white CAT and gray MOUSE playing together, cat has pointed ears, mouse has round ears. Room code "7K3P5" and copy glyph. Team ratio "2猫 · 6鼠". Exactly eight clear player avatars in a compact 2 by 4 roster. Footer single large button "定位并准备". Supporting label "8人已加入". Avoid extra copy.
2) Cat team's LIVE map. Header "猫队". Top compact status with "04:32" and "已抓捕 3/4" (3 captured out of target 4; no claim all six must be captured). Large genuine navigable geographic vector map of a park with plausible connected roads/trails, land and water, just 2–3 Chinese landmark names. Show ONE broad orange translucent clue area clearly labeled "线索区域". NO mouse dots, enemy avatar, enemy direction or enemy exact coordinates. The only point allowed is a small blue self-position OUTSIDE the clue area labelled "我". Dominant bottom button "扫码确认抓捕".
3) Mouse team's LIVE map. Header "鼠队", timer "04:32". Same genuine vector geographic map area. Only blue self location. ONE clear text-only notice "猫已接近" above map, with NO cat pin, cat direction, cat distance, colored threat region, arrows toward enemies, or safe zones. Footer only the large action "展示动态码". Do not draw an actual QR pattern or code; this is the entry button.

No skill, shop, score leaderboard, revive, weapons, radar, currency, new modes, chat or invented mechanics. No teammate-position strip. Maintain these product facts strictly. Real map data stays clean, flat and legible even when the rest of the UI is highly stylistic. Three screen compositions have different purposes, not duplicate templates. This should feel daring, inventive, tactile and professional, not generic rounded-card UI.
```

## 01 追加方向

```text
Visual direction: 2.5D / ISOMETRIC SOFT CLAY MINIATURE. Not flat cartoon, not pixel art. Rounded toy-like orange-white cat and gray mouse in a shallow isometric miniature park header, visible top-and-side faces, matte soft-touch silicone surfaces, gentle ambient occlusion and warm directional sun. Fresh pistachio, buttery cream, vivid tangerine CTA, sky cyan. Roster avatars are tiny raised clay medallions with crisp labels. Timer is embossed on a thin pebble-like instrument bar, primary action feels like a pressable molded paddle. The real geographic map is clean planar vector and unobstructed, decorated only by shallow extruded NON-INTERACTIVE park-building forms at the header edge, never fake 3D road geometry. Overall friendly contemporary designer collectible toy aesthetic, spacious and calm, nuanced material rendering, not childish visual overload. Name above board "2.5D / 软陶微缩公园".
```

## 02 追加方向

```text
Visual direction: 2.5D ISOMETRIC ACRYLIC CITY MODEL, radically different from clay. Sophisticated playful industrial product design using frosted acrylic sheets, translucent amber and ultramarine solid blocks, cool white ceramic surfaces and dark ink technical typography. Clearly visible shallow thickness and subtle isometric extrusion, precision-machined edges, beautiful controlled caustic shadows. Cat/mouse are simple block-built recognizable mini figures. The room code is a stacked physical ticket panel and player tokens occupy a neat pegboard-like grid. Map HUD uses thin acrylic raised perimeter rails rather than floating card stacks; the actual vector geographic map remains planar, high-contrast and readable. Orange clue region is transparent, not a building, with zero exact enemy pins. Large square-cut action paddle. This is premium architectural maquette / designer toy direction, not glassmorphic gradients, not cybersecurity or a dark fintech app. Name above board "2.5D / 亚克力城市积木".
```

## 03 最终实际提示词

```text
为《猫鼠行动》微信小程序生成“晴日16-bit像素冒险”产品概念图。横版高清，三台完整手机并排等大、边距整齐：房间准备、猫队地图、鼠队地图。整体必须是真正清晰像素美术：统一像素网格，硬边缘，16-bit精致猫鼠精灵、像素公园装饰、阶梯式按钮、少量抖色；奶油白+草绿+天空蓝+橙色。不要3D、不模糊、不矢量假像素。中文功能文字用清晰大号黑体，不牺牲阅读。左屏橘白猫和灰鼠的像素公园场景，房间码7K3P5、2猫·6鼠、8人已加入、八个头像、定位并准备。中屏猫队04:32、已抓捕3/4，地图为有真实地理逻辑的公园街路/步道和湖泊，只在地图添加宽泛橙色“线索区域”，不显示任何敌方精确点，底部“扫码确认抓捕”。右屏鼠队04:32、只显示蓝色本人定位以及文字警示“猫已接近”，绝无猫的位置/方向/范围，底部“展示动态码”按钮，不画二维码。三屏字体、图标、按键同一系统，微信安全区，移动端易用。不要商城、技能、排名、武器、雷达或虚构地图关卡。版面小标题“像素 / 晴日16-bit冒险”，克制背景，手机内容为主。
```

## 04 最终实际提示词

```text
为中国微信小程序《猫鼠行动》生成一张全新移动端产品概念图，风格是“复古掌机像素风”，与明亮彩色像素公园风明显区分。横版高清，3台等大完整竖手机并排，细黑边框，安全区和微信右上角胶囊，内容占主要画幅。极精致四五色像素UI：奶油白、深墨绿、黄绿、橙色，清晰硬边像素猫鼠小精灵、点阵计时数字、阶梯直角边框、薄L形信息轨、方形大按键，克制怀旧掌机感，不做3D场景、不模糊、不加重扫描线。中文功能字用清晰大黑体。
左屏房间准备：像素猫鼠小插画，房间码7K3P5，2猫·6鼠，8人已加入，八个像素头像，底部定位并准备。
中屏猫队：倒计时04:32、已抓捕3/4；清晰的平面真实地理地图逻辑，公园道路、步道、湖泊；仅一块宽泛橙色线索区域，不展示敌方精确点。唯一蓝点为本人。底部扫码确认抓捕。
右屏鼠队：04:32，只显示蓝色本人定位及文本警示“猫已接近”；绝无猫的点、范围、方向、距离，没有安全区；底部展示动态码按钮，不画真实或模拟二维码。
不要额外玩法、能力、积分、任务、商店、排行榜、武器、雷达。猫队抓捕目标是4个，不写抓捕全部；鼠队不用收集线索。页面文字简洁准确，三屏同一系统且每屏有不同布局，户外清晰可读，真正专业移动产品设计。画幅小标题“像素 / 复古掌机行动”，背景克制。
```

