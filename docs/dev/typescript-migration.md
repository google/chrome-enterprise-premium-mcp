# TypeScript Migration Strategy

This project is migrating from JavaScript to TypeScript using an **Incremental Zero-Touch** approach. This strategy ensures maximum safety, preserves Git history, and avoids breaking the production server during the transition.

## The Four Phases

### Phase 1: Hybrid Infrastructure (Current)

We have enabled a mixed JS/TS environment. The compiler and linter are configured to be "permissive" to allow files to be renamed without requiring immediate type annotations.

### Phase 2: Zero-Touch Migration

Files are migrated from `.js` to `.ts` using the `scripts/migrate-to-ts.py` tool.

- **Pure Renames:** The logic inside the file remains 100% identical to the original JavaScript.
- **Tombstone Shims:** A `.js` shim is created for every migrated file to forward imports from existing JavaScript consumers. This prevents a "chain reaction" of broken imports.
- **Two-Phase Commit:** To preserve Git's "Rename" detection on GitHub, migration is performed in two separate commits within a single PR:
  1. **Commit 1 (Rename):** Executes `git mv` on all target files. This ensures the first commit in the history shows a 100% logic identity rename.
  2. **Commit 2 (Shim):** Adds the `.js` tombstone shims. This keeps the compatibility layer separate from the logic migration.

### Phase 3: Batch Rollout

Migration occurs in logical batches (e.g., `lib/util/`, `lib/api/`) to keep PRs reviewable and rollbacks simple. Always use the `--commit` flag to automate the two-phase commit process for these batches.

### Phase 4: Type Hardening

Once the entire codebase is in `.ts`, we will incrementally:

1. Enable `strict` mode in `tsconfig.json`.
2. Replace `any` with specific interfaces.
3. Delete the `.js` tombstone shims.

## The "Zero-Touch" Guarantee

To maintain safety, **no logic changes, bug fixes, or formatting cleanups** are allowed during Phase 2. The goal is to reach a 1-1 logical identity between the old JS and the new TS.

## Tools

Use `scripts/migrate-to-ts.py <file1.js> [file2.js ...]` to migrate files.

**Recommended usage:**

```bash
python3 scripts/migrate-to-ts.py --commit <path/to/files/*.js>
```

The `--commit` flag automatically handles the two-phase commit workflow, ensuring the PR is easy to review on GitHub.
