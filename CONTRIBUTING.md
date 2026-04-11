# How to contribute

We'd love to accept your patches and contributions to this project.

## Before you begin

### Sign our Contributor License Agreement

Contributions to this project must be accompanied by a
[Contributor License Agreement](https://cla.developers.google.com/about) (CLA).
You (or your employer) retain the copyright to your contribution; this simply
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

If you encounter an issue, please file a GitHub issue with the following:

1. **Generate a diagnostic report** — in your Gemini CLI session, use the `/bug`
   command. This creates a diagnostic file with session logs and environment
   details. Attach it to the issue.

2. **Run presubmit** — run `npm run presubmit` and include the output. This
   helps determine whether the issue is environmental or a code bug.

3. **Describe what you expected** vs. what actually happened, including the
   exact error message.

## Contribution process

### Start with an issue

Before sending a pull request, please open an issue describing the bug or
feature you would like to address. This allows maintainers to guide your design
and implementation before you invest significant effort.

### Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Development

```bash
npm install
```

### Running locally

```bash
npm start             # Stdio mode (default)
npm run mcp-inspector # MCP Inspector (browser-based debugging UI)
```

### Testing

```bash
npm run presubmit             # Unit + fake integration + smoke
npm run test:unit             # Unit tests only
npm run test:integration:fake # Integration tests against fake API server
npm run test:integration:real # Integration tests against real Google APIs
```

### Linting and formatting

```bash
npm run lint          # Check for errors
npm run lint -- --fix # Auto-fix
npm run format        # Prettier
```
