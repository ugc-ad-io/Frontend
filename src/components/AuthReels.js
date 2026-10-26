import '../styles/auth-reels.css';

// The creator review clips from the "Join as a creator" page (public/creator/review_0N.mp4 + .jpg poster).
const REELS = [1, 2, 3, 4, 5].map((n) => `/creator/review_0${n}`);

/**
 * Row of five phone-shaped creator video tiles shown on the login / sign-up hero (website left panel and phone app).
 *   play  true: the clips play muted on a loop (desktop panel).  false: poster stills only (phones: no video data).
 */
export default function AuthReels({ play = false, className = '' }) {
  const base = process.env.PUBLIC_URL || '';
  return (
    <div className={`auth-reels${className ? ` ${className}` : ''}`} aria-hidden="true">
      {REELS.map((src) => (
        <span className="auth-reel" key={src}>
          <img src={`${base}${src}.jpg`} alt="" loading="lazy" decoding="async" />
          {play && <video src={`${base}${src}.mp4`} poster={`${base}${src}.jpg`} muted loop autoPlay playsInline preload="metadata" tabIndex={-1} />}
        </span>
      ))}
    </div>
  );
}
