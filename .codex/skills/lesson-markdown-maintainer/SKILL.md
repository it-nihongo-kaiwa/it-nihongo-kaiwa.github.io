---
name: lesson-markdown-maintainer
description: Maintain lesson markdown files for this repository under data/project*/. Use when Codex needs to create or edit lesson dialogue, vocabulary, phrase sections, timestamps, or markdown structure while keeping compatibility with js/dialogue.js and lesson rendering pages.
---

# Lesson Markdown Maintainer

## Workflow
1. Identify lesson target file under `data/project*/<lesson-id>.md`.
2. Read `references/lesson-format.md` before editing.
3. Preserve existing structure and section order unless user asks to restructure.
4. Keep dialogue syntax compatible with `js/dialogue.js` parsing rules.
5. After edits, check that markdown still contains expected sections and no malformed dialogue rows.
6. If lesson path or ID changes, invoke `outline-media-sync` to update `data/outline.json`.

## Editing Rules
- Keep markdown simple and renderer-friendly. Do not insert HTML unless user asks.
- Keep role lines in this shape: `**Role:** text`.
- Keep optional translated line in this shape: `*translation text*` directly below role line.
- Keep optional timestamps in dialogue text as `[mm:ss]`, `[mm:ss.mmm]`, or `[hh:mm:ss]`.
- Keep vocabulary and phrase lists as markdown lists so `enhanceLessonContent()` and `refineVocabDisplay()` can process them.
- Preserve multilingual content as-is. Do not normalize script or transliteration unless requested.

## Quality Checklist
- Dialogue blocks render from bold role labels.
- Each changed section has valid markdown heading/list syntax.
- No accidental removal of required lesson content.
- Paths or IDs mentioned in content still match file name when applicable.
