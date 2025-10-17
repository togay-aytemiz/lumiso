# Legacy Component Inventory

This is the single source of truth for what ships today, what is in maintenance mode, and what remains to be deleted. Update it any time a refactor lands or a legacy file is removed.

## 1. Current Production Routes
- `/projects` → `src/pages/AllProjects.tsx`
- `/projects/:id` → `src/pages/ProjectDetail.tsx`
- All other routes follow the declarations in `src/App.tsx`

### Linked refactors (not yet live)
- `src/pages/AllProjectsRefactored.tsx`
- `src/pages/ProjectDetailRefactored.tsx`

## 2. Legacy Folder
- `src/legacy/AllProjectsLegacy.tsx` — archived copy of the previous projects page (kept for reference only).
- `src/legacy/ProjectDetailLegacy.tsx` — archived copy of the previous project detail page.

If a component is intentionally parked, move it here and add a short reason.

## 3. Tooling Snapshots
Run these commands from the project root after each cleanup pass:

```bash
npx ts-prune
npx knip
```

Paste the most recent outputs below (oldest at the bottom) so everyone works from the same list. The next sections will be updated in this PR.

### 3.1 `ts-prune` (unused exports)
```
(no unused exports reported)
```

### 3.2 `knip` (unused files/exports)
```
See docs/architecture/reports/2024-10-17-knip.txt (101 unused files/exports)
```

## 4. Triage Board
Use this table to tag every unused item. When you delete something, strike it out and add a short note.

| Item | Status | Notes |
| --- | --- | --- |
| ~~`debug-workflow-trigger.js`~~ | Deleted | Removed 2024-10-17 (dev helper script) |
| ~~`test-trigger.js`~~ | Deleted | Removed 2024-10-17 (browser helper) |
| `src/components/optimized/**` | Archived | Moved to `src/legacy/components/optimized/` 2024-10-17 |
| `src/components/template-builder/{ImageManager,TemplateEditor,TemplateEditorWithTest}.tsx` | Archived | Moved to `src/legacy/components/template-builder/` 2024-10-17 |
| `src/pages/AllProjectsSimplified.tsx` | Archived | Moved to `src/legacy/pages/AllProjectsSimplified.tsx` 2024-10-17 |
| `src/pages/AllLeadsRefactored.tsx` | Archived | Moved to `src/legacy/pages/AllLeadsRefactored.tsx` 2024-10-17 |
| `src/pages/AllProjectsRefactored.tsx` | Archived | Moved to `src/legacy/pages/AllProjectsRefactored.tsx` 2024-10-17 |
| `src/pages/ProjectDetailRefactored.tsx` | Archived | Moved to `src/legacy/pages/ProjectDetailRefactored.tsx` 2024-10-17 |
| `src/pages/LeadFormExample.tsx` | Archived | Moved to `src/legacy/pages/LeadFormExample.tsx` 2024-10-17 |
| `src/pages/Settings.tsx` | Archived | Moved to `src/legacy/pages/Settings.tsx` 2024-10-17 |

Statuses: `Delete now`, `Needs verification`, `Keep (intentional)`.

## 5. Workflow
1. Update the Tooling Snapshots section.
2. Categorise each finding in the Triage Board.
3. Delete the `Delete now` bucket and re-run the tools.
4. Repeat until both tool outputs are empty or every remaining item is justified.
