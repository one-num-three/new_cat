# 猫鼠行动 · 四风格全页面初步定稿 v1

## 交付

- 4套风格，每套15个独立页面／状态，共60张选定PNG，均为1024×1536完整手机图。
- index.html：离线图册，支持按风格、按页面比较、放大原图。
- manifest.json：选定版本路径、尺寸、SHA-256及来源。
- jobs.json：60次完整生成提示词与选定文件；revision-prompts.json：17张校订提示词。
- 各图片同名.json记录实际提示词和来源；-v2.png为校订版，原稿保留。
- 内置image_gen生成。图册仅浏览图片，不是小程序实现。

## 视觉系统

| 风格 | 视觉基调 | 重点 |
|---|---|---|
| 城市导视 | 黄黑白、橙猫蓝鼠、导视箭头、大数字 | 户外读数、地图与动作优先 |
| 2.5D亚克力积木 | 象牙白、透明斜边、螺钉、低多边形角色 | 亲和立体、真实玩具感 |
| 晴日16-bit像素 | 奶油底、明亮绿蓝、橙色强调 | 公园冒险与轻快像素 |
| 复古掌机像素 | 米白深绿、低饱和地图、橙色强调 | 怀旧与克制的方格节奏 |

## 页面清单

| 编号 | 页面／状态 | 路由 | 四风格选定图 |
|---|---|---|---|
| 01 | 首页与加入 | pages/index/index | [城市导视](01-wayfinding/01-home.png) / [2.5D亚克力积木](02-acrylic/01-home.png) / [晴日16-bit像素](03-pixel-day/01-home.png) / [复古掌机像素](04-pixel-retro/01-home.png) |
| 02 | 创建活动 | pages/room/room?mode=create | [城市导视](01-wayfinding/02-create.png) / [2.5D亚克力积木](02-acrylic/02-create-v2.png) / [晴日16-bit像素](03-pixel-day/02-create.png) / [复古掌机像素](04-pixel-retro/02-create.png) |
| 03 | 房间准备 | pages/room/room | [城市导视](01-wayfinding/03-ready.png) / [2.5D亚克力积木](02-acrylic/03-ready.png) / [晴日16-bit像素](03-pixel-day/03-ready-v2.png) / [复古掌机像素](04-pixel-retro/03-ready-v2.png) |
| 04 | 猫队追逐地图 | pages/map/map?devPreview=cat | [城市导视](01-wayfinding/04-cat-v2.png) / [2.5D亚克力积木](02-acrylic/04-cat.png) / [晴日16-bit像素](03-pixel-day/04-cat.png) / [复古掌机像素](04-pixel-retro/04-cat.png) |
| 05 | 鼠队追逐地图 | pages/map/map?devPreview=mouse | [城市导视](01-wayfinding/05-mouse-v2.png) / [2.5D亚克力积木](02-acrylic/05-mouse-v2.png) / [晴日16-bit像素](03-pixel-day/05-mouse-v2.png) / [复古掌机像素](04-pixel-retro/05-mouse.png) |
| 06 | 鼠队近距预警 | pages/map/map?devPreview=alert | [城市导视](01-wayfinding/06-alert.png) / [2.5D亚克力积木](02-acrylic/06-alert-v2.png) / [晴日16-bit像素](03-pixel-day/06-alert.png) / [复古掌机像素](04-pixel-retro/06-alert.png) |
| 07 | 躲藏阶段 | pages/map/map?devPreview=hiding | [城市导视](01-wayfinding/07-hiding.png) / [2.5D亚克力积木](02-acrylic/07-hiding.png) / [晴日16-bit像素](03-pixel-day/07-hiding-v2.png) / [复古掌机像素](04-pixel-retro/07-hiding.png) |
| 08 | 动态抓捕码 | pages/qrcode/qrcode | [城市导视](01-wayfinding/08-code.png) / [2.5D亚克力积木](02-acrylic/08-code-v2.png) / [晴日16-bit像素](03-pixel-day/08-code.png) / [复古掌机像素](04-pixel-retro/08-code.png) |
| 09 | 被捕与观战 | pages/map/map?devPreview=captured | [城市导视](01-wayfinding/09-captured.png) / [2.5D亚克力积木](02-acrylic/09-captured.png) / [晴日16-bit像素](03-pixel-day/09-captured.png) / [复古掌机像素](04-pixel-retro/09-captured.png) |
| 10 | 暂停状态 | pages/map/map?devPreview=paused | [城市导视](01-wayfinding/10-paused.png) / [2.5D亚克力积木](02-acrylic/10-paused.png) / [晴日16-bit像素](03-pixel-day/10-paused.png) / [复古掌机像素](04-pixel-retro/10-paused.png) |
| 11 | 断线重连 | pages/map/map?devPreview=offline | [城市导视](01-wayfinding/11-offline-v2.png) / [2.5D亚克力积木](02-acrylic/11-offline.png) / [晴日16-bit像素](03-pixel-day/11-offline.png) / [复古掌机像素](04-pixel-retro/11-offline.png) |
| 12 | 猫队胜利 | pages/map/map?devPreview=catWin | [城市导视](01-wayfinding/12-cat-win-v2.png) / [2.5D亚克力积木](02-acrylic/12-cat-win.png) / [晴日16-bit像素](03-pixel-day/12-cat-win.png) / [复古掌机像素](04-pixel-retro/12-cat-win.png) |
| 13 | 鼠队胜利 | pages/map/map?devPreview=mouseWin | [城市导视](01-wayfinding/13-mouse-win.png) / [2.5D亚克力积木](02-acrylic/13-mouse-win.png) / [晴日16-bit像素](03-pixel-day/13-mouse-win.png) / [复古掌机像素](04-pixel-retro/13-mouse-win.png) |
| 14 | 取消结算 | pages/map/map?devPreview=cancelled | [城市导视](01-wayfinding/14-cancelled-v2.png) / [2.5D亚克力积木](02-acrylic/14-cancelled.png) / [晴日16-bit像素](03-pixel-day/14-cancelled.png) / [复古掌机像素](04-pixel-retro/14-cancelled.png) |
| 15 | 对局详情抽屉 | pages/map/map?drawer=true | [城市导视](01-wayfinding/15-details-v2.png) / [2.5D亚克力积木](02-acrylic/15-details-v2.png) / [晴日16-bit像素](03-pixel-day/15-details-v2.png) / [复古掌机像素](04-pixel-retro/15-details-v2.png) |

覆盖当前用户流程与关键状态。开发调试页pages/dev/dev不属于用户产品页面；相机、权限弹窗使用平台界面。

## 产品口径

- 10位房间码A1B2C3D4E5；8人、2猫6鼠；阵营在开始后分配。
- 30秒躲藏、6分钟追逐；猫留集合点等待。
- 猫捕获4人获胜；时间结束未达标则鼠胜；取消不计胜负。
- 猫只见宽区域线索；鼠只见文字近距提醒，不展示敌方位置。
- 动态码15秒有效；图中演示码为视觉占位。
- 出局只看公开状态；暂停冻结计时；断线显示--:--等待同步。

## 校订

17张图片另存v2，修正旧参考的胜利文案、无依据在线数、队伍人数、阵营提前分配、详情指标和事件时间；移除躲藏地图上的敌方标记；统一主要鼠队按钮的蓝色语义，复古款保留自身橙绿语汇。

## 后续交接

本轮是完整视觉方向初稿，不是开发切图或逐像素规范。各状态的地图构图、插画和局部间距仍有生成图差异；选定方向后，继续统一按钮高度、字体、抽屉比例及地图容器。示意地图不承担真实导航，运行版使用原生地图数据、坐标与活动边界。

## 可复用校订提示词

~~~text
对所附【风格】【页面】做局部校订：仅修改【字段/区域】为【目标内容】。
保持手机框、主配色、字级、角色、布局和其他文案不变。
输出1024×1536独立完整页面。10位房间码、4人捕获目标、15秒动态码口径不变。
~~~
