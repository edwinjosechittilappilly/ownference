![OwnMode Connect](docs/assets/hero.svg)

# OwnMode Connect

**Switch to your own AI.**

Local intelligence for your apps and browser.

Connect **Ollama, LM Studio and Apple Foundation Models** to cooperating websites and browser tools. You choose the model. You approve the connection.

[![CI](https://github.com/edwinjosechittilappilly/ownmode/actions/workflows/ci.yml/badge.svg)](https://github.com/edwinjosechittilappilly/ownmode/actions/workflows/ci.yml)
[Apache-2.0](LICENSE) · [Download](https://github.com/edwinjosechittilappilly/ownmode/releases/latest) · [Developer guide](docs/architecture.md) · [Report an issue](https://github.com/edwinjosechittilappilly/ownmode/issues/new/choose)

> Just want a writing app on your Mac? Get [OwnMode Mac](https://github.com/edwinjosechittilappilly/ownmode-mac). The bridge is for connecting other apps to local models.

## Get a model talking to an app

### Upgrading from Ownference

Before installing OwnMode, use the old CLI to remove its startup service and native host: `ownference startup uninstall` and `ownference native uninstall` (pass any original `--config-dir` or `--manifest-dir` overrides). Stop any remaining old bridge or menu app, then uninstall the old package with `npm uninstall -g @ownference/bridge`. Otherwise the old service can keep the port occupied. OwnMode uses separate configuration and does not import grants or credentials: create new origin grants, reinstall the native host for the actual browser extension ID shown in Setup, and explicitly approve sites again. Remove old configuration only after you no longer need it.

### Install

Requires **Node 24+** and a running [Ollama](https://ollama.com/) installation:

```sh
npm install -g https://github.com/edwinjosechittilappilly/ownmode/releases/download/v0.3.0/ownmode-connect-0.3.0.tgz
ollama pull llama3.2:latest
ownmode serve
```

Leave the bridge running. In another terminal:

```sh
ownmode grant --origin http://localhost:4173
```

Launch [OwnMode Web](https://github.com/edwinjosechittilappilly/ownmode-web#try-it), open **http://localhost:4173**, paste the grant token and choose a model. Summarize your first paragraph.

![The companion OwnMode Web workspace using the local bridge](docs/assets/screenshot.png)

*The companion Web workspace: choose a local model, stream a result, then copy or download it.*

<details>
<summary>Try without a global install</summary>

```sh
npx --yes --package https://github.com/edwinjosechittilappilly/ownmode/releases/download/v0.3.0/ownmode-connect-0.3.0.tgz ownmode doctor
```

Replace `doctor` with `serve` to run the bridge. Node24+ is still required. Prefer a user-writable Node/npm installation; do not use `sudo` to work around npm permissions.

</details>


## What you can build

- **Bring-your-own-AI web apps:** each visitor uses their own installed models.
- **Writing tools beside the text:** summarize, rewrite, extract, compare and draft.
- **Browser assistance:** selected page text, deliberate review, local generation.
- **A provider switch:** the same task interface across ready local providers.

This does not intercept a website's backend AI calls or authorize autonomous purchases, email sending or shell tools.

## Keep it in your Mac menu bar

[**Download the menu-bar app (.dmg)**](https://github.com/edwinjosechittilappilly/ownmode/releases/download/v0.3.0/OwnMode-Connect-MenuBar.dmg) — the app is **ad-hoc signed, not notarized**; macOS may block it.

Open the disk image and drag the app to Applications. The helper shows bridge status and provides start/stop and login-service recovery controls. **It still requires Node24+**; it bundles the bridge and compiled Apple adapter, not Node or third-party models.

The helper is universal for Apple silicon/Intel on macOS 13+. Use your approved software policy or build from source—do not disable Gatekeeper. See [desktop setup](docs/native-startup.md).

Login startup is opt-in:

```sh
ownmode startup install
ownmode startup status
# Remove it later:
ownmode startup uninstall
```

The helper stops only its own processes. Startup manages a user LaunchAgent, not a system daemon. Runtime copies are durable; changing your Node installation may require reconfiguration.

## Connect a website

| Choose | Setup | What the page receives |
|---|---|---|
| Direct SDK | Exact-origin grant token | An origin-scoped bearer token |
| Browser relay | OwnMode Browser + native host + explicit tab approval | Results, never the bridge token |

For relay, install [OwnMode Browser](https://github.com/edwinjosechittilappilly/ownmode-browser), then use the **actual extension ID shown in its Setup screen**:

```sh
ownmode native install --extension-id YOUR_CHROME_EXTENSION_ID
ownmode native status
```

Approve the cooperating tab in the extension. Its frontend uses [`createRelayClient()`](https://github.com/edwinjosechittilappilly/ownmode-web#add-local-ai-to-your-app). The route is page → extension → native host → bridge → local model, not a page fetch to localhost.

Remove the host with `ownmode native uninstall`. Revoke direct grants with `ownmode revoke --origin http://localhost:4173`. Origins are exact: scheme, host and port; `localhost` is not `127.0.0.1`.

## Pick a provider

| Provider | Requirements |
|---|---|
| Ollama | Local server at `127.0.0.1:11434`; downloaded generation model |
| LM Studio | Local server at `127.0.0.1:1234/v1`; loaded model |
| Apple Foundation Models | macOS 26+, Apple silicon eligible for Apple Intelligence, Apple Intelligence enabled, ready model and Swift adapter |

`ownmode doctor` reports actual availability. The npm CLI's Apple adapter requires `npm run build:apple` from source with a compatible Xcode toolchain. The menu-bar release bundles that adapter. Apple models do not run on every Mac.

The bridge binds to `127.0.0.1:3210`. Other **loopback-only** provider endpoints use `--ollama-url` / `--lmstudio-url`; `serve --port 3211` changes the bridge port.

## Small interface, useful guarantees

`GET /health` reports reachability. Authenticated `GET /v1/models` lists provider-prefixed models; `POST /v1/generate` accepts `{model, task, text, instruction?}` and streams NDJSON. Tasks: `summarize`, `rewrite`, `extract`, `compare`, `draft`.

Use the [Web SDK](https://github.com/edwinjosechittilappilly/ownmode-web) for stream parsing and cancellation. Requests have input/output, concurrency and deadline limits; disconnect cancels upstream work.

<details>
<summary>Privacy and permissions</summary>

No bridge prompt logging, telemetry or cloud fallback. Exact Host/Origin checks, hashed grants, loopback-only providers and private configuration permissions protect the interface. Tokens are bearer credentials; a holder can use them outside a browser. Same-origin scripts share a site's relay permission.

A connected website receives generated output and may transmit it elsewhere. Local compute is not free/unlimited compute or automatic data confinement. Model output remains untrusted; model licenses and Apple's acceptable-use requirements apply.

</details>

## Build with us

```sh
npm ci
npm run check
npm run smoke:ollama
npm run build:apple
npm run build:menubar
```

[Testing](docs/testing.md) · [Observed verification](docs/verification.md) · [Brand assets](docs/assets/README.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

Share a concrete integration, request a provider, or improve onboarding through an issue. Real workflows help more than a star; a star helps other builders find the project.

**Switch to your own AI.** [Connect](https://github.com/edwinjosechittilappilly/ownmode) · [Web](https://github.com/edwinjosechittilappilly/ownmode-web) · [Browser](https://github.com/edwinjosechittilappilly/ownmode-browser) · [Mac](https://github.com/edwinjosechittilappilly/ownmode-mac)

Apache-2.0. GitHub release tarballs are installed using npm; npm registry publication is not claimed. Release artifacts include SHA256SUMS. No trademark clearance is claimed.
