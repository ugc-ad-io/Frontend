import { Component } from 'react';
import { AlertTriangle, WifiOff } from 'lucide-react';
import '../styles/brand-ui-states.css';
import '../styles/brand-ui-mobile-b.css';
import { shouldRecoverChunk, freshPageUrl } from '../utils/chunkRecovery';

export default class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  componentDidCatch(error) {
    console.error('Website failed to load', error);
    try {
      if (shouldRecoverChunk(error, window.sessionStorage)) window.location.replace(freshPageUrl(window.location.href));
    } catch { /* Keep the retry action available when browser storage is blocked. */ }
  }
  render() {
    if (this.state.failed) {
      // A lazy page chunk that cannot download while offline is the common cause: say so.
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      return (
        <main role="alert" className="app-full bui-err">
          <div className="bui-err-card">
            <span className="bui-err-ic" aria-hidden="true">{offline ? <WifiOff size={26} /> : <AlertTriangle size={26} />}</span>
            <h1>{offline ? "You're offline" : 'Something went wrong'}</h1>
            <p>{offline ? 'Check your connection, then try again.' : 'This page could not load. Please try again.'}</p>
            <div className="bui-err-actions">
              <a className="bui-err-btn bui-err-btn--ghost" href="/">Go to home</a>
              <button type="button" className="bui-err-btn" onClick={() => window.location.replace(freshPageUrl(window.location.href))}>
                Retry loading page
              </button>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
