# Data Structure

## Project-based Organization

```
data/
├── outline.json          # Main configuration file
├── project1/            # Project 1: ファイル管理機能
│   ├── 0-1.md
│   ├── 0-2.md
│   ├── 1-1.md
│   └── ...
├── project2/            # Future project 2
│   ├── lesson1.md
│   └── ...
└── project3/            # Future project 3
    └── ...
```

## Adding New Projects

1. Create new folder: `data/project{N}/`
2. Add project to `outline.json`:
   ```json
   {
     "projects": [
       {
         "id": "1",
         "title": "ファイル管理機能",
         // ... existing project
       },
       {
         "id": "2",
         "title": "New Project",
         "description": "Description",
         "icon": "gi-icon-name",
         "groups": [
           {
             "group": "Group Name",
             "items": [
               {
                 "id": "lesson-id",
                 "title": "Lesson Title",
                 "content": "Description",
                 "path": "data/project2/lesson-id.md"
               }
             ]
           }
         ]
       }
     ]
   }
   ```

## File Paths

- Each lesson item in `outline.json` should have a `path` field
- Path format: `data/project{N}/{lesson-id}.md`
- If `path` is missing, it defaults to `data/project1/{id}.md`
