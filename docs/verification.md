# Observed verification — 0.2.0

Environment: arm64 Mac, macOS26.2 SDK, Swift6.2.3, Node24.10.0 and real local Ollama.

- `npm run check`: 31 behavior tests passed, including lint/secret checks. Core loaded-module coverage measured 97.26% lines, 78.74% branches and 90.70% functions; this is not full UI/Swift coverage.
- Native framing, resource bounds, cancellation, independent extension credentials, precise uninstall, revoked-token status and missing Node detection passed.
- A genuinely installed host launcher exchanged framed HTTP requests from a symlinked temporary installation. Installer tests cover configurable manifest paths/ports and stable Homebrew Node paths.
- Startup tests use isolated locations and launchctl seams; staging/rollback, failed reinstall, recursive source rejection, managed port conflict and opt-in removal passed. No acceptance silently enabled the user's login service.
- The universal menu helper built for arm64/x86_64 at macOS13.0; Info.plist, both Mach-O deployment targets and the ad-hoc bundle signature were verified.
- Its self-test covered durable runtime copying and Swift-side stable Node mapping. Its genuine UI smoke created a real NSStatusItem/window-backed button with the shared icon, tooltip and actions, then captured that button.
- The helper provides an explicit Restart Login Service action for a loaded-but-unreachable service rather than racing it with another child.
- Existing live bridge/SDK/browser tests generated with `ollama:llama3.2:latest`. The actual HTTPS workspace generated through the extension/native host while its direct loopback fetches were blocked.
- The Apple adapter compiled/self-tested and actual Apple on-device inference was observed on this Mac. LM Studio was unavailable; only its deterministic local protocol fixture was exercised.

Two independent reviews and focused re-reviews resolved native path/identity, installation transaction, desktop lifetime and lifecycle findings. No remaining code blockers were reported after the fixes.

Release artifacts are source tarballs plus the built menu app, with checksum automation. The actual download/install verification is separate from source-checkout checks. A menu app signature is ad-hoc—not Developer ID signing/notarization. Native Mac preset-app evidence is in its own repository.

Private GitHub repositories require access; no public npm publication, store approval, universal Apple availability or trademark clearance is claimed. See README for release commands and Actions for remote CI/release status.
