# Observed verification

Environment: arm64 Mac, macOS26 SDK26.2, Swift6.2.3, Node24.10.0. Local acceptance performed during implementation, 2026-11-12/13.

- `npm run check`: 9 behavior tests passed, ESLint and Secretlint passed. Measured loaded-module coverage: 95.69% lines, 79.00% branches, 86.96% functions. This is JavaScript coverage, not Swift or all integration surfaces.
- `npm run build:apple`: compiled successfully with the installed SDK.
- `bin/ownference-apple self-test`: passed combining-mark, flag and joined-emoji scalar deltas and rewrite rejection.
- `node src/cli.js doctor`: Ollama available, Apple available; LM Studio unavailable on this machine.
- `npm run smoke:ollama`: real `ollama:llama3.2:latest` generation passed through an isolated authenticated bridge.
- Actual Apple on-device inference returned “A red kite soared above the tranquil park.” The web workspace also generated using `apple:system` after the scalar/error fixes.
- LM Studio streaming was tested against a deterministic local HTTP fixture, including split UTF-8 and terminal framing. A running LM Studio instance was NOT verified.
- Forged Host defense is tested with raw node:http because Node24 Fetch rewrites a supplied Host header. The 403 assertion was preserved.
- Chrome extension origin grant/use/revoke is regression-tested, including rejection of paths, ports and malformed IDs.

Two independent reviews and a focused re-review found no remaining code blockers. Fixed findings: Chrome-origin canonicalization, Apple scalar deltas, context/guardrail error mapping, backpressure listener cleanup and misleading no-match revocation.

Development dependency audit was clean after pinning patched minimatch11.0.1 for ESLint10 and its config-array. No runtime npm dependencies. Read testing.md for reproducible commands and coverage scope.

GitHub workflows are configured; live status is in the repository Actions tab. Local results above do not imply app-store approval, signing, notarization, public npm publication, remote branch protection or trademark clearance.
