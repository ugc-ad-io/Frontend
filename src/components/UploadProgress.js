import '../styles/creator-ui-popups.css';

// Thin progress bar for file uploads (board C25 "Uploading"). `percent` is 0-100, or null to hide it.
export default function UploadProgress({ percent }) {
  if (percent == null) return null;
  return (
    <div className="cui-s-up" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className="cui-s-up-track"><div className="cui-s-up-fill" style={{ width: `${percent}%` }} /></div>
      <small>{percent >= 100 ? 'Processing…' : `Uploading ${percent}%`}</small>
    </div>
  );
}
