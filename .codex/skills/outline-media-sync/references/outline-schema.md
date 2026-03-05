# Outline Schema Reference

## Primary source
- `data/outline.json`

## Key structure
- `projects[]`
  - `id`: project id string, such as `"1"`, `"2"`.
  - `groups[]`
    - `group`: section title.
    - `items[]`
      - `id`: lesson id, usually `<phase>-<index>`.
      - `title`: lesson title.
      - `content`: short description (optional but common).
      - `path`: markdown path, usually `data/project<id>/<id>.md`.

## Runtime assumptions in code
- Lesson pages load markdown by `path` query or derived path logic.
- Renderer uses `path` directly when available.
- If `path` is absent in some code paths, fallback may use `data/project1/<id>.md`.

## Asset conventions
- Background image: `bg/project<id>/<lesson-id>.png`
- Video: `video/project<id>/<lesson-id>.mp4`
- Missing media can be acceptable.
- Missing markdown files can be warnings for draft lessons, or hard errors in strict mode.
