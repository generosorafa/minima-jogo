from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


CARD_WIDTH = 176
CARD_HEIGHT = 256
ATLAS_COLUMNS = 9
ATLAS_ROWS = 6
SUITS = ("clubs", "diamonds", "hearts", "spades")
RANKS = (
    ("ace", "A"),
    ("02", "2"),
    ("03", "3"),
    ("04", "4"),
    ("05", "5"),
    ("06", "6"),
    ("07", "7"),
    ("08", "8"),
    ("09", "9"),
    ("10", "10"),
    ("jack", "J"),
    ("queen", "Q"),
    ("king", "K"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the optimized Minima card atlas.")
    parser.add_argument("source", type=Path, help="Path to the original Cards folder.")
    parser.add_argument("output", type=Path, help="Output directory for generated assets.")
    return parser.parse_args()


def card_entries() -> list[tuple[str, str]]:
    entries = [
        (f"{suit}_{source_rank}.png", f"{suit}:{rank}")
        for suit in SUITS
        for source_rank, rank in RANKS
    ]
    entries.extend((("Joker1.png", "joker:0"), ("Joker2.png", "joker:1")))
    return entries


def resize_card(path: Path) -> Image.Image:
    with Image.open(path) as source:
        return source.convert("RGBA").resize(
            (CARD_WIDTH, CARD_HEIGHT),
            Image.Resampling.LANCZOS,
        )


def build_faces(source_dir: Path, output_dir: Path) -> dict[str, int]:
    atlas = Image.new(
        "RGBA",
        (CARD_WIDTH * ATLAS_COLUMNS, CARD_HEIGHT * ATLAS_ROWS),
        (0, 0, 0, 0),
    )
    mapping: dict[str, int] = {}
    for index, (filename, key) in enumerate(card_entries()):
        card_path = source_dir / filename
        if not card_path.is_file():
            raise FileNotFoundError(f"Missing card: {card_path}")
        card = resize_card(card_path)
        x = (index % ATLAS_COLUMNS) * CARD_WIDTH
        y = (index // ATLAS_COLUMNS) * CARD_HEIGHT
        atlas.alpha_composite(card, (x, y))
        mapping[key] = index
    atlas.save(output_dir / "faces.webp", "WEBP", lossless=True, method=6)
    return mapping


def build_back(source_dir: Path, output_dir: Path) -> None:
    back_path = source_dir / "back04.png"
    if not back_path.is_file():
        raise FileNotFoundError(f"Missing card back: {back_path}")
    resize_card(back_path).save(
        output_dir / "back.webp",
        "WEBP",
        lossless=True,
        method=6,
    )


def main() -> None:
    args = parse_args()
    source_dir = args.source.resolve()
    output_dir = args.output.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    mapping = build_faces(source_dir, output_dir)
    build_back(source_dir, output_dir)
    manifest = {
        "cardWidth": CARD_WIDTH,
        "cardHeight": CARD_HEIGHT,
        "columns": ATLAS_COLUMNS,
        "rows": ATLAS_ROWS,
        "backSource": "back04.png",
        "cards": mapping,
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
