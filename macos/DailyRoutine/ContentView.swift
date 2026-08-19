import SwiftUI

struct ContentView: View {
  @ObservedObject var server: LocalServer

  var body: some View {
    ZStack {
      AppWebView(url: server.url, ready: server.ready)
      if !server.ready {
        VStack(spacing: 14) {
          ProgressView()
          Text(server.status)
            .font(.system(size: 13))
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .windowBackgroundColor))
      }
    }
    .ignoresSafeArea()
    .task {
      await server.start()
    }
    .onDisappear {
      server.stop()
    }
  }
}
