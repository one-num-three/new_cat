# 九龙湖全校参考覆盖与边界图 · 2026-10-18

## 已完成

在原23个地标外补8个保存OSM道路路口/桥端，形成31点/53三角分区。运行模型已切v3，原画、JPEG、两校区图像身份及原23地标不变。梅园反馈坐标仍落原图(1076.066630,967.308461)。只更新客户端参考网与开发模拟入口，没有修改服务端活动范围/权限/规则，也没有部署线上服务。

- [清晰区域边界图](campus-boundary.png)：绿色为保存校园校界，蓝色为当前有限定位参考覆盖。
- [地理源图与艺术图控制网对照](coverage-review.png)：另显示红色旧覆盖及网格，供核对遗漏来源。
- [独立运行投影覆盖结果](coverage-verification.json)：86独立顶点、1319沿界样本、24625校内经纬网格样本，0遗漏/图外点；其中5210个采样旧v2不覆盖。重复顶点与边界采样未去重，因此5210不是独立地点数量或面积百分比。
- 构建器Mercator采样为1320沿界/24674内点，与运行验证经纬网格不是同一采样。所有校界顶点位于有限凸包内，提供整个保存多边形被覆盖的几何保证；密网格是额外运行核验。
- 无三角形折叠、无图面网边交叉；原23个地标精确保持，梅园7B/6B两个未拟合检查点约1.18/2.91px。

## 本地复核

```powershell
node scripts/verify-jiulonghu-coverage.cjs
& 'C:/Users/Keke_/AppData/Local/Programs/Python/Python313/python.exe' scripts/build-jiulonghu-registration.py --verify
node scripts/build-campus-runtime.cjs --verify
& 'C:/Users/Keke_/AppData/Local/Programs/Python/Python313/python.exe' scripts/review-jiulonghu-coverage.py
npm --prefix cat-mouse-server test
```

## 使用

微信开发工具导入项目根目录 `D:\cat-mouse-miniprogram`，重新编译。首页→场地地图→九龙湖→准星获取实际GCJ-02本人位置；手机继续读取真实GPS，不需要新增后端部署。电脑开发台新增“九龙湖 · 东北校界模拟”，场景必须develop＋devtools且显式开启；屏上标注模拟，不上传/保存/裁决。

## 验证记录

`tests-initial.log`保留第一次完整回归的两项失败：新“北”字未进字体子集、旧fixture仍要求“超出”文案。补字体和同步新文案的fixture后再跑，最终日志与官方编译另存。边界图属于地理数据诊断图，不能当微信/手机GPS截图。

首次微信截图发现东北参考点虽已投影，初始相机没有跟到本人、蓝爪在视口外。这组截图未计视觉通过。修复为：图片与尺寸测量均就绪后发ready事件，导览首次本人定位仅聚焦一次；停止/离页后迟到事件不生效。补图片先到/尺寸先到、延迟聚焦、停止与不重复抢镜回归。旧fixture缺失真实微信的triggerEvent接口及混算ready与标定point事件，已同步，失败日志仍保留。

最终 **144/144回归通过**（`tests-final.log`），官方12WXML/16WXSS编译退出0，Fusion Pixel624字形/24804B。152文件目录包与源码逐字节一致，主包2055611B、分包1981419B；是本地原始文件门槛，未做平台上传包体验收。`tests-before-focus.log`为聚焦修复之前的142项结果，不能代替最终结果。最初WXSS编译器路径写错产生的退出0不计验收，改为检查实际wcsc.exe路径、捕获本次退出码后重编译成功。

最终微信官方MCP重新导航/截图6张并逐张人工查看，保存在 `ui/`：西北、东北、东南、西南、西侧校界与用户梅园反馈点。均有明确模拟标识、48逻辑像素蓝爪完整位于地图视口内，图片等比；图标尖端与投影点误差/实际窗口尺寸等见 `ui-verification.json`。这次增加“标记必须在视口内”的门禁，避免仅证明DOM有标记就误报显示通过。首轮东北蓝爪在屏外的反例保存在 `initial-northeast-outside-viewport.png`，不计通过。模拟截图不证明手机GPS或现场误差；未执行原生手势/新动效验收。

## 未执行与限制

`fieldVerified=false`、`extrapolation=false`。覆盖依据保存OSM校园多边形；外围图面点来自简化艺术图中的道路中心，不是地面实测。**完整图面覆盖不等于已测得现场误差，更不等于整校可进行追逐。** 房主仍须确认活动范围、避开道路/水域/不可进入区域；原服务端规则保持。手机GPS走点、后台定位、真实手势、公网联机、服务器压力测试本轮未执行。
