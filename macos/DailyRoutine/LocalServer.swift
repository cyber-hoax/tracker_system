import Foundation

@MainActor
final class LocalServer: ObservableObject {
  static let host = "127.0.0.1"
  static let port = 8765
  static let appURL = "http://\(host):\(port)"

  @Published var ready = false
  @Published var status = "Starting local server…"

  let url = URL(string: appURL)!

  private var process: Process?
  private var startedByUs = false

  func start() async {
    if await portOpen() {
      ready = true
      status = "Connected"
      return
    }

    status = "Starting Next.js…"
    do {
      try spawnDevServer()
      startedByUs = true
    } catch {
      status = error.localizedDescription
      return
    }

    let deadline = Date().addingTimeInterval(45)
    while Date() < deadline {
      if await portOpen() {
        ready = true
        status = "Connected"
        return
      }
      try? await Task.sleep(for: .milliseconds(250))
    }
    status = "Could not start the local server on port \(Self.port). Is Postgres running?"
  }

  func stop() {
    guard startedByUs else { return }
    process?.terminate()
    process = nil
    startedByUs = false
  }

  private func spawnDevServer() throws {
    let root = repoRoot()
    let task = Process()
    task.currentDirectoryURL = root
    task.executableURL = URL(fileURLWithPath: "/bin/zsh")
    task.arguments = [
      "-lc",
      "npx tsx src/db/ensure.ts && npx next dev -H \(Self.host) -p \(Self.port)",
    ]
    task.standardOutput = FileHandle.standardOutput
    task.standardError = FileHandle.standardError
    try task.run()
    process = task
  }

  private func repoRoot() -> URL {
    URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
  }

  private func portOpen() async -> Bool {
    var request = URLRequest(url: url)
    request.timeoutInterval = 0.6
    request.httpMethod = "GET"
    do {
      _ = try await URLSession.shared.data(for: request)
      return true
    } catch {
      return false
    }
  }
}
