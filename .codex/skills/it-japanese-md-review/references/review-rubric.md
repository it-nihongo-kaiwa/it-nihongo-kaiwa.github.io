# IT Japanese Markdown Review Rubric

## Scoring scale
- `5`: Excellent, no meaningful correction needed.
- `4`: Good, minor polish only.
- `3`: Understandable but has notable issues.
- `2`: Multiple issues reduce quality.
- `1`: Major issues, requires rewrite.
- `0`: Not usable.

## Categories
1. `japanese_naturalness`
- Check grammar, particles, collocations, and sentence flow.
- Flag literal Vietnamese-to-Japanese translation patterns.

2. `business_tone`
- Check polite and professional style for workplace dialogue.
- Prefer consistent `です/ます` style and respectful requests (`〜いただけますか`, `〜お願いできますか`).

3. `it_terminology`
- Check terms are correct and consistent in IT project context.
- Prefer stable usage for words like `要件定義`, `設計`, `実装`, `テスト`, `障害`, `リリース`, `レビュー`.

4. `translation_alignment`
- Check Japanese line and Vietnamese explanation match intent.
- Flag missing translation lines when surrounding lines include translations.

5. `markdown_structure`
- Check headings and dialogue syntax are parser-compatible.
- Dialogue lines should follow `**Role:** ...` pattern.

## Severity labels
- `high`: Meaning can be misunderstood, business tone inappropriate, or structure breaks rendering.
- `medium`: Understandable but unnatural/unclear.
- `low`: Style polish.

## Review output template
- Summary score: `<total>/25`
- Findings:
  - `[severity] path:line - issue`
  - `Suggestion (JA): ...`
  - `Note (VN): ...` (optional)
