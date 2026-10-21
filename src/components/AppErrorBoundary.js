import { Component } from 'react';
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
        <main
          role="alert"
          className="app-full"
          style={{
            boxSizing: 'border-box', display: 'grid', placeItems: 'center', textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: 'max(24px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
          }}
        >
          <div style={{ width: '100%', maxWidth: 420, minWidth: 0 }}>
            <h1 style={{ margin: '0 0 8px' }}>{offline ? "You're offline" : 'UGCad.io'}</h1>
            <p style={{ margin: '0 0 20px', fontSize: 16, lineHeight: 1.5 }}>
              {offline ? 'Check your connection, then try again.' : 'This page could not load. Please try again.'}
            </p>
            <button
              type="button"
              style={{ minHeight: 48, padding: '12px 28px', borderRadius: 999, border: 0, background: '#0A0A47', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}
              onClick={() => window.location.replace(freshPageUrl(window.location.href))}
            >
              Retry loading page
            </button>
            <p style={{ marginTop: 16 }}><a href="/" style={{ display: 'inline-block', padding: 12 }}>Go to home</a></p>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
