import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { IN_OLD_APP } from './utils/appMode';
import AppErrorBoundary from './components/AppErrorBoundary';

const startupUrl = new URL(window.location.href);
if (startupUrl.searchParams.has('_ugcad_reload')) {
  startupUrl.searchParams.delete('_ugcad_reload');
  window.history.replaceState(window.history.state, '', startupUrl.toString());
}

// Inside the UGCad Android/iOS app the native shell already pads for the status and
// navigation bars, yet the WebView still reports them as safe-area insets. Flag it so
// the admin CSS applies each inset exactly once (see --safe-* in admin-mobile.css).
if (IN_OLD_APP) document.documentElement.classList.add('in-native-app');

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
);

// ── PWA: service worker (public/sw.js) ───────────────────────────────────────
// Production only (a dev worker would cache stale hot-reload bundles) and never inside the
// native app's WebView, which has its own shell. The worker serves /offline.html when a page
// load fails and never caches API/auth responses (see the header comment in sw.js).
// Update flow: a new worker waits; we show "A new version is available" and only swap
// (and reload) when the user taps Refresh, so nobody loses a half-filled form.
let userAskedForUpdate = false;

function showUpdateBanner(worker) {
  if (document.querySelector('.pwa-update')) return;
  const bar = document.createElement('div');
  bar.className = 'pwa-update';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = 'A new version is available.';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Refresh';
  refresh.onclick = () => { userAskedForUpdate = true; worker.postMessage({ type: 'SKIP_WAITING' }); };
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'pwa-update__later';
  later.textContent = 'Later';
  later.onclick = () => bar.remove();
  bar.append(text, refresh, later);
  document.body.appendChild(bar);
}

function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator) || window.ReactNativeWebView) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First install also fires this (clients.claim); only reload for a user-approved update.
    if (userAskedForUpdate) window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const incoming = reg.installing;
          if (!incoming) return;
          incoming.addEventListener('statechange', () => {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(incoming);
          });
        });
        // An installed app can stay open for days: look for a new version whenever it returns to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch(() => { /* no SW (private mode, blocked): the site still works online */ });
  });
}

registerServiceWorker();
