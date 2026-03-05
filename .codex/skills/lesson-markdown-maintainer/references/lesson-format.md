# Lesson Format Reference

## Target files
- `data/project*/<lesson-id>.md`

## Dialogue parsing
- Parsed in `js/dialogue.js`.
- Supported dialogue row format:
  - `**BrSE:** sentence`
  - `*Vietnamese translation*` on next line is optional.
- Supported alternative rows:
  - `JP: ...`
  - `VN: ...`
- Supported timestamp prefix in dialogue text:
  - `[mm:ss]`
  - `[mm:ss.mmm]`
  - `[hh:mm:ss]`

## Vocab and phrase enhancement
- `enhanceLessonContent()` detects vocab section by heading text containing Japanese `単語` or Vietnamese `tu vung`.
- `enhanceLessonContent()` detects phrase section by heading text containing Japanese `フレーズ` or Vietnamese `mau cau`.
- `refineVocabDisplay()` supports item patterns:
  - `term（kana） | meaning`
  - `term | meaning`

## Safe editing guidance
- Keep headings/lists in markdown.
- Keep role labels explicit (`KH`, `BrSE`, or user-defined role).
- Do not remove section separators unless user asks.
