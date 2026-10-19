# 微信日志排查与 3D 首次加载修复 · 2026-10-19

## 日志结论

用户报告 `webapi_getquickfillauthinfo: server check no permission` 和 `private_getBackgroundFetchData ... errno:101`。堆栈均位于微信基础库。当前注册页面和依赖模块未调用自动填充、数据预拉取或相应私有接口；本次工具控制台未复现这两条，不能据此确定微信侧检查失败的具体原因，也不能将其当作业务服务端的权限拒绝。

正确项目实例的只读查询：定位权限为 `true`，隐私查询 `needAuthorization=false`，见 permissions.json。查询含义参见腾讯维护的 [API 声明与说明](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)；其中 backgroundFetch 为缓存数据接口，定位使用的是独立定位接口。本轮未增加自动填充/预拉取权限，未修改 AppSecret、登录凭据或服务端配置，未屏蔽日志。

## 实际发现与修复

1. 3D 加载失败：旧实例中 `campus.json` 读取返回 `no such file`，而 `campus.bin` 与 ground.jpg 可读；此前错误处理只取 message，遗漏微信错误对象的 errMsg。改为 `campus-meta.bin`（原 UTF-8 JSON 字节保持一致），显式包含到包中；导出器、校验与当前交付同步。自定义 `.meta` 后缀的尝试仍报 permission denied，未计为通过，最终使用已实际读通的 `.bin`。错误对象保留 errMsg，出错仍释放资源并可退回像素图。
2. 首帧字体：四个业务页的 fontScale 在 onLoad 之前为空，触发两条类型警告；补默认数值1，仍由真实屏幕设置更新。相关控件用例增加首帧可读性断言。
3. 调试目标：导入列表同时存在 `D:/...` 与 `D:\...` 条目。斜杠路径的编译命令返回成功后，所读运行实例仍为旧代码；未据此验收。统一使用 Windows 绝对路径 `D:\cat-mouse-miniprogram` 后，编译首页/场地页、首次进入分包，重新核对资源读取和实际画面。没有移动/激活/缩放桌面窗口，没有移除项目条目或清登录数据。

## 验证与复核

- `tests.log`：42项相关用例通过；`tests-full.log`：157/157，0失败，exit0。完整回归使用 D 盘临时目录及隔离 PGlite，不是线上数据库或真实服务器压测。
- `runtime-after.json`、`3d-cold-load-final.png`：正确实例重新编译、首次分包加载后 status=ready、已实际绘制、无错误；实际PNG已查看，可见校园与操作控件。本图未开启GPS、未模拟本人，不冒充真机定位通过；单次绘制耗时不是帧率/性能承诺。
- `console-after.json`：本次仅两条基础库启动信息，无字体警告或上述私有接口报错；没有清空或隐藏控制台来获取此结果。
- `verification.json`、`package-manifest.json`：8个JS文件语法检查、元数据改名前后SHA、网格SHA与目录版源码逐文件核对、各包本地原始大小。未重新执行无改动的WXML/WXSS编译；此前记录仍为历史结果。
- `DIFF.md`、`before/`：本轮9个文件修改前副本及对应差异，不是全仓备份。源码与两份原Blender/ZIP均保留。

补采过程中一次工具请求因微信 AppID 服务 `connect ETIMEDOUT` 失败，恢复后重新进入场地与分包取证；没有计入通过。一次报告/目录写入后采到首页的中间快照保留为 runtime-during-recompile.json，首次校验因此失败，最终严格校验使用成功模型页，未放宽断言。C盘再次为0空间，沙箱命令无法建立辅助日志；本机命令继续读写D盘证据，未删除个人文件或扩大清理范围。

## 使用

优先继续使用项目根目录 `D:\cat-mouse-miniprogram`。重新编译 → 场地地图 → 九龙湖 → 图层图标 → 3D校园。目录交付位于 `release/MODIFIED_FILE`，无压缩包；它替代首版3D目录快照作为本次修复的交付副本。

若后续真机出现业务失败，以具体 `getLocation:fail`、登录接口响应或地图错误提示继续定位；本次没有复现并修复微信内部服务的权限检查，不能承诺它们以后不再打印。手机首次隐私授权、真实GPS、GPU合成/触控/耗电、后台恢复、公网负载仍待真机与现场验证。没有上传、发布、新部署、线上写入或Git提交。
