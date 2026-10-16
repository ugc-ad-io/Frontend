import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import AppErrorBoundary from './components/AppErrorBoundary';

const startupUrl = new URL(window.location.href);
if (startupUrl.searchParams.has('_ugcad_reload')) {
  startupUrl.searchParams.delete('_ugcad_reload');
  window.history.replaceState(window.history.state, '', startupUrl.toString());
}

// Inside the UGCad Android/iOS app the native shell already pads for the status and
// navigation bars, yet the WebView still reports them as safe-area insets. Flag it so
// the admin CSS applies each inset exactly once (see --safe-* in admin-mobile.css).
if (window.ReactNativeWebView) document.documentElement.classList.add('in-native-app');

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
);
