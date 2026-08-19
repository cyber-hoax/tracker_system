import AppKit
import SwiftUI
import WebKit

struct AppWebView: NSViewRepresentable {
  let url: URL
  var ready: Bool

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  func makeNSView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    config.defaultWebpagePreferences.allowsContentJavaScript = true
    let webView = WKWebView(frame: .zero, configuration: config)
    webView.navigationDelegate = context.coordinator
    webView.allowsBackForwardNavigationGestures = true
    webView.setValue(false, forKey: "drawsBackground")
    if let base = webView.value(forKey: "userAgent") as? String {
      webView.customUserAgent = base + " DailyRoutineNative/1.0"
    } else {
      webView.customUserAgent = "DailyRoutineNative/1.0"
    }
    return webView
  }

  func updateNSView(_ webView: WKWebView, context: Context) {
    guard ready, !context.coordinator.didLoad else { return }
    context.coordinator.didLoad = true
    webView.load(URLRequest(url: url))
  }

  final class Coordinator: NSObject, WKNavigationDelegate {
    var didLoad = false
    func webView(
      _ webView: WKWebView,
      decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
      guard let url = navigationAction.request.url else {
        decisionHandler(.allow)
        return
      }
      if navigationAction.targetFrame == nil {
        NSWorkspace.shared.open(url)
        decisionHandler(.cancel)
        return
      }
      if let host = url.host, host != "127.0.0.1", host != "localhost" {
        NSWorkspace.shared.open(url)
        decisionHandler(.cancel)
        return
      }
      decisionHandler(.allow)
    }
  }
}
