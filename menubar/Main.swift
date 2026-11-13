import AppKit
import Foundation
import Darwin

private let support = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/Ownference", isDirectory: true)
private let configURL = support.appendingPathComponent("menu-bar.plist")

// Match the Node installer's stable Homebrew path policy, including GUI-resolved symlinks.
private func persistentNodePath(_ path: String) -> String {
    let parts = path.components(separatedBy: "/Cellar/")
    guard parts.count == 2 else { return path }
    let tail = parts[1].split(separator: "/")
    guard tail.count == 4, tail[2] == "bin", tail[3] == "node" else { return path }
    let stable = "\(parts[0])/opt/\(tail[0])/bin/node"
    return FileManager.default.isExecutableFile(atPath: stable) ? stable : path
}

private struct RuntimeConfig: Codable {
    let node: String
    let runtime: String
    var configDir: String?

    var valid: Bool {
        node.hasPrefix("/") && runtime.hasPrefix("/") &&
        (configDir == nil || configDir!.hasPrefix("/")) &&
        FileManager.default.isExecutableFile(atPath: node) &&
        FileManager.default.isReadableFile(atPath: runtime)
    }

    func arguments(_ command: String) -> [String] {
        [runtime, command] + (configDir.map { ["--config-dir", $0] } ?? [])
    }

    var persistent: RuntimeConfig {
        RuntimeConfig(node: persistentNodePath(node), runtime: runtime, configDir: configDir)
    }
}

private func loadConfig() -> RuntimeConfig? {
    guard let data = try? Data(contentsOf: configURL),
          let saved = try? PropertyListDecoder().decode(RuntimeConfig.self, from: data) else { return nil }
    let config = saved.persistent
    return config.valid ? config : nil
}

private func saveConfig(_ config: RuntimeConfig) throws {
    guard config.valid else { throw NSError(domain: "Ownference", code: 1, userInfo: [NSLocalizedDescriptionKey: "Node and runtime must be existing absolute paths; Node must be executable."]) }
    try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    let temporary = support.appendingPathComponent(".menu-bar-\(UUID().uuidString).plist")
    defer { try? FileManager.default.removeItem(at: temporary) }
    try PropertyListEncoder().encode(config).write(to: temporary)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: temporary.path)
    guard rename(temporary.path, configURL.path) == 0 else {
        throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno))
    }
}

// Each configuration owns a durable copy, independent of npm's temporary cache.
private func copyRuntime(_ cli: URL, into destination: URL) throws -> URL {
    let fm = FileManager.default
    guard cli.lastPathComponent == "cli.js", cli.deletingLastPathComponent().lastPathComponent == "src" else {
        throw NSError(domain: "Ownference", code: 2, userInfo: [NSLocalizedDescriptionKey: "Runtime must point to a package's src/cli.js."])
    }
    let root = cli.deletingLastPathComponent().deletingLastPathComponent()
    try fm.createDirectory(at: destination, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    do {
        try fm.copyItem(at: root.appendingPathComponent("src"), to: destination.appendingPathComponent("src"))
        try fm.copyItem(at: root.appendingPathComponent("package.json"), to: destination.appendingPathComponent("package.json"))
        let bin = root.appendingPathComponent("bin")
        if fm.fileExists(atPath: bin.path) {
            try fm.copyItem(at: bin, to: destination.appendingPathComponent("bin"))
        }
    } catch {
        try? fm.removeItem(at: destination)
        throw error
    }
    return destination.appendingPathComponent("src/cli.js")
}

private func installConfig(_ supplied: RuntimeConfig) throws {
    let config = supplied.persistent
    guard config.valid else {
        throw NSError(domain: "Ownference", code: 1, userInfo: [NSLocalizedDescriptionKey: "Node and runtime must be existing absolute paths; Node must be executable."])
    }
    let previous = loadConfig()
    let destination = support.appendingPathComponent("menu-runtime", isDirectory: true).appendingPathComponent(UUID().uuidString, isDirectory: true)
    let installed = try copyRuntime(URL(fileURLWithPath: config.runtime), into: destination)
    do {
        try saveConfig(RuntimeConfig(node: config.node, runtime: installed.path, configDir: config.configDir))
    } catch {
        try? FileManager.default.removeItem(at: destination)
        throw error
    }
    if let previous = previous {
        let oldRoot = URL(fileURLWithPath: previous.runtime).deletingLastPathComponent().deletingLastPathComponent().standardizedFileURL
        let runtimeRoot = support.appendingPathComponent("menu-runtime", isDirectory: true).standardizedFileURL
        if oldRoot.deletingLastPathComponent() == runtimeRoot,
           UUID(uuidString: oldRoot.lastPathComponent) != nil,
           oldRoot != destination.standardizedFileURL {
            try? FileManager.default.removeItem(at: oldRoot)
        }
    }
}

private func bundledRuntime() -> String {
    Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/runtime/src/cli.js").path
}

// A loaded KeepAlive agent owns the bridge even while its HTTP endpoint is down.
private func launchAgentStatus() -> Bool? {
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
    task.arguments = ["print", "gui/\(getuid())/com.ownference.bridge"]
    task.standardOutput = FileHandle.nullDevice
    task.standardError = FileHandle.nullDevice
    do {
        try task.run()
        task.waitUntilExit()
        switch task.terminationStatus {
        case 0: return true
        case 3, 113: return false
        default: return nil
        }
    } catch { return nil }
}

private func health(_ completion: @escaping (Bool) -> Void) {
    var request = URLRequest(url: URL(string: "http://127.0.0.1:3210/health")!)
    request.timeoutInterval = 2
    URLSession.shared.dataTask(with: request) { data, response, _ in
        let ok = (response as? HTTPURLResponse)?.statusCode == 200 &&
            (data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any])?["ok"] as? Bool == true
        completion(ok)
    }.resume()
}

// Only fixed provider identifiers and availability are displayed, never raw process output.
private func providerLines(_ output: String) -> [String] {
    let lines = output.components(separatedBy: .newlines)
    return ["ollama", "lmstudio", "apple"].map { id in
        let line = lines.first { $0.hasPrefix(id + ": ") }
        return "\(id): \(line == id + ": available" ? "available" : "unavailable")"
    }
}

private func discover(_ config: RuntimeConfig, completion: @escaping ([String]) -> Void) {
    DispatchQueue.global(qos: .utility).async {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: config.node)
        process.arguments = config.arguments("doctor")
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            completion(process.terminationStatus == 0 ? providerLines(String(decoding: data, as: UTF8.self)) : [])
        } catch { completion([]) }
    }
}

private final class AppDelegate: NSObject, NSApplicationDelegate {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let menu = NSMenu()
    private var process: Process?
    private var reachable = false
    private var agentLoaded: Bool?
    private var providers: [String] = []
    private var refreshing = false
    private var timer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let button = item.button {
            if let url = Bundle.main.url(forResource: "menu-icon", withExtension: "png"), let image = NSImage(contentsOf: url) {
                image.size = NSSize(width: 18, height: 18)
                button.image = image
            } else { button.title = "Ownference" }
            button.toolTip = "Ownference Bridge"
        }
        item.menu = menu
        menu.autoenablesItems = false
        rebuild()
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in self?.refresh() }
        if CommandLine.arguments.count == 3 && CommandLine.arguments[1] == "--ui-smoke" {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                guard let button = self.item.button, button.window != nil, button.image != nil,
                      button.toolTip == "Ownference Bridge", self.item.menu === self.menu,
                      self.menu.item(withTitle: "Configure Runtime…") != nil,
                      let bitmap = button.bitmapImageRepForCachingDisplay(in: button.bounds) else {
                    fputs("Menu bar UI smoke failed: missing visible status item or actions\n", stderr); exit(3)
                }
                button.cacheDisplay(in: button.bounds, to: bitmap)
                guard let data = bitmap.representation(using: .png, properties: [:]) else { exit(3) }
                do { try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic) }
                catch { fputs("Menu bar UI capture failed: \(error.localizedDescription)\n", stderr); exit(3) }
                print("Menu bar UI smoke passed: real status item, icon and menu actions."); exit(0)
            }
        }
    }

    private func add(_ title: String, action: Selector? = nil, enabled: Bool = true) {
        let entry = NSMenuItem(title: title, action: action, keyEquivalent: "")
        entry.target = self
        entry.isEnabled = enabled
        menu.addItem(entry)
    }

    private func rebuild() {
        menu.removeAllItems()
        add(reachable ? "Bridge: reachable" : "Bridge: not reachable", enabled: false)
        add(agentLoaded == true ? "Login service: loaded" : agentLoaded == false ? "Login service: not loaded" : "Login service: status unavailable", action: #selector(serviceInfo))
        if loadConfig() == nil { add("Runtime not configured", enabled: false) }
        if !providers.isEmpty {
            add("Local provider discovery (defaults):", enabled: false)
            for line in providers { add(line, enabled: false) }
        }
        menu.addItem(.separator())
        add("Start Bridge", action: #selector(start), enabled: !reachable && process == nil && agentLoaded == false)
        add("Stop Bridge (started by this app)", action: #selector(stop), enabled: process?.isRunning == true)
        add("Restart Login Service", action: #selector(restartLoginService), enabled: agentLoaded == true && !reachable)
        add("Configure Runtime…", action: #selector(configure))
        add("Refresh Status", action: #selector(refreshAction))
        add("Open Website", action: #selector(openWebsite))
        menu.addItem(.separator())
        add("Quit", action: #selector(quit))
    }

    @objc private func refreshAction() { refresh() }
    private func refresh() {
        guard !refreshing else { return }
        refreshing = true
        DispatchQueue.global(qos: .utility).async {
            let agent = launchAgentStatus()
            health { [weak self] ok in
                guard let self = self else { return }
                let finish: ([String]) -> Void = { lines in
                    DispatchQueue.main.async {
                        self.reachable = ok
                        self.agentLoaded = agent
                        self.providers = lines
                        self.refreshing = false
                        self.rebuild()
                    }
                }
                if ok, let config = loadConfig() { discover(config, completion: finish) } else { finish([]) }
            }
        }
    }

    @objc private func serviceInfo() {
        let alert = NSAlert()
        alert.messageText = "Login service"
        alert.informativeText = agentLoaded == true
            ? "The login service manages the bridge. If it is loaded but unreachable, choose Restart Login Service. To remove it, run `ownference startup uninstall` in Terminal."
            : agentLoaded == false
                ? "The login service is not loaded. Run `ownference startup install` in Terminal to start the bridge at login."
                : "Could not check launchd. Open Terminal and run `launchctl print gui/$(id -u)/com.ownference.bridge` for details."
        alert.runModal()
    }

    @objc private func configure() {
        let panel = NSOpenPanel()
        panel.message = "Choose the Node.js executable. The bundled bridge runtime will be installed."
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        panel.resolvesAliases = false
        guard panel.runModal() == .OK, let node = panel.url else { return }
        do {
            try installConfig(RuntimeConfig(node: node.path, runtime: bundledRuntime()))
            refresh()
            rebuild()
        } catch {
            let alert = NSAlert(error: error)
            alert.messageText = "Could not configure the bridge"
            alert.runModal()
        }
    }

    @objc private func restartLoginService() {
        guard launchAgentStatus() == true else { refresh(); return }
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        task.arguments = ["kickstart", "-k", "gui/\(getuid())/com.ownference.bridge"]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        task.terminationHandler = { [weak self] finished in
            DispatchQueue.main.async {
                if finished.terminationStatus != 0 {
                    let alert = NSAlert()
                    alert.messageText = "Could not restart the login service"
                    alert.informativeText = "Run `ownference startup status` in Terminal to check the installed service."
                    alert.runModal()
                }
                self?.refresh()
            }
        }
        do { try task.run() }
        catch { NSAlert(error: error).runModal() }
    }

    @objc private func start() {
        guard process == nil else { return }
        agentLoaded = launchAgentStatus()
        guard agentLoaded == false else {
            rebuild()
            serviceInfo()
            return
        }
        guard let config = loadConfig() else {
            let alert = NSAlert()
            alert.messageText = "Configure the bridge first"
            alert.informativeText = "Choose Configure Runtime… and select your Node.js executable."
            alert.runModal()
            return
        }
        let child = Process()
        child.executableURL = URL(fileURLWithPath: config.node)
        child.arguments = config.arguments("serve")
        child.standardOutput = FileHandle.nullDevice
        child.standardError = FileHandle.nullDevice
        child.terminationHandler = { [weak self] finished in
            DispatchQueue.main.async {
                guard let self = self, self.process === finished else { return }
                self.process = nil
                self.rebuild()
                self.refresh()
            }
        }
        do {
            try child.run()
            process = child
            rebuild()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.refresh() }
        } catch {
            let alert = NSAlert(error: error)
            alert.messageText = "Could not start the bridge"
            alert.runModal()
        }
    }

    @objc private func stop() {
        guard let child = process, child.isRunning else { return }
        child.terminate()
    }
    @objc private func openWebsite() { NSWorkspace.shared.open(URL(string: "https://github.com/edwinjosechittilappilly/ownference")!) }
    @objc private func quit() { NSApplication.shared.terminate(nil) }
    func applicationWillTerminate(_ notification: Notification) {
        if let child = process, child.isRunning { child.terminate() }
    }
}

private func commandLine() -> Bool {
    let args = CommandLine.arguments
    if (3...5).contains(args.count) && args[1] == "--configure" {
        do { try installConfig(RuntimeConfig(node: args[2], runtime: args.count >= 4 ? args[3] : bundledRuntime(), configDir: args.count == 5 ? args[4] : nil)); print("Menu bar runtime installed and configured.") }
        catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
        return true
    }
    if args.count == 2 && args[1] == "--self-test" {
        guard !RuntimeConfig(node: "node", runtime: "/tmp/cli.js").valid,
              providerLines("ollama: available\nlmstudio: connection failed\napple: available\n  secret model name") == ["ollama: available", "lmstudio: unavailable", "apple: available"],
              providerLines("") == ["ollama: unavailable", "lmstudio: unavailable", "apple: unavailable"],
              RuntimeConfig(node: "/node", runtime: "/runtime", configDir: "/config").arguments("serve") == ["/runtime", "serve", "--config-dir", "/config"] else {
            fputs("Menu bar self-test failed\n", stderr)
            exit(1)
        }
        do {
            let fm = FileManager.default
            let temp = fm.temporaryDirectory.appendingPathComponent("ownference-menu-test-\(UUID().uuidString)")
            defer { try? fm.removeItem(at: temp) }
            let cellarNode = temp.appendingPathComponent("brew/Cellar/node/24.10.0/bin/node")
            let optNode = temp.appendingPathComponent("brew/opt/node/bin/node")
            try fm.createDirectory(at: optNode.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data("#!/bin/sh\nexit 0\n".utf8).write(to: optNode)
            try fm.setAttributes([.posixPermissions: 0o755], ofItemAtPath: optNode.path)
            guard persistentNodePath(cellarNode.path) == optNode.path,
                  RuntimeConfig(node: cellarNode.path, runtime: "/runtime").persistent.node == optNode.path,
                  persistentNodePath("/unmanaged/bin/node") == "/unmanaged/bin/node" else {
                throw NSError(domain: "Ownference", code: 4)
            }
            let source = temp.appendingPathComponent("source")
            try fm.createDirectory(at: source.appendingPathComponent("src"), withIntermediateDirectories: true)
            try fm.createDirectory(at: source.appendingPathComponent("bin"), withIntermediateDirectories: true)
            try Data("cli".utf8).write(to: source.appendingPathComponent("src/cli.js"))
            try Data("package".utf8).write(to: source.appendingPathComponent("package.json"))
            try Data("provider".utf8).write(to: source.appendingPathComponent("bin/ownference-apple"))
            let copy = try copyRuntime(source.appendingPathComponent("src/cli.js"), into: temp.appendingPathComponent("installed"))
            try fm.removeItem(at: source)
            guard try Data(contentsOf: copy) == Data("cli".utf8),
                  try Data(contentsOf: copy.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("package.json")) == Data("package".utf8),
                  try Data(contentsOf: copy.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("bin/ownference-apple")) == Data("provider".utf8) else {
                throw NSError(domain: "Ownference", code: 3)
            }
        } catch {
            fputs("Runtime installation self-test failed: \(error.localizedDescription)\n", stderr)
            exit(1)
        }
        print("Menu bar self-test passed.")
        return true
    }
    if args.count == 2 && (args[1] == "--status" || args[1] == "--smoke") {
        let semaphore = DispatchSemaphore(value: 0)
        var reachable = false
        health { ok in
            reachable = ok
            print("Bridge: \(ok ? "reachable" : "not reachable")")
            semaphore.signal()
        }
        if semaphore.wait(timeout: .now() + 4) == .timedOut { fputs("Health check timed out\n", stderr); exit(1) }
        if args[1] == "--smoke" && !reachable { exit(1) }
        return true
    }
    if args.count == 3 && args[1] == "--ui-smoke" { return false }
    if args.count == 3 && args[1] == "--screenshot" {
        let semaphore = DispatchSemaphore(value: 0)
        var reachable = false
        health { ok in reachable = ok; semaphore.signal() }
        guard semaphore.wait(timeout: .now() + 4) == .success else { fputs("Health check timed out\n", stderr); exit(1) }
        let config = loadConfig()
        var providers: [String] = []
        if reachable, let config = config {
            discover(config) { lines in providers = lines; semaphore.signal() }
            guard semaphore.wait(timeout: .now() + 10) == .success else { fputs("Provider discovery timed out\n", stderr); exit(1) }
        }
        _ = NSApplication.shared
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 320, height: 180))
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        let summary = (["Ownference Bridge", "Bridge: \(reachable ? "reachable" : "not reachable")",
                        "Runtime: \(config == nil ? "not configured" : "configured")"] +
                       (providers.isEmpty ? [] : ["Local provider discovery (defaults):"] + providers)).joined(separator: "\n")
        let label = NSTextField(wrappingLabelWithString: summary)
        label.frame = NSRect(x: 20, y: 15, width: 280, height: 150)
        view.addSubview(label)
        guard let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { exit(1) }
        view.cacheDisplay(in: view.bounds, to: bitmap)
        guard let png = bitmap.representation(using: .png, properties: [:]) else { exit(1) }
        do { try png.write(to: URL(fileURLWithPath: args[2])) }
        catch { fputs("Cannot write screenshot: \(error.localizedDescription)\n", stderr); exit(1) }
        return true
    }
    if args.count > 1 {
        fputs("Usage: Ownference-Bridge-MenuBar [--configure NODE [CLI [CONFIG_DIR]] | --status | --smoke | --screenshot PNG | --self-test]\n", stderr)
        exit(2)
    }
    return false
}

if !commandLine() {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.accessory)
    app.run()
}
