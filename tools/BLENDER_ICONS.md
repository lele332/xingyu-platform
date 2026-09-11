# 星屿 Blender 图标管线

`tools/blender_icons.py` 可以把 SVG 图标批量渲染为玻璃质感 PNG，供 `3D 玻璃` 图标风格使用。

## 使用

```bash
blender --background --python tools/blender_icons.py -- --input assets/icons3d/svg --output assets/icons3d
```

建议源文件：

```text
assets/icons3d/svg/ai.svg
assets/icons3d/svg/courses.svg
assets/icons3d/svg/focus.svg
...
```

渲染结果：

```text
assets/icons3d/ai.png
assets/icons3d/courses.png
assets/icons3d/focus.png
...
```

未安装 Blender 或 PNG 缺失时，平台会自动降级为 SVG 玻璃图标，不会显示空图。
