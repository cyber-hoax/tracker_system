import AppKit
import SwiftUI

@main
struct DailyRoutineApp: App {
  @StateObject private var server = LocalServer()

  var body: some Scene {
    WindowGroup {
      ContentView(server: server)
        .frame(minWidth: 960, minHeight: 640)
    }
    .windowStyle(.hiddenTitleBar)
    .windowToolbarStyle(.unified)
    .defaultSize(width: 1320, height: 860)
    .commands {
      CommandGroup(replacing: .newItem) {}
      CommandGroup(after: .help) {
        Button("Open in Browser") {
          if let url = URL(string: LocalServer.appURL) {
            NSWorkspace.shared.open(url)
          }
        }
      }
    }
  }
}
