# 02-01 原生页面运行素材 · replica-1

视觉母版仍为 `visual-1.0`；本补充包登记为 `02-01-replica-1`，不覆盖原 78 项冻结素材或 16 张页面稿。先盘点旧库，复用原标记和重连插画；缺少的全幅页头、公园预览底图、躲藏/暂停/取消场景，以及与选中稿姿势不同的结算/出局插画，通过内置 image_gen 按同一母版提示词补齐。

- `source/`：10 张模型原图，包括首页第一次输出和调整留白的 v2；不裁切整页 UI 当运行页面。
- `generation.json`：前 6 次完整提示词、参考稿及工具原始路径。
- `additions.json`：首页 v2 编辑和后 3 次状态场景生成的完整提示词/路径。
- `source-lock.json`：10 张原图 SHA-256。新生成需新文件与新补充版本，不能静默替换。
- `runtime-lock.json`：9 个移动端副本的 SHA-256、尺寸和大小；共 758,167 B，6 个状态场景具备真实透明通道。
- 运行文件放在 `assets/replica-v1/`。本轮仅缩放和 PNG 调色板编码，没有用代码重画或修改模型艺术内容。

## 后续统一提示词

每次先检索现有素材；缺少时，把下列前缀、母版参考和当前页面稿一起提交给 image_gen，续写用途、姿势、尺寸、透明要求和不可改变的部分。

```text
Match the attached selected Cat & Mouse mini-program icon as the exact visual style reference. Bright outdoor-friendly flat 2D cartoon illustration. Rounded orange-and-cream cat and small charcoal-gray mouse, warm tangerine, clear sky blue, grassy green and soft cream. Large simple color planes, readable silhouette at small mobile size, friendly expressions, clean edges, generous breathing room. Consistent character proportions and face shapes across the asset set. No 3D, no photorealism, no neon, no glossy gradient, no heavy shadow, no visual noise, no emoji, no lettering or fake UI copy.

Input1: the selected page design / specific illustrated scene to derive.
Input2: design/2026-10-09/frozen/v1/selected-icon-master.png, locked style and character identity.
Use case: precise-object-edit. Derive ONLY [named scene], preserving the reference pose, face, proportions and palette. Remove phone, UI, text and numerical gameplay values. [True alpha / full bleed]. Reserve [specified] space for native controls. No fixed QR code or enemy position.
```

## 可复核命令

```powershell
python scripts/freeze-art.py --verify
node scripts/verify-replica-art.cjs
node scripts/build-replica-art.cjs
```

图像工具使用本机已有 Sharp；重建只在美术维护时需要，不是小程序启动依赖。源哈希不匹配时脚本立即停止。未来其他开发环境重建需准备 Sharp；现成 PNG 与小程序运行不依赖该库。户外日光、系统字体、真机帧率仍需现场检查。
