---
name: it-japanese-md-review
description: Review, score, and automatically improve Japanese IT lesson content in markdown files under data/project*/. Use when Codex must both evaluate language quality and directly fix wording, business tone, IT terminology, translation alignment, and dialogue structure to produce stronger and more persuasive content.
---

# IT Japanese MD Review

## Workflow
1. Collect target markdown files from user scope.
2. Run quick structural review with `scripts/review_md.py` to surface candidate issues.
3. Run `scripts/fix_md.py --apply` for safe automatic fixes (format, consistency, weak phrasing).
4. Read `references/review-rubric.md` and `references/persuasive-rewrite.md`, then perform manual language upgrades for meaning and tone.
5. Score each file by rubric categories.
6. Report findings with exact file + line references plus applied fixes and rationale.

## Commands
```bash
python .codex/skills/it-japanese-md-review/scripts/review_md.py data/project1/4-4.md
python .codex/skills/it-japanese-md-review/scripts/review_md.py data/project1/*.md
python .codex/skills/it-japanese-md-review/scripts/review_md.py data/project1/4-4.md --json
python .codex/skills/it-japanese-md-review/scripts/fix_md.py data/project1/4-4.md --dry-run
python .codex/skills/it-japanese-md-review/scripts/fix_md.py data/project1/4-4.md --apply
```

## Output Contract
- Show score per file on 5 categories (0-5 each, total 25):
  - `japanese_naturalness`
  - `business_tone`
  - `it_terminology`
  - `translation_alignment`
  - `markdown_structure`
- List findings first, ordered by severity.
- For each finding include:
  - file path
  - line number
  - reason
  - applied rewrite in Japanese (and optional VN clarification)
- Include `Applied fixes` section with before/after snippets.

## Review Rules
- Prefer concrete evidence over generic comments.
- Distinguish hard errors from style preferences.
- Default mode is `fix-first`: apply high and medium issues directly unless user says `review-only`.
- Keep Japanese business style consistent (`です/ます`, polite requests, clear ownership).
- Upgrade weak statements into persuasive professional statements (clear intent, reason, and next action).