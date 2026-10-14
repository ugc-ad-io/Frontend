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

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
);
