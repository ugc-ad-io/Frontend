import React from 'react';

/**
 * App-wide loading indicator — plays /public/loading.webm instead of a text/CSS spinner.
 *
 *  <Loader />                         full-screen overlay (route / page loads)
 *  <Loader fullscreen={false} />      inline, centred in its container (panels, cards)
 *  <Loader size={64} label="…" />     custom size + optional caption
 */
export default function Loader({ fullscreen = true, size = 120, label }) {
  const wrapStyle = fullscreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: '#0a0a12',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '40px 0',
        width: '100%',
      };

  return (
    <div style={wrapStyle} role="status" aria-live="polite" aria-label={label || 'Loading'}>
      <video
        src="/loading.webm"
        autoPlay
        loop
        muted
        playsInline
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
      {label && (
        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
          {label}
        </span>
      )}
    </div>
  );
}
