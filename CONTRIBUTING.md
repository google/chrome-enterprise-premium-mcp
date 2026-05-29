# How to contribute

We'd love to accept your patches and contributions to this project.

## Before you begin

### Sign our Contributor License Agreement

Contributions to this project must be accompanied by a
[Contributor License Agreement](https://cla.developers.google.com/about) (CLA).
You (or your employer) retain the copyright to your contribution; the CLA only
gives us permission to use and redistribute your contributions as part of the
project.

If you or your current employer have already signed the Google CLA (even if it
was for a different project), you probably don't need to do it again.

Visit <https://cla.developers.google.com/> to see your current agreements or to
sign a new one.

### Review our community guidelines

This project follows
[Google's Open Source Community Guidelines](https://opensource.google/conduct/).

## Reporting bugs

If you encounter an issue, file a GitHub issue with the following:

1. **Generate a diagnostic report.** In your Gemini CLI session, use the
   `/bug` command. This creates a diagnostic file with session logs and
   environment details. Attach it to the issue.

2. **Run presubmit.** Run `npm run presubmit` and paste the output. The
   output lets maintainers tell environmental problems from real code bugs.

3. **Describe what you expected** vs. what actually happened, including the
   exact error message.

## Contribution process

### Start with an issue

Before sending a pull request, open an issue describing the bug or feature
you want to address. Maintainers can then guide your design and
implementation before you invest significant effort.

### Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Development

### 1. Local Development Setup

To set up a local environment for developing and testing the server:

1.  **Clone & Install:**

    ```bash
    git clone https://github.com/google/chrome-enterprise-premium-mcp.git
    cd chrome-enterprise-premium-mcp
    npm install
    ```

2.  **Sign In Locally:**
    Run the auth CLI using the local package script to cache your credentials:

    ```bash
    npm run auth:login
    ```

3.  **Connect Local Server:**
    To test your local changes with an MCP client (like Claude or VSCode), point the client's configuration to `node` and the absolute path of your local `mcp-server.js`:
    ```json
    {
      "mcpServers": {
        "cep-dev": {
          "command": "node",
          "args": ["/absolute/path/to/chrome-enterprise-premium-mcp/mcp-server.js"],
          "env": { "GCP_STDIO": "true" }
        }
      }
    }
    ```

### 2. Running Locally

Use these convenience scripts for local runtime tasks:

```bash
npm start             # Starts the stdio server locally
npm run auth:login    # Runs the OAuth login flow
npm run auth:status   # Shows local OAuth credential status
npm run mcp-inspector # Launches the browser-based MCP Inspector debugging UI
```

### 3. Testing

Run the tests using the npm scripts:

```bash
npm run presubmit             # Runs the full presubmit suite (unit + fake integration + smoke)
npm run test:unit             # Runs unit tests only
npm run test:integration:fake # Runs integration tests against the in-process fake API server
npm run test:integration:real # Runs integration tests against real Google APIs (requires ADC)
```

### 4. Linting & Formatting

We enforce strict style rules. Use these commands to format and validate your changes:

```bash
npm run lint          # Check for linter and style errors (read-only)
npm run lint -- --fix # Automatically fix linter issues
npm run format        # Automatically fix formatting using Prettier
```

`npm run presubmit` runs linter and formatter checks in read-only mode and will fail on violations. However, a pre-commit hook is configured to automatically format and lint your staged files when you commit, so commits made from a clean working tree usually pass automatically.

### 5. Continuous Integration (CI)

On every pull request, GitHub Actions runs four parallel jobs (`lint`, `test-unit`, `test-integration-fake`, and `test-smoke`) corresponding to the npm scripts above. The CI jobs run hermetically without GCP credentials, ensuring that tests do not rely on external state. The workflow configuration is located at [`.github/workflows/node.js.yml`](.github/workflows/node.js.yml).
