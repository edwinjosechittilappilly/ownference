# Testing and release verification

## Reproducible checks

Use Node24 and `npm ci --ignore-scripts`, then `npm run check`. The gate runs ESLint recommended rules, Secretlint and deterministic consumer behavior tests. The web SDK also runs strict declaration/consumer typechecks. Core loaded JavaScript modules are coverage-gated at 85% lines, 70% branches and 70% functions. This is not a claim of full browser UI or Swift coverage. No runtime dependencies are required.

`npm run smoke:ollama` uses a temporary grant/config and ephemeral HTTP server against real Ollama. Compile Apple with `npm run build:apple` and run `bin/ownference-apple self-test`; actual Apple inference requires device/model availability. `node src/cli.js doctor` reports providers separately. LM Studio protocol tests use a deterministic local HTTP fixture and are not proof of a running LM Studio install.

## Supply chain and CI

Run `npm audit --audit-level=moderate`. Development-tool overrides pin minimatch11.0.1 for ESLint and its config-array to address GHSA-g3hv-75wg-m249 without downgrading to an unsupported ESLint release. Re-evaluate the overrides when upstream dependency ranges change; lint behavior is verified with the patched toolchain.

CI uses pinned upstream action commits, least-privilege job permissions, npm lockfiles and one aggregate ci-success job. Runtime CI also compiles Swift and runs its scalar self-test on macOS26. CodeQL is enabled only for public repositories; private personal repositories may not have code-scanning entitlement. Branch protection is a remote account setting, not something a YAML file guarantees.

## Evidence discipline

Report exact commands and observed results. Deterministic provider fixtures prove protocol/error behavior, not model inference. Real Ollama tests require an installed model and a running server. Provider availability, app-store approval, signing/notarization and trademark clearance are separate claims and must never be inferred from a green unit suite.

The baseline ShipShape scanner report is retained in shipshape-audit.md. It is a static heuristic, not a security or production certification; no score is used as a replacement for the real checks above.
