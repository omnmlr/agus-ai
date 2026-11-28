"""Render Android brand resources from the approved web assets using Inkscape and Pillow."""

from pathlib import Path
import shutil
import subprocess

from PIL import Image


BRANDING = Path(__file__).resolve().parent
SOURCE = BRANDING.parents[1] / "web" / "public" / "assets"
SHARED = BRANDING / "res"
COMPANION = BRANDING.parent / "app" / "src" / "main" / "res"
RUNTIME = BRANDING.parent / "native-preview" / "runtime" / "res"


def render_symbol(size, width, destination):
    with Image.open(SOURCE / "brand-symbol-dark.png") as source:
        symbol = source.convert("RGBA")
    height = round(width * symbol.height / symbol.width)
    symbol = symbol.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size))
    canvas.paste(symbol, ((size - width) // 2, (size - height) // 2))
    canvas.save(destination, optimize=True)


def main():
    for name, width, resources in [
        ("brand-lockup-dark", 550, COMPANION),
        ("brand-wordmark-dark", 608, COMPANION),
        ("brand-lockup-light", 550, RUNTIME),
    ]:
        target = resources / "drawable-nodpi" / f"{name.replace('-', '_')}.png"
        subprocess.run(["inkscape", str(SOURCE / f"{name}.svg"), f"--export-width={width}",
                        f"--export-filename={target}"], check=True)
    shutil.copyfile(SOURCE / "orbital-ghost.webp", COMPANION / "drawable-nodpi" / "brand_mascot.webp")
    shutil.copyfile(SOURCE / "agus-orbital-mark.png", SHARED / "mipmap-nodpi" / "brand_launcher.png")
    render_symbol(432, 208, SHARED / "drawable-nodpi" / "brand_launcher_foreground.png")
    render_symbol(96, 80, RUNTIME / "drawable-xxxhdpi" / "brand_notification.png")


if __name__ == "__main__":
    main()
