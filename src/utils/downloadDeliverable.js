import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

/**
 * Save a delivered file (video / image) to the user's device.
 *
 * Do NOT fetch the file as a blob through GET /work/:id/download: the server answers
 * with a redirect to S3, a browser sends `Origin: null` when an XHR follows a
 * cross-origin redirect, and the bucket's CORS rules reject that — the download
 * just fails. Instead ask for a link (?as_link=1) and let the browser navigate to
 * it. The link is a presigned S3 URL that says "save as", so no CORS is involved
 * and the page is not left.
 *
 * @param {string} api       API base, e.g. `${BACKEND_URL}/api`
 * @param {string} workId    a work submission id or a campaign / deal id
 * @param {string} [name]    file name without extension (the server adds the real one)
 * @throws the axios error, with the server's reason in response.data.detail
 */
export async function downloadDeliverable(api, workId, name, asset) {
  const { data } = await axios.get(`${api}/work/${encodeURIComponent(workId)}/download`, {
    params: { as_link: 1, ...(asset ? { asset } : {}), ...(name ? { name } : {}) },
  });
  const href = /^https?:\/\//i.test(data.url) ? data.url : `${BACKEND_URL}${data.url}`;

  const a = document.createElement('a');
  a.rel = 'noopener';
  if (data.forced) {
    // Served with "attachment": the click downloads and the current page stays.
    a.href = href;
    a.download = data.filename || '';
  } else if (href.startsWith(BACKEND_URL)) {
    // A file on our own API host: an authorised same-API fetch is fine, and lets us
    // name it (the download attribute only works for a blob / same-origin URL).
    const res = await axios.get(href, { responseType: 'blob' });
    a.href = window.URL.createObjectURL(res.data);
    a.download = data.filename || '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(a.href), 10000);
    return;
  } else {
    // Unknown host that will not force a download. Save it in-page as a blob when the
    // host allows it (no credentials, so no Origin: null / CORS trouble with our API
    // token); only if that is blocked open it in a tab rather than fail silently.
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(String(res.status));
      a.href = window.URL.createObjectURL(await res.blob());
      a.download = data.filename || '';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(a.href), 10000);
      return;
    } catch {
      a.href = href;
      a.target = '_blank';
    }
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
}
