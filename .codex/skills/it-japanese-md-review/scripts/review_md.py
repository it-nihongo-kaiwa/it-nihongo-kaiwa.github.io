#!/usr/bin/env python3
import argparse
import glob
import json
import re
from pathlib import Path
from typing import Dict, List


ROLE_LINE = re.compile(r"^\s*\*\*[^*]+:\*\*\s*(.+?)\s*$")
ITALIC_LINE = re.compile(r"^\s*\*(.+)\*\s*$")
JAPANESE_CHAR = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")
BUSINESS_PATTERNS = [
    re.compile(p)
    for p in [
        r"です",
        r"ます",
        r"でしょう",
        r"いただけますか",
        r"お願い(できます|いたします)",
        r"承知しました",
    ]
]
IT_TERMS = {
    "要件",
    "要件定義",
    "設計",
    "実装",
    "テスト",
    "障害",
    "リリース",
    "レビュー",
    "仕様",
    "API",
    "DB",
    "インフラ",
    "画面",
    "認証",
    "権限",
}
SECTION_HINTS = ["##", "###", "単語", "フレーズ"]


def clamp(value: int, low: int = 0, high: int = 5) -> int:
    return max(low, min(high, value))


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def score_file(path: Path) -> Dict:
    text = read_text(path)
    lines = text.splitlines()
    role_line_indexes = []
    dialogue_texts = []
    translation_count = 0
    findings: List[Dict] = []

    for idx, line in enumerate(lines, start=1):
        match = ROLE_LINE.match(line)
        if match:
            role_line_indexes.append(idx)
            dialogue_texts.append(match.group(1))
            if idx < len(lines) and ITALIC_LINE.match(lines[idx]):
                translation_count += 1

    all_dialogue = " ".join(dialogue_texts)
    jp_chars = len(JAPANESE_CHAR.findall(all_dialogue))
    total_chars = max(1, len(all_dialogue))
    jp_ratio = jp_chars / total_chars

    business_hits = sum(1 for p in BUSINESS_PATTERNS if p.search(all_dialogue))
    term_hits = sum(1 for t in IT_TERMS if t in text)
    section_hits = sum(1 for h in SECTION_HINTS if h in text)

    translation_ratio = 1.0
    if role_line_indexes:
        translation_ratio = translation_count / len(role_line_indexes)

    if not role_line_indexes:
        findings.append(
            {
                "severity": "high",
                "line": 1,
                "message": "Khong tim thay dong hoi thoai theo mau **Role:** ...",
            }
        )
    if role_line_indexes and translation_ratio < 0.5:
        findings.append(
            {
                "severity": "medium",
                "line": role_line_indexes[0],
                "message": "Ty le dong dich nghia (*...*) thap hon 50%.",
            }
        )
    if role_line_indexes and jp_ratio < 0.15:
        findings.append(
            {
                "severity": "medium",
                "line": role_line_indexes[0],
                "message": "Noi dung hoi thoai co it ky tu Nhat, can kiem tra do tu nhien.",
            }
        )
    if business_hits == 0 and role_line_indexes:
        findings.append(
            {
                "severity": "low",
                "line": role_line_indexes[0],
                "message": "Thieu dau hieu van phong business keigo (desu/masu/request form).",
            }
        )

    japanese_naturalness = clamp(int(round(2 + jp_ratio * 6)))
    business_tone = clamp(2 + business_hits)
    it_terminology = clamp(1 + min(4, term_hits // 2))
    translation_alignment = clamp(int(round(translation_ratio * 5)))
    markdown_structure = clamp(1 + min(4, section_hits // 2) + (1 if role_line_indexes else -1))

    scores = {
        "japanese_naturalness": japanese_naturalness,
        "business_tone": business_tone,
        "it_terminology": it_terminology,
        "translation_alignment": translation_alignment,
        "markdown_structure": markdown_structure,
    }
    total = sum(scores.values())

    return {
        "file": str(path).replace("\\", "/"),
        "dialogue_lines": len(role_line_indexes),
        "translation_ratio": round(translation_ratio, 3),
        "japanese_ratio": round(jp_ratio, 3),
        "it_term_hits": term_hits,
        "scores": scores,
        "total": total,
        "findings": findings,
    }


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


def main() -> int:
    parser = argparse.ArgumentParser(description="Quick quality scoring for IT Japanese markdown lessons.")
    parser.add_argument("paths", nargs="+", help="Markdown file paths or glob patterns.")
    parser.add_argument("--json", action="store_true", help="Output JSON only.")
    args = parser.parse_args()

    files = expand_inputs(args.paths)
    if not files:
        print("No markdown files found.")
        return 1

    reports = [score_file(path) for path in files]

    if args.json:
        print(json.dumps(reports, ensure_ascii=False, indent=2))
        return 0

    for report in reports:
        print(f"{report['file']}: {report['total']}/25")
        print(
            "  scores:"
            f" naturalness={report['scores']['japanese_naturalness']}"
            f", business={report['scores']['business_tone']}"
            f", terminology={report['scores']['it_terminology']}"
            f", translation={report['scores']['translation_alignment']}"
            f", structure={report['scores']['markdown_structure']}"
        )
        print(
            f"  stats: dialogue={report['dialogue_lines']}, "
            f"jp_ratio={report['japanese_ratio']}, "
            f"translation_ratio={report['translation_ratio']}, "
            f"it_terms={report['it_term_hits']}"
        )
        for finding in report["findings"]:
            print(f"  {finding['severity'].upper()}: line {finding['line']} - {finding['message']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
