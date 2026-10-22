# 猫鼠行动小程序图标

沿用晴日 16-bit 像素风、橘白猫与蓝灰鼠；奶油黄底、草绿点缀。使用内置 image_gen，参照项目 home-hero.png、role-cat.png、role-mouse.png 生成。完整提示词在 PROMPT.txt。

- cat-mouse-icon-144.png：小程序头像上传版，144×144 PNG，小于 2MB。
- cat-mouse-icon-512.png：512×512 预览／备用版。
- source-original.png：生成原稿，原样保留。
- VERIFICATION.json：实际尺寸、格式、字节数与 SHA256。
- export.cjs：使用 Sharp 做最近邻尺寸转换，保持像素轮廓；运行 node export.cjs 可重导出。

直接上传 144 版即可。图标使用不透明底色，没有文字。所有文件直接保存，无压缩包。
