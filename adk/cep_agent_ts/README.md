# Chrome Enterprise Premium Agent (TypeScript)

This directory contains the TypeScript implementation of the Chrome Enterprise Premium (CEP) agent. It replaces the previous Python implementation with a modern Node.js/TypeScript stack.

## Architecture

```text
adk/cep_agent_ts/
├── src/
│   ├── agent.ts           # Agent Factory and definitions
│   ├── base-agent.ts      # Base Agent logic (Vertex AI interaction)
│   ├── constants.ts       # Centralized configuration
│   ├── index.ts           # CLI entry point
│   ├── sub-agent-tool.ts  # Tool adapter for sub-agents
│   └── util/
│       ├── mcp-client.ts  # MCP Server connection wrapper
│       └── vertex-ai-adapter.ts # Tool schema adapter
├── package.json
├── tsconfig.json
└── .env.example
```

## Prerequisites

- Node.js (v18 or higher)
- npm
- Google Cloud Project with Vertex AI API enabled

## Setup

1.  **Install dependencies:**

    ```bash
    npm install
    ```

2.  **Configure environment:**

    Copy the example environment file and set your Google Cloud Project ID:

    ```bash
    cp .env.example .env
    ```

    Edit `.env` and set `GOOGLE_CLOUD_PROJECT` to your project ID.

## Usage

To start the agent CLI:

```bash
npm start
```

This will launch the interactive agent shell. You can type queries like:

- "Run a health check"
- "My download rules are broken"
- "Help me onboard"

## Development

- **Build:** The project uses `tsx` for direct execution during development. To compile to JS (for production), you can add a build script in `package.json` using `tsc`.
- **Testing:** Run `npm test` to execute tests.

## License

Copyright 2026 Google LLC. Licensed under the Apache License, Version 2.0.
