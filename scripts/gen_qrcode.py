# -*- coding: utf-8 -*-
"""生成星屿平台的永久二维码"""
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont
import os

URL = "https://lele332.github.io/xingyu-platform/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xingyu-qrcode.png")

# 生成二维码（蓝色 / iOS 系统蓝风格）
qr = qrcode.QRCode(
    version=5,
    error_correction=ERROR_CORRECT_H,
    box_size=10,
    border=4,
)
qr.add_data(URL)
qr.make(fit=True)
img = qr.make_image(fill_color="#0a84ff", back_color="white").convert("RGB")

qr_w, qr_h = img.size
canvas = Image.new("RGB", (qr_w, qr_h + 110), "#ffffff")
canvas.paste(img, (0, 0))

draw = ImageDraw.Draw(canvas)

title_font = None
url_font = None
# 优先使用 Windows 自带的中文字体（.ttf 单一字体最稳，.ttc 需索引）
for fp in ["C:/Windows/Fonts/simhei.ttf",
           "C:/Windows/Fonts/arial.ttf"]:
    if os.path.exists(fp):
        try:
            if title_font is None:
                title_font = ImageFont.truetype(fp, 44)
            if url_font is None:
                url_font = ImageFont.truetype(fp, 28)
            if title_font and url_font:
                break
        except Exception as e:
            print(f"字体加载失败 {fp}: {e}")
            continue
if title_font is None:
    title_font = ImageFont.load_default()
if url_font is None:
    url_font = title_font

# 标题（中文，纯文本 100% 兼容）
draw.text((30, qr_h + 14), "星屿 · 个人AI工作平台", fill="#0a84ff", font=title_font)
draw.text((30, qr_h + 70), URL.replace("https://", ""), fill="#5e5ce6", font=url_font)

canvas.save(OUT)
print("二维码已生成:", os.path.abspath(OUT))
