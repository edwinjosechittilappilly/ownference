# Architecture and threat model

Ownference is a deep local-runtime module: clients learn a small task-and-stream interface while configuration, grants, providers, resource bounds and cancellation stay inside it.

## Request flow

CLI grant → private digest storage → exact Host/Origin validation → bearer authorization → request validation → model availability → bounded provider generation → NDJSON deltas and one terminal event.

`src/config.js` owns grants and revocation. `src/server.js` owns the loopback HTTP interface and concurrency. `src/providers.js` owns real Ollama, LM Studio and Apple adapters. `apple/OwnferenceApple.swift` uses SystemLanguageModel on-device, never Private Cloud Compute. Apple snapshots are converted by Unicode scalars, not grapheme counts.

## Trust and limits

The listener binds 127.0.0.1, validates Host, rejects unknown/null origins and never uses wildcard CORS. Origin is browser metadata, not authentication for arbitrary programs; a bearer token is still a secret. Grant files are mode0600 in a mode0700 directory; prompts are not persisted. Re-grant rotates a token; revoke takes effect on the next request. A no-match revoke fails visibly.

Providers accept only loopback HTTP URLs and reject redirects. Text is data, not tool authority. Request/body/output bounds, deadlines and concurrency limit model resource use; stream backpressure and disconnection propagate cancellation. Model context limits vary: an Apple context overflow returns input_too_large with shortening guidance, not a fake timeout. No implicit truncation or cloud fallback is performed by the runtime.

Authorized sites can abuse their own inference permission or leak returned text. Other local software with sufficient privileges can steal bearer tokens or alter local provider behavior. This is not a sandbox for a compromised Mac.

## Deployment

Run on the user's host; do not deploy this bridge to a shared cloud server. Build the Apple executable locally with the installed SDK. Distribution signing/notarization and app-store compliance are separate release-owner controls. See testing.md and SECURITY.md.
