# 右下角露海水修正

2026-10-16。

## 原因

此前展开面板使用right:8px、bottom:安全区+6px。整个纸卡被抬高，右边与底部留下海水。收起卡也在安全区上方，因此底边仍露蓝。

## 修改

- 展开和收起均right:0、bottom:0，米白色纸底延伸至屏幕底边，移除贴边侧的边框与圆角。
- 展开的操作区域仍96px，收起仍94px；安全区作为额外背景/底内边距，不挤压按钮。宽度仍240/58px，触点至少44px。
- 保留260ms收起吸附、固定顶部、地图手势与透明定位图标。
- `style-diff.diff` 对比本轮修改前的样式；`before/`只保存本轮相关文件，不是整个仓库回退。

## 验证

- 微信官方本地WXSS编译exit0，见compile-wxss.json。
- 地图行为与图标/布局基础回归见tests.log。
- 新增scripts/drawer-edge-review.cjs用于微信MCP实际截图检查：展开/收起纸底right=viewportWidth、bottom=viewportHeight，按钮保持在安全区上方、面板操作区不超过100px，猫鼠/原生/断线/窄屏均可取证。
- 本次MCP返回`cant find runtimeid by projectpath D:\cat-mouse-miniprogram`；只读运行时诊断相同，微信相关进程列表为空。为保留用户分屏，没有自动新开窗口。**本轮修正后的实际截图尚未获得，不记为通过。**
- 微信工具重新打开本项目并编译后，可运行：`node scripts/drawer-edge-review.cjs D:/cat-mouse-preview-evidence/2026-10-16/drawer-edge-v3-rerun`。输出放项目外，防止保存截图触发热重编译。
- 未上传、部署、修改服务端规则或进行公网压测。
