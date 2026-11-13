# Contributing

Use Node.js 24. Run `npm run check` before proposing changes. For provider integration run `npm run smoke:ollama` against a running local Ollama with `llama3.2:latest` installed. Apple integration requires macOS 26 and `npm run build:apple`. Keep the bridge local-only, preserve origin and token isolation, add tests for security-sensitive changes, and do not commit credentials or prompts. Contributions are under Apache-2.0.

## Workflow

Install locked dependencies with `npm ci`, then create a focused branch. Use conventional commit subjects (`feat:`, `fix:`, `docs:`). Explain the consumer-visible behavior, privacy implications and observed verification in the PR template. A maintainer reviews security-sensitive changes before merge; contributors do not approve their own work.

## Verification ladder

Start with `npm run check`, then real Ollama smoke for provider changes. Compile and run the Apple self-test for Swift changes. Exercise a real browser when a request contract affects frontend clients. Never paste private prompts, bearer tokens or local model files into issues. See docs/testing.md and SECURITY.md.
