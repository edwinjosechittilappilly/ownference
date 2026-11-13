# Desktop integration

## Menu bar app

Install Node24 in a stable location, download Ownference-Bridge-MenuBar.zip, and extract the app to `~/Applications`. The bundle includes its runtime sources and icon. Configure the app with an absolute Node path; an optional absolute CLI path can select an installed runtime instead of the bundled one. Use `--help` or the app's configuration guidance for the current form. Do not point to an ephemeral npx cache.

The visible controller reports reachability/provider state, opens the workspace and controls its owned runtime. It does not authorize sites or reveal tokens. A loaded startup service is shown distinctly so the menu app does not race it. Quitting the controller is not the same as revoking a site's grant.

## Opt-in startup

`ownference startup install` stages a durable runtime copy and a user LaunchAgent, then starts it explicitly. `startup status` reports installation/runtime validity and loaded state. `startup uninstall` removes only the owned agent/runtime. Failed installation rolls back instead of leaving an unexpected login agent. Test fixtures use isolated directories and launchctl seams.

Use `--node /absolute/stable/node` on startup/native install to choose a managed executable. Homebrew Cellar paths are normalized to an executable opt path where available; status reports a missing saved executable. Do not assume a Node version-specific Cellar directory survives upgrades.

## Native messaging

`ownference native install --extension-id ID` registers com.ownference.bridge for exactly that Chrome extension. It copies host code durably, uses an absolute Node path and stores its private token separately from standalone popup credentials. Revoking the exact extension origin invalidates both; native status explains revoked/missing configuration and the host gives reinstall guidance.

For non-default browser profiles use `--manifest-dir /absolute/profile/NativeMessagingHosts`; native status/uninstall accept that same override. `--port N` on installation selects a non-default loopback bridge port. Do not expose these settings to website messages. A Chrome profile must actually discover the registered host; the native ID alone is not an installation.

## Signing and platform

The menu helper uses AppKit and ships with an explicit supported deployment target and architecture, verified by its build/test scripts. Ad-hoc signing is not Developer ID signing or notarization. The separate Ownference Mac app is Apple-model-only, Node-free and requires macOS26 with Apple Intelligence availability. Never tell users to disable Gatekeeper.
