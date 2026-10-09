// Thin progress bar for file uploads. `percent` is 0-100, or null to hide it.
export default function UploadProgress({ percent }) {
  if (percent == null) return null;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} style={{ width: '100%', marginTop: 10 }}>
      <div style={{ height: 8, borderRadius: 999, background: 'rgba(127,127,160,0.25)', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: '#6366f1', transition: 'width 0.2s ease' }} />
      </div>
      <small style={{ display: 'block', marginTop: 4, fontSize: 12, opacity: 0.85 }}>
        {percent >= 100 ? 'Processing…' : `Uploading ${percent}%`}
      </small>
    </div>
  );
}
