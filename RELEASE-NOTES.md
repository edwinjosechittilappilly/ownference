# OwnMode Connect 0.3.0

Switch to your own AI. Local intelligence for your apps and browser.

The coordinated OwnMode release includes the local runtime, CLI and Mac menu helper.

## What's new

- OwnMode Connect naming, a new CLI and fresh origin authorization for the OwnMode family.
- Shared split-O identity, product-specific README headers and real application screenshots.
- A drag-to-Applications DMG alongside the universal menu-helper ZIP and Node CLI tarball.
- Release/package/app version checks, checksums and runtime health reporting tied to package metadata.

[Installation and provider setup](https://github.com/edwinjosechittilappilly/ownmode/tree/v0.3.0#readme) · [Browser relay setup](https://github.com/edwinjosechittilappilly/ownmode-browser/tree/v0.3.0#let-a-web-app-use-your-models)


## Choose an asset

- `ownmode-connect-0.3.0.tgz`: Node.js 24+ CLI on supported platforms.
- `OwnMode-Connect-MenuBar.dmg`: universal Apple silicon / Intel menu helper for macOS 13+. Open it and drag the app to Applications. `OwnMode-Connect-MenuBar.zip` is the equivalent app archive. The helper needs Node.js and a local model provider; the optional Apple provider has its own hardware and OS requirements.
- `SHA256SUMS`: verify downloaded assets with `shasum -a 256 -c SHA256SUMS` after downloading all listed assets into the same directory.

The app is ad-hoc signed, not notarized; macOS Gatekeeper may prevent it from opening. There is no cloud fallback.

Upgrading from Ownference requires removing its startup service and native host with the old CLI before uninstalling it, then issuing new grants and approving sites again. See the README upgrade instructions; configuration and credentials are not imported.

## Quick start

With Node.js 24+ and a local provider such as Ollama installed:

```sh
npx --yes --package https://github.com/edwinjosechittilappilly/ownmode/releases/download/v0.3.0/ownmode-connect-0.3.0.tgz ownmode doctor
npx --yes --package https://github.com/edwinjosechittilappilly/ownmode/releases/download/v0.3.0/ownmode-connect-0.3.0.tgz ownmode serve
```

For a durable CLI, use `npm install -g https://github.com/edwinjosechittilappilly/ownmode/releases/download/v0.3.0/ownmode-connect-0.3.0.tgz`. These are GitHub release assets, not an npm registry publication. See the repository for provider setup, origin grants and native messaging instructions.
