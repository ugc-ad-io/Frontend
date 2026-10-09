import axios from 'axios';

// Biggest video a user can upload. Must match VIDEO_MAX_BYTES on the server.
export const MAX_UPLOAD_MB = 400;

// Up to this size a video goes through our own server (/upload/file). The hosting
// proxy in front of the server cuts requests past ~100 MB (the browser then only
// says "Network Error"), so anything larger goes straight to S3 instead.
const SERVER_UPLOAD_MB = 90;

const POLL_EVERY_MS = 2000;
const POLL_GIVE_UP_MS = 30 * 60 * 1000;

const mbOf = (file) => Math.round(file.size / 1048576);

export const tooLargeMessage = (file, maxMb = MAX_UPLOAD_MB) =>
  `${file.name || 'This file'} is ${mbOf(file)} MB. The maximum is ${maxMb} MB — compress or trim it and try again.`;

const interrupted = (maxMb) =>
  `The upload was interrupted. Check your connection and try again — videos must be ${maxMb} MB or smaller.`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendProgress = (onProgress) => (e) => {
  if (onProgress && e.total) onProgress(Math.min(100, Math.round((e.loaded * 100) / e.total)));
};

// A video file's MIME type is sometimes empty (some phones, .mov); the server needs one.
const videoType = (file) => {
  if (file.type) return file.type;
  return /\.mov$/i.test(file.name || '') ? 'video/quicktime' : 'video/mp4';
};

async function uploadViaServer(file, apiBase, onProgress, maxMb) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await axios.post(`${apiBase}/upload/file`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: sendProgress(onProgress),
    });
    return res.data;
  } catch (err) {
    // No response at all = the connection or a proxy dropped the request.
    if (!err.response) throw new Error(interrupted(maxMb));
    throw err;
  }
}

// browser -> S3 directly, then the server converts the video in the background.
async function uploadViaS3(file, apiBase, onProgress, maxMb) {
  const contentType = videoType(file);
  const { data: form } = await axios.post(`${apiBase}/upload/presign`, {
    filename: file.name || 'video.mp4',
    content_type: contentType,
    size: file.size,
  });

  // A fresh axios instance on purpose: the app's default instance attaches our
  // login token to every request, and S3 refuses a request carrying a second
  // credential. The signed form is the credential here.
  const body = new FormData();
  Object.entries(form.fields).forEach(([name, value]) => body.append(name, value));
  body.append('file', file);   // S3 requires the file to be the last field
  try {
    await axios.create().post(form.url, body, { onUploadProgress: sendProgress(onProgress) });
  } catch (err) {
    if (!err.response) throw new Error(interrupted(maxMb));
    throw new Error('The upload was rejected. Check the file is a video under ' + maxMb + ' MB and try again.');
  }
  if (onProgress) onProgress(100);   // bytes are sent; the server now converts the video

  const { data: job } = await axios.post(`${apiBase}/upload/finalize`, {
    key: form.key,
    original_filename: file.name,
  });
  const started = Date.now();
  for (;;) {
    await wait(POLL_EVERY_MS);
    let status;
    try {
      ({ data: status } = await axios.get(`${apiBase}/upload/status/${job.job_id}`));
    } catch (err) {
      if (err.response && err.response.status !== 502 && err.response.status !== 503) throw err;
      status = { status: 'processing' };   // a blip while polling: keep waiting
    }
    if (status.status === 'done') return status.result;
    if (status.status === 'failed') throw new Error(status.error || 'Could not process this video. Please try again.');
    if (Date.now() - started > POLL_GIVE_UP_MS) {
      throw new Error('Processing is taking too long. Please try again in a few minutes.');
    }
  }
}

/**
 * Upload one file and resolve with the stored-file record ({ file_url, ... }).
 * `onProgress(0-100)` fires as bytes leave the phone and reaches 100 before the
 * server has finished converting a video, so callers show "Processing…" at 100.
 * Throws an Error whose message is safe to show (see apiErrorMessage).
 */
export async function uploadMedia(file, apiBase, { onProgress, maxMb = MAX_UPLOAD_MB } = {}) {
  const isVideo = file.type?.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv|3gp|mpe?g)$/i.test(file.name || '');
  if (isVideo && file.size > maxMb * 1048576) throw new Error(tooLargeMessage(file, maxMb));
  if (isVideo && file.size > SERVER_UPLOAD_MB * 1048576) return uploadViaS3(file, apiBase, onProgress, maxMb);
  return uploadViaServer(file, apiBase, onProgress, maxMb);
}
