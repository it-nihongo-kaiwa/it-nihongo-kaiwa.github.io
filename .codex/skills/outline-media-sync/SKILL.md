---
name: outline-media-sync
description: Update and validate data/outline.json for this repository, including project/group/item paths and consistency with lesson markdown files under data/project*/ plus optional media in bg/ and video/. Use when adding, removing, or renaming lessons/projects, or when fixing broken lesson links.
---

# Outline Media Sync

## Workflow
1. Read `references/outline-schema.md`.
2. Apply requested outline changes in `data/outline.json`.
3. Keep item `id`, `path`, and project folder alignment consistent.
4. Run `scripts/check_outline_sync.py`.
5. Fix hard errors first (missing lesson file, duplicates, invalid JSON).
6. Report warnings (missing bg/video assets) and only auto-fix when requested.

## Commands
```bash
python .codex/skills/outline-media-sync/scripts/check_outline_sync.py
python .codex/skills/outline-media-sync/scripts/check_outline_sync.py --strict-lessons
python .codex/skills/outline-media-sync/scripts/check_outline_sync.py --strict-media
python .codex/skills/outline-media-sync/scripts/check_outline_sync.py --strict-lessons --strict-media
```

## Editing Rules
- Preserve JSON validity and existing top-level keys.
- Keep lesson path as `data/project<id>/<lesson-id>.md` unless user requests another layout.
- When adding a lesson, ensure `groups[].items[]` includes at least `id`, `title`, and `path`.
- Prefer deterministic changes; do not reorder unrelated items.

## Validation Expectations
- Zero hard errors before finishing.
- If warnings remain, list them explicitly in the final report.
