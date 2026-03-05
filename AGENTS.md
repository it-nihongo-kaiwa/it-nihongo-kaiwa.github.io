## Skills
Use local skills in this repository first.

### Available skills
- lesson-markdown-maintainer: Maintain lesson markdown files under `data/project*/`.
  (file: ./.codex/skills/lesson-markdown-maintainer/SKILL.md)
- outline-media-sync: Update and validate `data/outline.json` with lesson/media paths.
  (file: ./.codex/skills/outline-media-sync/SKILL.md)
- it-japanese-md-review: Review, score, and auto-fix Japanese IT lesson markdown for stronger business wording.
  (file: ./.codex/skills/it-japanese-md-review/SKILL.md)

### Trigger rules
- Use `lesson-markdown-maintainer` when requests involve creating or editing lesson markdown content, dialogue blocks, vocabulary, or phrase sections.
- Use `outline-media-sync` when requests involve adding/removing lessons or projects, editing `data/outline.json`, or checking consistency with `bg/` and `video/`.
- Use `it-japanese-md-review` when requests involve reviewing Japanese wording, business tone, IT terminology, translation alignment, quality scoring, or automatic improvement for markdown lessons.
- Use both skills when a request touches both lesson files and `outline.json`.
