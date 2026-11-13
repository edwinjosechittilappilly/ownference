# Repository audit: ownference

Historical audit of the repository before the OwnMode rebrand; findings reflect the state at the time of the audit.

**Overall score: 54.8% (grade F)**  
Detected stacks: node · traits: github actions  
Checks: 27 pass · 8 partial · 30 fail · 31 not applicable (65 scored of 96)  
Files scanned: 32 · scope: all

## Scorecard

| Category | Weight | Score | Grade | Pass / Partial / Fail |
| --- | ---: | ---: | :---: | :---: |
| Documentation & onboarding | 10 | 38.2% | F | 2 / 3 / 5 |
| Agent readiness | 12 | 14.3% | F | 0 / 2 / 8 |
| CI/CD | 16 | 76.7% | C | 10 / 0 / 4 |
| Code quality | 12 | 43.8% | F | 2 / 0 / 4 |
| Testing | 14 | 64.3% | D | 3 / 0 / 2 |
| Security & supply chain | 14 | 81.8% | B | 7 / 1 / 1 |
| PR & issue hygiene | 6 | 32.1% | F | 1 / 1 / 5 |
| Containers & deployment | 8 | n/a (excluded) | - | 0 / 0 / 0 |
| Developer experience | 4 | 70.0% | C | 2 / 1 / 1 |
| Frontend health | 4 | n/a (excluded) | - | 0 / 0 / 0 |

## Top fixes (by score impact, then effort)

| # | Check | Status | Gain | Effort | Fix |
| ---: | --- | :---: | ---: | :---: | --- |
| 1 | `TEST-INTEGRATION` Integration tests against real dependencies | FAIL | +3.4 | M | Add tests/integration/ that exercise the HTTP layer against a real database (compose or testcontainers) behind `make test-integration`. |
| 2 | `QUAL-FORMAT` Formatter enforced per language | FAIL | +2.6 | S | Add the formatter, a `make format` (writes) target and a check-only variant inside `make lint`. |
| 3 | `QUAL-TYPES` Static type checking | FAIL | +2.6 | M | Add mypy (or pyright) / tsc --noEmit and wire them into `make typecheck` and CI. |
| 4 | `TEST-COVERAGE` Coverage measured with a threshold | FAIL | +2.3 | S | Enable coverage in the test target and set a fail-under ratchet (start at the current value). |
| 5 | `SEC-SECRETS` Secret scanning | FAIL | +2.2 | S | Add a gitleaks pre-commit hook and CI step plus a .gitleaks.toml allowlist for test fixtures. |
| 6 | `DOC-README-RUN` README shows how to install, run and test | FAIL | +2.0 | S | Add Quickstart (prerequisites, one setup command, run command) and Testing sections with copy-pasteable commands. |
| 7 | `AGT-INSTR-QUALITY` Instructions are actionable | FAIL | +1.9 | S | Add the missing sections; keep the file short and link to docs/ for depth. |
| 8 | `AGT-SKILLS` Reusable agent skills | FAIL | +1.9 | M | Add skills for your recurring workflows: pull-request, code-review, planning, ci-triage, tests. |
| 9 | `CI-GATE` Single aggregate required check | FAIL | +1.8 | S | Add a `ci-success` job with `needs: [all jobs]`, `if: always()` and a step failing on failure/cancelled results; require only it. |
| 10 | `QUAL-PRECOMMIT` Pre-commit hooks | FAIL | +1.7 | S | Add .pre-commit-config.yaml (whitespace, yaml/json checks, formatter, secret scan) and run it in CI. |

## Quick wins (effort S)

- `QUAL-FORMAT` (+2.6): Add the formatter, a `make format` (writes) target and a check-only variant inside `make lint`.
- `TEST-COVERAGE` (+2.3): Enable coverage in the test target and set a fail-under ratchet (start at the current value).
- `SEC-SECRETS` (+2.2): Add a gitleaks pre-commit hook and CI step plus a .gitleaks.toml allowlist for test fixtures.
- `DOC-README-RUN` (+2.0): Add Quickstart (prerequisites, one setup command, run command) and Testing sections with copy-pasteable commands.
- `AGT-INSTR-QUALITY` (+1.9): Add the missing sections; keep the file short and link to docs/ for depth.
- `CI-GATE` (+1.8): Add a `ci-success` job with `needs: [all jobs]`, `if: always()` and a step failing on failure/cancelled results; require only it.
- `QUAL-PRECOMMIT` (+1.7): Add .pre-commit-config.yaml (whitespace, yaml/json checks, formatter, secret scan) and run it in CI.
- `AGT-INSTRUCTIONS` (+1.3): Write AGENTS.md (agent-agnostic): commands, repo map, conventions, verification ladder, hard boundaries.

## Findings by category

### Documentation & onboarding (38.2%, weight 10)

| Check | Status | Evidence |
| --- | :---: | --- |
| `DOC-README` README with substance | PARTIAL | README.md is a stub (20 non-blank lines) |
| `DOC-README-RUN` README shows how to install, run and test | FAIL | no runnable commands in the README |
| `DOC-LICENSE` License file | PASS | LICENSE |
| `DOC-CONTRIB` CONTRIBUTING guide | PARTIAL | CONTRIBUTING.md is thin (2 lines) |
| `DOC-COC` Code of conduct | FAIL | no CODE_OF_CONDUCT.md |
| `DOC-CHANGELOG` Changelog or release notes source | PASS | CHANGELOG.md |
| `DOC-DOCS` docs/ directory | PARTIAL | only 1 documents; add architecture/testing/deployment guides |
| `DOC-ARCH` Architecture overview | FAIL | no architecture document |
| `DOC-ADR` Architecture decision records | FAIL | no ADR directory |
| `DOC-PLANS` Planning documents (plans/RFCs) | FAIL | no plans/RFC directory |
| `DOC-PKG-README` Each package has its own README | N/A | single-package repository |

Remediation:

- **DOC-README** (effort S): Write a README: purpose, quickstart, layout, how to test, where docs/contributing live. Template: [README.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/README.md)
- **DOC-README-RUN** (effort S): Add Quickstart (prerequisites, one setup command, run command) and Testing sections with copy-pasteable commands. Template: [README.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/README.md)
- **DOC-CONTRIB** (effort S): Document setup, branching, commit/PR conventions, the verification ladder and review expectations. Template: [CONTRIBUTING.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/CONTRIBUTING.md)
- **DOC-COC** (effort S): Adopt the Contributor Covenant and add a reporting contact. Template: [CODE_OF_CONDUCT.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/CODE_OF_CONDUCT.md)
- **DOC-DOCS** (effort M): Create docs/ with an index plus architecture, testing and deployment guides. Template: [docs/README.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/README.md), [docs/architecture.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/architecture.md), [docs/testing.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/testing.md)
- **DOC-ARCH** (effort S): Write docs/architecture.md: components, data flow, key decisions, where code lives. Template: [docs/architecture.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/architecture.md)
- **DOC-ADR** (effort S): Adopt ADRs: add docs/adr/README.md, a template and one record per significant decision. Template: [docs/adr/README.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/adr/README.md), [docs/adr/0000-template.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/adr/0000-template.md)
- **DOC-PLANS** (effort S): Add docs/plans/ with a TEMPLATE.md (goal, slices, acceptance, risks) and write plans for non-trivial work. Template: [docs/plans/README.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/plans/README.md), [docs/plans/TEMPLATE.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/plans/TEMPLATE.md)

### Agent readiness (14.3%, weight 12)

| Check | Status | Evidence |
| --- | :---: | --- |
| `AGT-INSTRUCTIONS` Agent instruction file (AGENTS.md) | PARTIAL | AGENTS.md is a stub (2 lines) |
| `AGT-INSTR-QUALITY` Instructions are actionable | FAIL | 2/6 signals; missing: conventions, repo map, verification, workflow |
| `AGT-CLAUDE-BRIDGE` CLAUDE.md points at AGENTS.md | FAIL | AGENTS.md exists but CLAUDE.md does not, so Claude Code will not load it |
| `AGT-SKILLS` Reusable agent skills | FAIL | no skills directory with SKILL.md files |
| `AGT-SKILLS-VALID` Skill files are well-formed | N/A | no skills |
| `AGT-HOOKS` Agent hooks (guard, format, stop gate) | FAIL | no agent hook configuration |
| `AGT-PERMISSIONS` Agent permission allow/deny lists | FAIL | no agent permission configuration |
| `AGT-ISSUE-TEMPLATE` Agent-ready issue template | PARTIAL | .github/ISSUE_TEMPLATE/feature_request.yml has acceptance criteria but no verification/out-of-scope/agent fields |
| `AGT-REVIEW` Automated/agent code review configured | FAIL | no automated review tooling and no review skill |
| `AGT-DOCS` Agent workflow documentation | FAIL | no agent workflow documentation under docs/ |
| `AGT-COMMANDS` Custom agent commands | FAIL | no custom agent commands |
| `AGT-LABELS` Agent labels exist | N/A | no labels-as-code file |

Remediation:

- **AGT-INSTRUCTIONS** (effort S): Write AGENTS.md (agent-agnostic): commands, repo map, conventions, verification ladder, hard boundaries. Template: [AGENTS.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/AGENTS.md)
- **AGT-INSTR-QUALITY** (effort S): Add the missing sections; keep the file short and link to docs/ for depth. Template: [AGENTS.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/AGENTS.md)
- **AGT-CLAUDE-BRIDGE** (effort S): Create CLAUDE.md containing `@AGENTS.md` plus any Claude-specific notes (or symlink it). Template: [CLAUDE.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/CLAUDE.md)
- **AGT-SKILLS** (effort M): Add skills for your recurring workflows: pull-request, code-review, planning, ci-triage, tests. Template: [.agents/skills/pull-request/SKILL.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.agents/skills/pull-request/SKILL.md), [.agents/skills/code-review/SKILL.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.agents/skills/code-review/SKILL.md), [.agents/skills/ci-triage/SKILL.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.agents/skills/ci-triage/SKILL.md)
- **AGT-HOOKS** (effort M): Add hooks that block destructive shell commands, auto-format edited files and run a fast check before the agent stops. Template: [.claude/settings.json](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.claude/settings.json), [.codex/hooks.json](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.codex/hooks.json), [.cursor/hooks.json](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.cursor/hooks.json), [scripts/agent-hooks/](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/scripts/agent-hooks/)
- **AGT-PERMISSIONS** (effort S): Add allow rules for make/test/read-only git+gh and deny rules for .env, *.pem, secrets/ and ssh keys. Template: [.claude/settings.json](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.claude/settings.json)
- **AGT-ISSUE-TEMPLATE** (effort S): Add an issue form (e.g. 'task') with Goal, Acceptance criteria, Out of scope, How to verify and an agent-ready checkbox. Template: [.github/ISSUE_TEMPLATE/task.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/ISSUE_TEMPLATE/task.yml)
- **AGT-REVIEW** (effort M): Add .coderabbit.yaml (or equivalent) with path instructions and a code-review skill that mirrors your review rubric. Template: [.coderabbit.yaml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.coderabbit.yaml), [.agents/skills/code-review/SKILL.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.agents/skills/code-review/SKILL.md), [.github/workflows/agent-review.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/workflows/agent-review.yml)
- **AGT-DOCS** (effort S): Document the agent workflow: roles, labels, review flow, escalation (`status: needs-human`), what agents may never do. Template: [docs/agents/](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/agents/)
- **AGT-COMMANDS** (effort S): Add commands for plan, review and verify that invoke the matching skills. Template: [.claude/commands/](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.claude/commands/)

### CI/CD (76.7%, weight 16)

| Check | Status | Evidence |
| --- | :---: | --- |
| `CI-EXISTS` CI is configured | PASS | 2 CI file(s), e.g. .github/workflows/ci.yml |
| `CI-PR-TRIGGER` Checks run on pull requests | PASS | 2 workflow(s) run on PRs |
| `CI-LINT` CI runs lint/format/type checks | PASS | lint/typecheck: run by CI via the task runner/scripts |
| `CI-TEST` CI runs the tests | PASS | tests: run by CI via the task runner/scripts |
| `CI-BUILD` CI builds the artefact | FAIL | no build found in CI or in the task runner CI calls |
| `CI-GATE` Single aggregate required check | FAIL | 3 jobs run on PRs and none aggregates them; branch protection would have to list each one |
| `CI-CONCURRENCY` Stale runs are cancelled | PASS | .github/workflows/ci.yml cancels in-progress runs |
| `CI-TIMEOUTS` Jobs have timeouts | PASS | 3/3 jobs set timeout-minutes |
| `CI-PERMISSIONS` Least-privilege workflow permissions | PASS | 2/2 workflows scope permissions |
| `CI-PINNED` Actions pinned to commit SHAs | PASS | 5/5 action references pinned to a SHA |
| `CI-PATHS` Path filters in monorepo CI | N/A | single-package repository or non-GitHub CI |
| `CI-CACHE` Dependency caching | PASS | dependency caching configured |
| `CI-RELEASE` Release workflow | FAIL | no release or publish automation |
| `CI-DEPLOY` Deployment is automated or verified in CI | N/A | no deployable artefacts (Dockerfile, charts, IaC) |
| `CI-ACTIONLINT` Workflow files are linted | FAIL | no workflow linter found in CI or in the task runner CI calls |
| `CI-SCHEDULE` Scheduled run catches drift | PASS | cron in .github/workflows/codeql.yml |

Remediation:

- **CI-BUILD** (effort S): Add a build job (and a container image build if you ship one). Template: [.github/workflows/ci.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/workflows/ci.yml)
- **CI-GATE** (effort S): Add a `ci-success` job with `needs: [all jobs]`, `if: always()` and a step failing on failure/cancelled results; require only it. Template: [.github/workflows/ci.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/workflows/ci.yml)
- **CI-RELEASE** (effort M): Add a release workflow triggered on version tags that builds, publishes and creates release notes. Template: [.github/release.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/release.yml), [.github/workflows/ci.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/workflows/ci.yml)
- **CI-ACTIONLINT** (effort S): Run actionlint in CI (pinned, checksum-verified) and in pre-commit. Template: [.github/workflows/ci.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/workflows/ci.yml), [scripts/ci/install-tool.sh](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/scripts/ci/install-tool.sh)

### Code quality (43.8%, weight 12)

| Check | Status | Evidence |
| --- | :---: | --- |
| `QUAL-LINT` Linter configured per language | PASS | js: eslint/biome configured |
| `QUAL-FORMAT` Formatter enforced per language | FAIL | js: no prettier/biome |
| `QUAL-TYPES` Static type checking | FAIL | js: plain JavaScript, no type checking |
| `QUAL-STRICT` Type checker runs in strict mode | N/A | no Python or TypeScript |
| `QUAL-PRECOMMIT` Pre-commit hooks | FAIL | no pre-commit framework |
| `QUAL-EDITORCONFIG` .editorconfig | FAIL | no .editorconfig |
| `QUAL-LOCKFILES` Dependency lockfiles committed | PASS | 1/1 manifests locked |
| `QUAL-SHELLCHECK` Shell scripts are linted | N/A | no shell scripts |

Remediation:

- **QUAL-FORMAT** (effort S): Add the formatter, a `make format` (writes) target and a check-only variant inside `make lint`. Template: [backend/pyproject.toml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/backend/pyproject.toml), [frontend/.prettierrc.json](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/frontend/.prettierrc.json)
- **QUAL-TYPES** (effort M): Add mypy (or pyright) / tsc --noEmit and wire them into `make typecheck` and CI. Template: [backend/pyproject.toml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/backend/pyproject.toml), [frontend/tsconfig.json](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/frontend/tsconfig.json)
- **QUAL-PRECOMMIT** (effort S): Add .pre-commit-config.yaml (whitespace, yaml/json checks, formatter, secret scan) and run it in CI. Template: [.pre-commit-config.yaml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.pre-commit-config.yaml)
- **QUAL-EDITORCONFIG** (effort S): Add .editorconfig with indent style/size, final newline and trailing-whitespace rules. Template: [.editorconfig](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.editorconfig)

### Testing (64.3%, weight 14)

| Check | Status | Evidence |
| --- | :---: | --- |
| `TEST-UNIT` Automated tests exist | PASS | 2 test files for 5 source files (ratio 0.40) |
| `TEST-ASSERT` Tests assert behaviour | PASS | 2/2 sampled test files contain assertions; 0 skipped of ~8 tests (0%) |
| `TEST-INTEGRATION` Integration tests against real dependencies | FAIL | no integration tests |
| `TEST-E2E` End-to-end tests | N/A | not a service/application |
| `TEST-CONFIG` Test runner configured and runnable by one command | PASS | js: test script/config |
| `TEST-CI-SLOW` Integration/e2e tests run in CI | N/A | no integration/e2e tests |
| `TEST-COVERAGE` Coverage measured with a threshold | FAIL | no coverage measurement |

Remediation:

- **TEST-INTEGRATION** (effort M): Add tests/integration/ that exercise the HTTP layer against a real database (compose or testcontainers) behind `make test-integration`. Template: [backend/tests/integration/](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/backend/tests/integration/), [docs/testing.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/docs/testing.md)
- **TEST-COVERAGE** (effort S): Enable coverage in the test target and set a fail-under ratchet (start at the current value). Template: [backend/pyproject.toml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/backend/pyproject.toml), [frontend/vite.config.ts](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/frontend/vite.config.ts)

### Security & supply chain (81.8%, weight 14)

| Check | Status | Evidence |
| --- | :---: | --- |
| `SEC-SCANNER` Vulnerability scanner in CI | PASS | vulnerability scanner: run by CI |
| `SEC-SECRETS` Secret scanning | FAIL | no secret scanning |
| `SEC-DEPBOT` Automated dependency updates | PASS | .github/dependabot.yml covers: github-actions, npm |
| `SEC-CODEOWNERS` CODEOWNERS | PASS | .github/CODEOWNERS: 1 rules |
| `SEC-POLICY` SECURITY.md vulnerability policy | PARTIAL | SECURITY.md is thin: add a private reporting channel |
| `SEC-ENV-IGNORED` .env files are gitignored | PASS | .gitignore ignores .env files |
| `SEC-NO-SECRETS` No committed secrets or private keys | PASS | scanned 28 files and file names: none found |
| `SEC-SAST` Static application security testing (SAST) | PASS | SAST scanner: run by CI |
| `SEC-IAC-SCAN` Container/IaC misconfiguration scanning | N/A | no Dockerfile/Kubernetes/IaC files |
| `SEC-CHECKOUT` Checkout does not persist credentials | PASS | 2/2 checkouts set persist-credentials: false |
| `SEC-PRT` pull_request_target used safely | N/A | pull_request_target not used |
| `SEC-PROVENANCE` SBOM / signing / provenance | N/A | no images or release workflow |

Remediation:

- **SEC-SECRETS** (effort S): Add a gitleaks pre-commit hook and CI step plus a .gitleaks.toml allowlist for test fixtures. Template: [.gitleaks.toml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.gitleaks.toml), [.pre-commit-config.yaml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.pre-commit-config.yaml), [.github/workflows/security.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/workflows/security.yml)
- **SEC-POLICY** (effort S): Add SECURITY.md: supported versions, private reporting channel, response expectations. Template: [SECURITY.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/SECURITY.md)

### PR & issue hygiene (32.1%, weight 6)

| Check | Status | Evidence |
| --- | :---: | --- |
| `HYG-PR-TEMPLATE` PR template with required sections | PARTIAL | .github/pull_request_template.md exists but lacks summary and/or verification sections |
| `HYG-PR-CHECK` PR title/description validated in CI | FAIL | no PR title/description validation |
| `HYG-ISSUE-FORMS` Issue forms | PASS | 2 issue forms |
| `HYG-ISSUE-CONFIG` Issue chooser configured | FAIL | no issue chooser config |
| `HYG-LABELS-CODE` Labels defined as code | FAIL | no labels-as-code file |
| `HYG-LABELER` Automatic PR labeling | FAIL | no automatic PR labeling |
| `HYG-RELEASE-NOTES` Release notes categories configured | FAIL | no release notes configuration |

Remediation:

- **HYG-PR-TEMPLATE** (effort S): Add .github/pull_request_template.md: Summary, Linked issue, Changes, Verification, Risk and rollback, Checklist. Template: [.github/pull_request_template.md](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/pull_request_template.md)
- **HYG-PR-CHECK** (effort M): Add a pr-checks workflow that validates the title and required headings (adapt scripts/ci/check_pr.py). Template: [.github/workflows/pr-checks.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/workflows/pr-checks.yml), [scripts/ci/check_pr.py](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/scripts/ci/check_pr.py)
- **HYG-ISSUE-CONFIG** (effort S): Add config.yml: `blank_issues_enabled: false` and contact links (discussions, security policy). Template: [.github/ISSUE_TEMPLATE/config.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/ISSUE_TEMPLATE/config.yml)
- **HYG-LABELS-CODE** (effort S): Add .github/labels.yml and a sync workflow (labels-sync.yml). Template: [.github/labels.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/labels.yml), [.github/workflows/labels-sync.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/workflows/labels-sync.yml)
- **HYG-LABELER** (effort M): Add labeler.yml path rules and a pr-labeler workflow (type from title, size from diff). Template: [.github/labeler.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/labeler.yml), [.github/workflows/pr-labeler.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/workflows/pr-labeler.yml), [scripts/ci/pr_labels.py](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/scripts/ci/pr_labels.py)
- **HYG-RELEASE-NOTES** (effort S): Add .github/release.yml mapping labels to changelog categories. Template: [.github/release.yml](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.github/release.yml)

### Containers & deployment (excluded: not applicable, weight 8)

| Check | Status | Evidence |
| --- | :---: | --- |
| `CTN-DOCKERFILE` Service is containerised | N/A | not a service/application |
| `CTN-USER` Images run as a non-root user | N/A | no Dockerfile |
| `CTN-NO-LATEST` Base images pinned (no :latest) | N/A | no Dockerfile |
| `CTN-DIGEST` Base images pinned by digest | N/A | no external base images |
| `CTN-MULTISTAGE` Multi-stage builds | N/A | no Dockerfile |
| `CTN-DOCKERIGNORE` .dockerignore present | N/A | no Dockerfile |
| `CTN-COMPOSE` Local stack via Compose | N/A | no Dockerfile |
| `CTN-DEPLOY-DESC` Deployment is described as code | N/A | not a service/application |
| `CTN-K8S-PROBES` Kubernetes workloads define probes | N/A | no Kubernetes workloads |
| `CTN-K8S-RESOURCES` Kubernetes workloads set resource requests/limits | N/A | no Kubernetes workloads |
| `CTN-K8S-SECCTX` Kubernetes security context hardened | N/A | no Kubernetes workloads |
| `CTN-IAC` Infrastructure as code | N/A | not a service/application |
| `CTN-HELM-LINT` Helm charts are linted/validated in CI | N/A | no Helm charts |

### Developer experience (70.0%, weight 4)

| Check | Status | Evidence |
| --- | :---: | --- |
| `DX-TASKRUNNER` Task runner with standard targets | PARTIAL | covers lint, test; missing format, setup, run |
| `DX-ENV-EXAMPLE` .env.example documents configuration | N/A | not a service/application |
| `DX-TOOLCHAIN` Toolchain versions pinned | PASS | js: .nvmrc |
| `DX-GITIGNORE` .gitignore covers build artefacts | PASS | .gitignore covers detected stacks |
| `DX-GITATTRIBUTES` Line endings normalised (.gitattributes) | FAIL | no .gitattributes line-ending rules |

Remediation:

- **DX-TASKRUNNER** (effort S): Add a root Makefile with setup, lint, format, typecheck, test, build and check targets that CI also calls. Template: [Makefile](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/Makefile), [backend/Makefile](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/backend/Makefile), [frontend/Makefile](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/frontend/Makefile)
- **DX-GITATTRIBUTES** (effort S): Add `* text=auto` and `*.sh text eol=lf` to .gitattributes. Template: [.gitattributes](https://github.com/edwinjosechittilappilly/shipshape-stack/blob/main/.gitattributes)

### Frontend health (excluded: not applicable, weight 4)

| Check | Status | Evidence |
| --- | :---: | --- |
| `FE-REACT-DOCTOR` React Doctor in scripts and CI | N/A | no React app detected |
| `FE-A11Y-LINT` Accessibility linting and tests | N/A | no JS UI framework detected |
| `FE-PLAYWRIGHT` Browser e2e tests (Playwright) | N/A | no JS UI framework detected |
| `FE-TS-STRICT` TypeScript strict mode | N/A | no JS UI framework detected |
| `FE-COMPONENT-TESTS` Component tests with Testing Library | N/A | no JS UI framework detected |

## Needs judgement (not scored)

- README: follow it literally on a clean checkout; does a newcomer reach a running app and a green test run?
- Tests: open 3-5 tests; do they assert behaviour (outputs, state, HTTP responses) rather than only that code runs?
- CI: is the default branch actually green? (`gh run list --branch <default> --limit 10`, `gh run view <id> --log-failed`)
- Branch protection: is the aggregate CI check required and are force-pushes blocked? (`gh api repos/{owner}/{repo}/branches/<default>/protection`)
- Docs currency: do documented commands, paths and versions still exist? Is anything contradicted by the code?
- Security settings: are secret scanning, push protection, Dependabot alerts and CodeQL default setup enabled in repository settings?
- Agent instructions: do they match reality (commands work, boundaries sensible) and stay concise?

_Generated by repo-audit (schema v1); static analysis only, see references/rubric.md._
