#!/usr/bin/env python3
"""Build every spec.jev icon asset from the brand source image.

Source of truth: resources/brand/mu-icon-source.png, the brand logo as it was drawn: the loop mark,
transparent background, wider than it is tall (about 1.86:1). The filename is the one this script has
always read; only the artwork in it changed.

What this script does:

* The transparent margin around the mark is measured and cut, so the mark sits on every canvas by its
  own edges rather than by wherever the artwork happened to be placed.
* Each output is composed on a square canvas, transparent, the mark centred and scaled to a fraction of
  the canvas: "full" (0.92) for app.png, icon.png, the PWA icons, the renderer's logo and the site's
  icons, "padded" (0.74) for app.icns and app_dev.png, the macOS icon grid. Icons of 32 px and below
  use more of the canvas, since a wide mark loses height to its aspect ratio.
* Every size is resampled from the artwork with Lanczos: no size is derived by shrinking another size.
* The .ico carries seven sizes; the .icns is written here, not by macOS `iconutil`, so the same command
  works on Linux, macOS and Windows.

Deterministic: same source, same pixels (no timestamps, no randomness). The social card (og.jpg) is the
one output that needs a font; it takes the first font it finds from a short list and says which one.

    python3 scripts/kyrn/icon/build-icon.py            # write all assets into the repository
    python3 scripts/kyrn/icon/build-icon.py --verify   # only check the source artwork
    python3 scripts/kyrn/icon/build-icon.py --out DIR  # write the same tree under DIR instead

Needs Python 3.9+, Pillow and numpy.
"""

from __future__ import annotations

import argparse
import base64
import io
import struct
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[3]
SOURCE = REPO / "resources" / "brand" / "mu-icon-source.png"

# How much of a square canvas the mark's width takes. A wide mark cannot fill a square without touching
# the top and bottom edges; these leave room the way an icon grid wants.
FULL_WIDTH = 0.92
PADDED_WIDTH = 0.74  # macOS icon grid: the visible mark on 824 px of a 1024 px canvas.
SMALL_EXTRA = 1.06  # 16-32 px: the same fraction, a little wider, since the height is what suffers.
SMALL_UP_TO = 32

ICNS_TYPES = ((16, b"icp4"), (32, b"icp5"), (64, b"icp6"), (128, b"ic07"), (256, b"ic08"), (512, b"ic09"), (1024, b"ic10"))


def load_mark(path: Path = SOURCE) -> Image.Image:
    """The artwork, RGBA, cut to the pixels the mark actually covers."""
    image = Image.open(path)
    if image.mode != "RGBA":
        raise SystemExit(f"{path} must be RGBA, found {image.mode}")
    alpha = image.getchannel("A")
    box = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if box is None:
        raise SystemExit(f"{path} is fully transparent")
    return image.crop(box)


def verify(mark: Image.Image) -> None:
    width, height = mark.size
    ratio = width / height
    if not 1.0 <= ratio <= 3.0:
        raise SystemExit(f"the mark's aspect ratio is {ratio:.2f}; expected a wide logo (1.0 to 3.0)")
    if width < 256 or height < 128:
        raise SystemExit(f"the mark is {width}x{height}; expected at least 256x128")
    print(f"mark {width}x{height} (ratio {ratio:.2f})")


def render(mark: Image.Image, size: int, padded: bool) -> Image.Image:
    """The mark centred on a transparent size x size canvas."""
    fraction = PADDED_WIDTH if padded else FULL_WIDTH
    if size <= SMALL_UP_TO:
        fraction = min(1.0, fraction * SMALL_EXTRA)
    width = max(1, round(size * fraction))
    height = max(1, round(mark.height * width / mark.width))
    if height > size:
        height = size
        width = max(1, round(mark.width * height / mark.height))
    logo = mark.resize((width, height), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(logo, ((size - width) // 2, (size - height) // 2))
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG")
    print(f"  {path}")


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def save_ico(mark: Image.Image, path: Path) -> None:
    sizes = (16, 24, 32, 48, 64, 128, 256)
    frames = [render(mark, size, padded=False) for size in sizes]
    path.parent.mkdir(parents=True, exist_ok=True)
    frames[-1].save(path, format="ICO", append_images=frames[:-1], sizes=[(size, size) for size in sizes])
    print(f"  {path}")


def save_icns(mark: Image.Image, path: Path) -> None:
    """An ICNS of PNG-compressed frames, written here so the build does not need macOS."""
    chunks = b""
    for size, kind in ICNS_TYPES:
        payload = png_bytes(render(mark, size, padded=True))
        chunks += kind + struct.pack(">I", len(payload) + 8) + payload
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"icns" + struct.pack(">I", len(chunks) + 8) + chunks)
    print(f"  {path}")


def save_logo_svg(mark: Image.Image, path: Path) -> None:
    """The mark as an SVG that carries the PNG: one asset for anything that asks for an .svg."""
    png = png_bytes(render(mark, 512, padded=False))
    encoded = base64.b64encode(png).decode("ascii")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">\n'
        f'  <image width="512" height="512" href="data:image/png;base64,{encoded}" />\n'
        "</svg>\n"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(svg, encoding="utf-8", newline="\n")
    print(f"  {path}")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """A font from the machine: the card is artwork, not something the build repaints per platform."""
    names = ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold else ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]
    folders = [Path("C:/Windows/Fonts"), Path("/System/Library/Fonts"), Path("/usr/share/fonts/truetype/dejavu")]
    for name in names:
        for folder in folders:
            candidate = folder / name
            if candidate.exists():
                return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def save_social(mark: Image.Image, path: Path) -> None:
    """1200x675: the mark, the name, the line the site uses. JPEG has no alpha, so the card has a colour."""
    card = Image.new("RGB", (1200, 675), (246, 245, 244))
    draw = ImageDraw.Draw(card)
    logo = render(mark, 420, padded=False).resize((420, 420), Image.LANCZOS)
    card.paste(logo, (70, 128), logo)
    draw.line(((556, 190), (556, 486)), fill=(221, 217, 214), width=2)
    draw.text((606, 208), "spec.jev", font=font(96, bold=True), fill=(26, 26, 26))
    draw.text((610, 350), "Only what's needed.", font=font(44), fill=(42, 42, 42))
    draw.line(((612, 428), (790, 428)), fill=(204, 200, 197), width=2)
    draw.text((610, 456), "built on pi  ·  judged by Jev", font=font(26), fill=(107, 107, 107))
    path.parent.mkdir(parents=True, exist_ok=True)
    card.save(path, format="JPEG", quality=92)
    print(f"  {path}")


def build(out: Path) -> None:
    mark = load_mark()
    verify(mark)
    resources = out / "resources"
    renderer = out / "packages" / "desktop" / "src" / "renderer"
    site = out.parent / "site"

    print("writing:")
    save_png(render(mark, 1024, padded=False), resources / "app.png")
    save_png(render(mark, 1024, padded=True), resources / "app_dev.png")
    save_png(render(mark, 800, padded=False), resources / "icon.png")
    save_png(render(mark, 512, padded=False), renderer / "assets" / "logos" / "brand" / "app.png")
    save_logo_svg(mark, renderer / "assets" / "logo.svg")
    for size in (180, 192, 512):
        save_png(render(mark, size, padded=False), out / "public" / "pwa" / f"icon-{size}.png")
    save_ico(mark, resources / "app.ico")
    save_icns(mark, resources / "app.icns")

    save_png(render(mark, 256, padded=False), site / "assets" / "icon-256.png")
    save_png(render(mark, 180, padded=False), site / "assets" / "apple-touch-icon.png")
    save_png(render(mark, 64, padded=False), site / "assets" / "favicon-64.png")
    save_social(mark, site / "assets" / "og.jpg")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--verify", action="store_true", help="only check the source artwork")
    parser.add_argument("--out", type=Path, default=REPO, help="write the asset tree under this directory")
    arguments = parser.parse_args()
    if arguments.verify:
        verify(load_mark())
        return
    build(arguments.out.resolve())


if __name__ == "__main__":
    sys.exit(main())
