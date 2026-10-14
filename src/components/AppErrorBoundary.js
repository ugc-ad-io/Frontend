import { Component } from 'react';
import { shouldRecoverChunk, freshPageUrl } from '../utils/chunkRecovery';

export default class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    console.error('Website failed to load', error);
    try {
      if (shouldRecoverChunk(error, window.sessionStorage)) window.location.replace(freshPageUrl(window.location.href));
    } catch { /* Keep the retry action available when browser storage is blocked. */ }
  }
  render() {
    if (this.state.failed) return (
      <main role="alert" style={{ padding: 32, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1>UGCad.io</h1>
        <p>This page could not load. Please try again.</p>
        <button type="button" onClick={() => window.location.replace(freshPageUrl(window.location.href))}>Retry loading page</button>
      </main>
    );
    return this.props.children;
  }
}
