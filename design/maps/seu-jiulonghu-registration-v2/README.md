# 九龙湖配准参考 v2

原图、图片ID、运行JPEG与v1交接全部保留。本版本仅补齐旧控制点凸包遗漏的梅园东南区域，不对控制网外位置作无限外推。

- 基线：`../seu-campuses-v1/jiulonghu-registration.json`，原20点保持坐标和图面位置。
- 新增3个经保存的OSM几何与原画对照的地标：梅园5C、梅园1C、东侧田径场。合计23控制点、36三角分区，无折叠。
- 另留梅园7B、梅园6B作为**未参与拟合的图面检查点**，约1.18px、2.91px。人工图面中心存在约10px不确定性，屋顶中心也不等于行人地面；这不是现场GPS精度证明。
- 用户反馈GCJ-02 `31.882368,118.828049` 仅作回归样本，**未用于拟合**。近似转换为WGS84后，旧凸包返回null；新模型在原图约(1076.07,967.31)，对应梅园7B附近。周围±20米九个采样均有覆盖。
- `fieldVerified=false`、`extrapolation=false` 保持；仍需现场独立地面点核验。其他未配准区域仍返回null，但客户端会区分“校区内未配准”和“所选校区外”。

重建/验证（现有Python3.13＋NumPy2.3.1＋SciPy1.16.1）：

```powershell
& 'C:/Users/Keke_/AppData/Local/Programs/Python/Python313/python.exe' scripts/build-jiulonghu-registration.py --verify
node scripts/build-campus-runtime.cjs --verify
```

Python仅用于离线重建，客户端/服务端均无此新依赖。运行注册表仍由现有唯一生成脚本生成；图片SHA、双方共享注册表、房间实地标定与服务端规则保持不变。
