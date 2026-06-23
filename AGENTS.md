# AGENTS.md

Read this. The conventions below catch what an agent will probably get wrong
without being told. For everything else, see `README.md`, `CONTRIBUTING.md`,
`docs/architecture.md`, and the per-directory READMEs (`lib/`, `tools/`,
`test/`).

`AGENTS.md` is the canonical steering file. `CLAUDE.md` and `GEMINI.md` at
the repo root are symlinks to it, so Claude Code, Gemini CLI, Codex, Cursor,
and Aider all read the same content.

> **Why a separate `gemini-extension/CONTEXT.md`?** That file is the runtime
> persona for the Gemini Extension; its content is the end-user persona, not
> contributor steering. The filename is deliberately not `GEMINI.md`.
> Otherwise Gemini CLI's workspace scanner would pull the persona into a
> contributor's coding session.

## Code style

Lint setup is strict. To pass on the first try:

- **No semicolons.** Single quotes. 120-char lines. Trailing commas
  everywhere. `arrowParens: 'avoid'`. Full config in `.prettierrc`.
- **Apache 2.0 copyright header on every `.js` file.** `eslint-plugin-notice`
  rewrites a missing or wrong header on lint; copy the banner from any
  neighbor file when creating a new one. ESLint sets the year from
  `new Date().getFullYear()` in `eslint.config.mjs`, so use the current
  year.
- **JSDoc** is required on top-level `function` and `class` declarations,
  methods, and exported functions. Each block has a description, every
  `@param` typed and described, and `@returns` typed and described. Arrow
  functions, function expressions, and test files (`test/**`,
  `**/*.test.js`) are exempt.
- **ESM only.** `import` / `export`. No `require()`.
- `===` always; `==` is a lint error.
- `nocommit` and `@nocommit` markers fail lint.

## Tests

- **Use Node's built-in `node:test` and `node:assert`.** Do not add jest,
  mocha, vitest, sinon, nock, or msw.
- **For new tests, use `test/local/`, not `test/unit/`.** The `unit/`
  directory is reserved for the feature-flag and connector-enablement unit
  tests; everything else, including API-client and tool tests, is in
  `local/`. See `test/README.md`.
- **Add HTTP fakes by editing `test/helpers/fake-api-server.js`.** Register
  routes there; let the real client classes target them through their
  `rootUrl` override. Don't mock at the `axios` or `googleapis` layer.
- `CEP_BACKEND=fake` is the default for every `npm run` script except
  `test:integration:real`. The real-backend suite has two prerequisites:
  ADC plus a real Workspace tenant. Only run it intentionally.
- **Delete tools** (`delete_agent_dlp_rule`, `delete_detector`) are gated
  by `EXPERIMENT_DELETE_TOOL_ENABLED=true`. Set it in any delete-tool test.

## Adding tools and API clients

Don't reinvent; follow the recipes that already exist:

- **New MCP tool:** see `tools/README.md` § "Adding a new tool". Wrap the
  handler in `guardedToolCall`, return `formatToolResponse(...)`, and
  register it from `tools/index.js`.
- **New Google API:** add a contract under `lib/api/interfaces/`, a real
  implementation as `lib/api/real_*.js`, and register the routes the fakes
  need under `test/helpers/fake-api-server.js`. See `lib/api/README.md`.

## Workflow

- **Run `npm run presubmit` before declaring work done.** Presubmit is
  unit + fake-integration + smoke; no credentials needed. The `pre-push`
  hook is wired to the same suite.
- **Conventional Commits are enforced.** Commitlint is on the `commit-msg`
  hook. Allowed types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`,
  `build`, `ci`, `perf`, `revert`, `style`. Anything else is rejected.
- **Lint-staged auto-fixes formatting on commit.** Don't run
  `npm run format && git add -A` first; lint-staged will only touch what's
  already staged.
- **Don't bypass hooks** with `--no-verify`. If one fails, fix the cause.

## Task Protocol MCP

The Task Protocol MCP server source code is located at `~/task-protocol-mcp` (resolves to `/usr/local/google/home/dylanklein/task-protocol-mcp`). If you need to propose or implement improvements to the task templates (e.g., `templates/core.json`) during a retrospective, you should operate on that directory.
