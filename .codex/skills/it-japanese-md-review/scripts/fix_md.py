#!/usr/bin/env python3
import argparse
import glob
import re
import sys
from pathlib import Path
from typing import List, Tuple


ROLE_LINE = re.compile(r"^(\s*\*\*[^*]+:\*\*)(\S.*)$")
JP_CHAR = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")

REPLACEMENTS = [
    (re.compile("\u3068\u601d\u3044\u307e\u3059"), "\u3068\u8003\u3048\u3066\u3044\u307e\u3059"),
    (re.compile("\u304b\u3082\u3057\u308c\u307e\u305b\u3093"), "\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059"),
    (re.compile("\u3067\u304d\u308c\u3070"), "\u53ef\u80fd\u3067\u3042\u308c\u3070"),
    (re.compile("\u554f\u984c\u306a\u3044\u3067\u3059"), "\u554f\u984c\u3054\u3056\u3044\u307e\u305b\u3093"),
    (re.compile("\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044"), "\u3054\u78ba\u8a8d\u3044\u305f\u3060\u3051\u307e\u3059\u3067\u3057\u3087\u3046\u304b"),
    (re.compile(r"\breview\b", re.IGNORECASE), "\u30ec\u30d3\u30e5\u30fc"),
    (re.compile(r"\bfix request\b", re.IGNORECASE), "\u4fee\u6b63\u4f9d\u983c"),
    (re.compile(r"\bAPI spec\b", re.IGNORECASE), "API\u4ed5\u69d8"),
]


def expand_inputs(patterns: List[str]) -> List[Path]:
    files: List[Path] = []
    seen = set()
    for pattern in patterns:
        matches = glob.glob(pattern)
        if not matches and Path(pattern).is_file():
            matches = [pattern]
        for item in matches:
            p = Path(item)
            if p.is_file() and p.suffix.lower() == ".md":
                key = str(p.resolve())
                if key not in seen:
                    seen.add(key)
                    files.append(p)
    return sorted(files)


def has_japanese(text: str) -> bool:
    return bool(JP_CHAR.search(text))


def transform_line(line: str) -> str:
    original = line

    role_match = ROLE_LINE.match(line)
    if role_match:
        line = f"{role_match.group(1)} {role_match.group(2)}"

    if has_japanese(line):
        for pattern, replacement in REPLACEMENTS:
            line = pattern.sub(replacement, line)

        line = line.replace("\u3002\u3002", "\u3002")
        line = line.replace("\u3001\u3001", "\u3001")

    line = line.rstrip()
    return line if line != original else original


def fix_file(path: Path, apply: bool) -> Tuple[int, int]:
    text = path.read_text(encoding="utf-8-sig")
    lines = text.splitlines()
    changed = 0
    output_lines = []

    for idx, line in enumerate(lines, start=1):
        new_line = transform_line(line)
        if new_line != line:
            changed += 1
            print(f"{path.as_posix()}:{idx}")
            print(f"  - {line}")
            print(f"  + {new_line}")
        output_lines.append(new_line)

    if apply and changed > 0:
        newline = "\n" if text.endswith("\n") else ""
        path.write_text("\n".join(output_lines) + newline, encoding="utf-8")

    return changed, len(lines)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Auto-fix common Japanese IT markdown issues.")
    parser.add_argument("paths", nargs="+", help="Markdown file paths or glob patterns.")
    parser.add_argument("--apply", action="store_true", help="Write changes back to file.")
    parser.add_argument("--dry-run", action="store_true", help="Show changes only (default).")
    args = parser.parse_args()

    files = expand_inputs(args.paths)
    if not files:
        print("No markdown files found.")
        return 1

    apply = args.apply and not args.dry_run
    total_changes = 0

    for path in files:
        changed, total = fix_file(path, apply=apply)
        total_changes += changed
        print(f"{path.as_posix()}: changed {changed}/{total} lines")

    if not apply:
        print("Dry-run mode. Use --apply to write files.")
    print(f"Total changed lines: {total_changes}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())