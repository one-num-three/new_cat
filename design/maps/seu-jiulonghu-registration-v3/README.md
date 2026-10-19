# 九龙湖全校参考网 v3

当前运行版本：31控制点、53三角分区，原23点保持，新增8个外围道路路口/桥端。源节点来自保存的 `../seu-campuses-v1/jiulonghu.osm`，与未修改的1254×1254原画人工对应。每个新增图面点估计人工识别不确定性15px，**不是15px的现场精度承诺**。没有生成虚构地理点，没有把用户GPS作为拟合点。

## 覆盖与精度分别判断

- 校界取保存的OSM `way/171389014`。87项闭合坐标包含重复首尾，共86个独立顶点。
- 所有顶点在有限控制网凸包内，因此保存的校园多边形被完整覆盖。
- 构建器另做沿界5米/校内10米Mercator网格；实际JS运行投影再独立使用经纬网格验证。两套采样数略不同，不混写成同一结果。
- 无折叠、无图面网边交叉；图面内显示，不进行覆盖外外推。外围路口使网略超校园边界；这不是扩大游戏范围。
- 梅园7B/6B两点不参与拟合，图面残差约1.18/2.91px，仍不是独立地面GPS验证。
- `fieldVerified=false`：边界依据保存OSM与艺术图，不是实时权属边界，也不证明水域/楼宇可进入。正式场地仍需地面走点和组织者确认安全活动范围。

## 重建

```powershell
& 'C:/Users/Keke_/AppData/Local/Programs/Python/Python313/python.exe' scripts/build-jiulonghu-registration.py
node scripts/build-campus-runtime.cjs
node scripts/verify-jiulonghu-coverage.cjs
```

前两项加 `--verify` 可只读验证。旧v2可由同一构建器通过 `--controls design/maps/seu-jiulonghu-registration-v2/controls.json --verify` 复核，保留原模型不覆盖。运行来源由现有唯一生成脚本登记，不维护第二套运行投影。
