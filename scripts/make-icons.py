"""
Regenerates every icon from `assets/icon-source.png`.

Run by hand after replacing the source image:

    pip install Pillow
    python scripts/make-icons.py

Two shapes come out of one picture, because they are masked differently:

  * the plain icons keep the subject at ~70% of the tile — iOS rounds the
    corners itself and needs no safe area beyond that.
  * the maskable ones must survive being cropped to a circle of 80% diameter,
    so the whole picture is scaled down until the glass fits, and the ring left
    over is filled with a blurred copy of the same picture rather than a flat
    colour — a flat fill shows a seam against the painting's texture.

SUBJECT is the glass in source-image pixels. Re-measure it if the picture
changes: it is the bounding box of the strongly orange pixels, plus a little
for the clear base the coffee does not reach.
"""

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "icon-source.png"

# left, top, right, bottom
SUBJECT = (430, 232, 1018, 925)
# How much of the tile the glass fills on the un-masked icons.
FILL = 0.70
# The favicon renders at 16px in a tab. At FILL the glass is a small shape in a
# field of cream and reads as nothing at all, so it gets its own tight crop —
# the amber/brown/white bands are the only thing legible at that size.
FAVICON_FILL = 1.0
# Bumped whenever the artwork changes. iOS caches a home-screen icon by URL and
# will not re-fetch the same path, so the file has to be renamed to get an
# already-installed shortcut to update. Keep in step with public/index.html.
VERSION = 2
# Maskable icons are cropped to a circle of this diameter, as a fraction.
SAFE = 0.80


def subject_center(box):
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def square_crop(image, box, fill):
    """A square centred on the subject, with the subject at `fill` of the side."""
    cx, cy = subject_center(box)
    side = max(box[2] - box[0], box[3] - box[1]) / fill
    # Stay inside the picture; nudge the window rather than padding it.
    side = min(side, image.width, image.height)
    left = min(max(cx - side / 2, 0), image.width - side)
    top = min(max(cy - side / 2, 0), image.height - side)
    return image.crop((round(left), round(top), round(left + side), round(top + side)))


def maskable(image, box, size):
    """The picture scaled so the subject's corners clear the safe circle."""
    cx, cy = subject_center(box)
    side = min(image.width, image.height)
    left = min(max(cx - side / 2, 0), image.width - side)
    top = min(max(cy - side / 2, 0), image.height - side)
    crop = image.crop((round(left), round(top), round(left + side), round(top + side)))

    # Where the subject sits inside that crop, and how far its furthest corner
    # is from its own centre.
    sx, sy = cx - left, cy - top
    half_diagonal = (((box[2] - box[0]) / 2) ** 2 + ((box[3] - box[1]) / 2) ** 2) ** 0.5
    scale = (SAFE / 2 * size) / half_diagonal

    inner = crop.resize((round(side * scale), round(side * scale)), Image.LANCZOS)
    # A blurred full-bleed copy underneath, so the ring left over by the scaled
    # picture is the same cream rather than a flat patch with a visible edge.
    canvas = crop.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(size / 32))
    canvas.paste(inner, (round(size / 2 - sx * scale), round(size / 2 - sy * scale)))
    return canvas


def main():
    source = Image.open(SOURCE).convert("RGB")
    plain = square_crop(source, SUBJECT, FILL)

    def write(image, path, size):
        path.parent.mkdir(parents=True, exist_ok=True)
        image.resize((size, size), Image.LANCZOS).save(path, optimize=True)
        print(f"{path.relative_to(ROOT)}  {size}x{size}")

    icons = ROOT / "public" / "icons"
    write(plain, icons / "icon-192.png", 192)
    write(plain, icons / "icon-512.png", 512)
    write(plain, icons / f"apple-touch-icon-v{VERSION}.png", 180)

    # 96 rather than 48: browsers downscale to 16/32 themselves and do a better
    # job of it than a nearest-neighbour step from an already small file.
    tight = square_crop(source, SUBJECT, FAVICON_FILL)
    write(tight, ROOT / "public" / f"favicon-v{VERSION}.png", 96)

    for size in (192, 512):
        path = icons / f"maskable-{size}.png"
        maskable(source, SUBJECT, size).save(path, optimize=True)
        print(f"{path.relative_to(ROOT)}  {size}x{size}")

    # Native build assets.
    write(plain, ROOT / "assets" / "icon.png", 1024)
    write(tight, ROOT / "assets" / "favicon.png", 96)
    write(plain, ROOT / "assets" / "splash-icon.png", 1024)
    maskable(source, SUBJECT, 512).save(
        ROOT / "assets" / "android-icon-foreground.png", optimize=True
    )
    print("assets/android-icon-foreground.png  512x512")

    # The colour to sit behind them, sampled from the painting's own edge so
    # the splash does not show a square patch of a different cream.
    ring = []
    for x in range(0, plain.width, 5):
        ring.append(plain.getpixel((x, 2)))
        ring.append(plain.getpixel((x, plain.height - 3)))
    for y in range(0, plain.height, 5):
        ring.append(plain.getpixel((2, y)))
        ring.append(plain.getpixel((plain.width - 3, y)))
    avg = tuple(sum(c[i] for c in ring) // len(ring) for i in range(3))
    print("\nedge colour: #%02x%02x%02x  (splash / adaptiveIcon background)" % avg)


if __name__ == "__main__":
    main()
