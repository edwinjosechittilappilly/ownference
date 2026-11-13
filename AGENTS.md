# Working in OwnMode

## Repository map

`src/` owns CLI, private grant storage, HTTP authorization and provider adapters. `apple/` owns the on-device Swift process. `test/` exercises the public HTTP and provider seams. `docs/` records architecture, security and verification.

## Commands and verification

Use Node 24 and `npm ci`. `npm run check` runs ESLint, secret scanning and behavior tests with coverage gates. `npm run smoke:ollama` exercises real local Ollama. `npm run build:apple` builds the macOS 26 provider; `bin/ownmode-apple self-test` checks Unicode deltas. See README for live availability and setup.

## Conventions and boundaries

Keep all provider traffic on loopback. Preserve exact-origin grants, token hashing, bounded streams, cancellation and text-only output. Never log tokens/prompts, execute model text, add cloud fallback, or commit local profiles/binaries. The minimatch overrides patch GHSA-g3hv-75wg-m249 in development tooling; verify upstream compatibility before updating them.

## Workflow

Plan observable behavior, add the cheapest meaningful regression, implement, run the relevant verification and update CHANGELOG/docs. Use conventional commits and the PR template. Review security-sensitive changes independently. Never claim a provider or external CI passed without observing it; do not weaken gates to merge.
