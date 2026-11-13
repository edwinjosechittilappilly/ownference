<p align="center"><img src="docs/assets/hero.svg" alt="Ownference — Your models. Your machine." width="900"></p>

# Ownference — Your models. Your machine.

**Your models. Your machine.** A small local bridge that gives a website you authorize access to models already running on your computer. No hosted inference, accounts, telemetry, automatic tool execution, or cloud fallback. Ownference is a working brand, not trademark cleared.

## Start in minutes

Requires Node.js 24 and a local model provider. For Ollama, start Ollama and pull a model first (`ollama pull llama3.2:latest`). In separate terminals:

```sh
gh repo clone edwinjosechittilappilly/ownference
cd ownference
npm ci
```

```sh
node src/cli.js serve
node src/cli.js grant --origin http://localhost:4173
node src/cli.js doctor
```

Copy the token printed by `grant` into an authorized client such as [Ownference Web](https://github.com/edwinjosechittilappilly/ownference-web). The token is shown once; a second grant for the same origin replaces the previous token. Revoke it with `node src/cli.js revoke --origin http://localhost:4173`. Grant the **exact** origin the browser uses: `localhost` and `127.0.0.1` are different. For [Ownference Tabs](https://github.com/edwinjosechittilappilly/ownference-tabs), grant the `chrome-extension://…` origin displayed in the extension.

The server binds only `127.0.0.1:3210`. Choose another port with `serve --port 3211`. Ollama defaults to `http://127.0.0.1:11434`; LM Studio defaults to `http://127.0.0.1:1234/v1`. Configure local endpoints with `--ollama-url` and `--lmstudio-url` on `serve` or `doctor`. Only loopback HTTP URLs are accepted; redirects are rejected. One unavailable provider does not disable the others. LM Studio must have its local server running and a model loaded.

### Apple Foundation Models

On macOS 26 or newer with a compatible Apple device, Apple Intelligence enabled and its model available, install the current Xcode command-line tools and run `npm run build:apple`. `doctor` then reports Apple availability; when available the model ID is `apple:system`. This builds a local Swift executable using Apple's FoundationModels framework. The process is terminated when a request is cancelled. Apple's device/model/region/language availability requirements still apply. Unsupported systems do not prevent other providers working.

## Security and configuration

Grants are scoped by origin, with random bearer tokens stored only as SHA-256 digests under `~/.config/ownference` (or `$XDG_CONFIG_HOME/ownference`). The directory is mode 0700 and grants file mode 0600. Set `OWNFERENCE_CONFIG_DIR` or pass `--config-dir PATH` to **every** CLI command to use another location. Protect the token: authenticated non-browser clients can use it without an Origin header. Browser Origin and Host are checked, CORS is never wildcarded, prompts are not logged or persisted, and model output is treated as text, never executed. A malicious authorized website can still send any text and use its grant: only authorize sites you trust. Local model prompt injection remains possible; the instruction to treat input as untrusted is not a security boundary.

Browsers may block requests from public HTTPS sites to loopback due to local-network/private-network access policies. Use an appropriate browser-supported deployment and grant; do not disable browser security. See [SECURITY.md](SECURITY.md).

## HTTP API

`GET /health` returns `{ "ok": true, "version": "0.1.0" }`. Authenticated `GET /v1/models` returns `models` with provider-prefixed IDs and provider availability. `POST /v1/generate` accepts JSON `{ "model": "ollama:llama3.2:latest", "task": "summarize", "text": "...", "instruction": "..." }`; task is `summarize`, `rewrite`, `extract`, `compare`, or `draft`. Text is 1–24,000 characters, optional instruction at most 2,000. Send `Authorization: Bearer TOKEN`. Output is UTF-8 NDJSON with `delta` events carrying `text`, followed by `done` or a sanitized `error` event. HTTP errors have `{error:{code,message}}`. The runtime limits concurrent requests, provider time, output and request body; disconnecting cancels upstream work. Never execute generated output.

For deterministic tests: `npm run check` or `make check`. For real acceptance, start Ollama with `llama3.2:latest` installed and run `npm run smoke:ollama` (override with `OLLAMA_MODEL`). The smoke uses an isolated temporary grant directory and ephemeral server, then removes both. Apache-2.0 licensed; see [LICENSE](LICENSE).

## Why build on Ownference?

- **One task interface, three local providers:** Apple on-device, Ollama and LM Studio.
- **Permissioned by design:** grant one exact origin, rotate or revoke it locally.
- **Streaming without a cloud dependency:** bounded output, deadlines and cancellation.
- **Small operational footprint:** no database, hosted account or runtime npm dependency.
- **Developer-ready:** [architecture](docs/architecture.md), [testing](docs/testing.md), [contributing](CONTRIBUTING.md) and [security](SECURITY.md).

Apple's smaller context window can reject otherwise valid inputs; the client receives `input_too_large` and should ask the user to shorten the source. Guardrail refusal is distinct from network failure. Local-only does not mean unrestricted use; Apple's acceptable-use requirements still apply.

## Verification and release status

`npm run check` includes lint, secret scanning and coverage-gated behavior tests. `npm run build:apple && bin/ownference-apple self-test` compiles the adapter and checks incremental Unicode snapshots. [Verification evidence](docs/verification.md) distinguishes actual Ollama/Apple runs from LM Studio protocol tests. The source and package are not a signed/notarized Mac app or a public registry release.
