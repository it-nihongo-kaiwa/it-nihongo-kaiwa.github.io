#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Dict, List, Set, Tuple


def load_outline(path: Path) -> Dict:
    text = path.read_text(encoding="utf-8-sig")
    return json.loads(text)


def collect_md_files(repo_root: Path) -> Set[str]:
    data_dir = repo_root / "data"
    files = set()
    for md in data_dir.rglob("*.md"):
        files.add(md.relative_to(repo_root).as_posix())
    return files


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate outline.json against lesson markdown and media files."
    )
    parser.add_argument(
        "--repo-root",
        default=str(Path(__file__).resolve().parents[4]),
        help="Repository root path. Defaults to current skill location.",
    )
    parser.add_argument(
        "--outline",
        default="data/outline.json",
        help="Path to outline JSON relative to repo root.",
    )
    parser.add_argument(
        "--strict-lessons",
        action="store_true",
        help="Treat missing lesson markdown files as errors instead of warnings.",
    )
    parser.add_argument(
        "--strict-media",
        action="store_true",
        help="Treat missing bg/video files as errors instead of warnings.",
    )
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    outline_path = (repo_root / args.outline).resolve()

    errors: List[str] = []
    warnings: List[str] = []

    if not outline_path.exists():
        print(f"ERROR: outline file not found: {outline_path}")
        return 1

    try:
        data = load_outline(outline_path)
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON in {outline_path}: {exc}")
        return 1

    projects = data.get("projects", [])
    if not isinstance(projects, list):
        print("ERROR: `projects` must be a list in outline.json")
        return 1

    seen_ids: Set[Tuple[str, str]] = set()
    seen_paths: Set[str] = set()
    referenced_paths: Set[str] = set()
    lesson_count = 0

    for project in projects:
        project_id = str(project.get("id", "")).strip()
        if not project_id:
            errors.append("project with missing `id`")
            continue

        groups = project.get("groups", [])
        if not isinstance(groups, list):
            errors.append(f"project {project_id}: `groups` must be a list")
            continue

        for group in groups:
            items = group.get("items", [])
            if not isinstance(items, list):
                errors.append(f"project {project_id}: group has non-list `items`")
                continue

            for item in items:
                lesson_count += 1
                lesson_id = str(item.get("id", "")).strip()
                if not lesson_id:
                    errors.append(f"project {project_id}: item missing `id`")
                    continue

                pair = (project_id, lesson_id)
                if pair in seen_ids:
                    errors.append(f"duplicate lesson id in project {project_id}: {lesson_id}")
                seen_ids.add(pair)

                raw_path = item.get("path")
                if raw_path:
                    path = str(raw_path).strip().replace("\\", "/")
                else:
                    path = f"data/project1/{lesson_id}.md"
                    warnings.append(
                        f"project {project_id} lesson {lesson_id}: missing path, fallback path assumed as {path}"
                    )

                referenced_paths.add(path)

                if path in seen_paths:
                    errors.append(f"duplicate lesson path: {path}")
                seen_paths.add(path)

                expected_prefix = f"data/project{project_id}/"
                if not path.startswith(expected_prefix):
                    warnings.append(
                        f"project {project_id} lesson {lesson_id}: path does not match project folder ({path})"
                    )

                expected_file = f"{lesson_id}.md"
                if not path.endswith(expected_file):
                    warnings.append(
                        f"project {project_id} lesson {lesson_id}: path basename does not match id ({path})"
                    )

                full_md = repo_root / path
                if not full_md.exists():
                    msg = f"project {project_id} lesson {lesson_id}: missing markdown file {path}"
                    if args.strict_lessons:
                        errors.append(msg)
                    else:
                        warnings.append(msg)

                bg_path = repo_root / f"bg/project{project_id}/{lesson_id}.png"
                vid_path = repo_root / f"video/project{project_id}/{lesson_id}.mp4"
                if not bg_path.exists():
                    msg = f"project {project_id} lesson {lesson_id}: missing bg asset bg/project{project_id}/{lesson_id}.png"
                    if args.strict_media:
                        errors.append(msg)
                    else:
                        warnings.append(msg)
                if not vid_path.exists():
                    msg = f"project {project_id} lesson {lesson_id}: missing video asset video/project{project_id}/{lesson_id}.mp4"
                    if args.strict_media:
                        errors.append(msg)
                    else:
                        warnings.append(msg)

    all_md = collect_md_files(repo_root)
    orphan_md = sorted(
        p for p in all_md if p.startswith("data/project") and p not in referenced_paths
    )
    for path in orphan_md:
        warnings.append(f"unreferenced lesson markdown: {path}")

    print("Outline sync report")
    print(f"- repository: {repo_root}")
    print(f"- outline: {outline_path.relative_to(repo_root).as_posix()}")
    print(f"- projects: {len(projects)}")
    print(f"- lessons: {lesson_count}")
    print(f"- errors: {len(errors)}")
    print(f"- warnings: {len(warnings)}")

    for err in errors:
        print(f"ERROR: {err}")
    for warn in warnings:
        print(f"WARN: {warn}")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
