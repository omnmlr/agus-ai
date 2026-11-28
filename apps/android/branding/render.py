"""Render Android brand resources from the approved web assets using Inkscape and Pillow."""

from pathlib import Path
import shutil
import subprocess

from PIL import Image


BRANDING = Path(__file__).resolve().parent
SOURCE = BRANDING.parents[1] / "web" / "public" / "assets"
DRAWABLES = BRANDING / "res" / "drawable-nodpi"


def render_symbol(size, width, destination):
    with Image.open(SOURCE / "brand-symbol-dark.png") as source:
        symbol = source.convert("RGBA")
    height = round(width * symbol.height / symbol.width)
    symbol = symbol.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size))
    canvas.paste(symbol, ((size - width) // 2, (size - height) // 2))
    canvas.save(destination, optimize=True)


def main():
    for name, width in [("brand-lockup-dark", 550), ("brand-lockup-light", 550), ("brand-wordmark-dark", 608)]:
        target = DRAWABLES / f"{name.replace('-', '_')}.png"
        subprocess.run(["inkscape", str(SOURCE / f"{name}.svg"), f"--export-width={width}",
                        f"--export-filename={target}"], check=True)
    shutil.copyfile(SOURCE / "orbital-ghost.webp", DRAWABLES / "brand_mascot.webp")
    shutil.copyfile(SOURCE / "agus-orbital-mark.png", BRANDING / "res" / "mipmap-nodpi" / "brand_launcher.png")
    render_symbol(432, 208, DRAWABLES / "brand_launcher_foreground.png")
    render_symbol(96, 80, BRANDING / "res" / "drawable-xxxhdpi" / "brand_notification.png")


if __name__ == "__main__":
    main()
