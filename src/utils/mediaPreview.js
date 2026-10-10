// Every portfolio video in the media bucket has a ~2 MB 480p clip and a still poster
// at previews/<same path>.mp4|.jpg (the backend makes them on upload; the app uses the
// same rule in its mediaPreview.ts). Tiles load those instead of the full original,
// which can be hundreds of MB. Returns '' for anything else.
const S3_VIDEO = /^https?:\/\/ugcad-media\.s3[^/]*\/(?!previews\/)(.+)\.(?:mp4|mov|webm|m4v)(?:[?#].*)?$/i;

export const s3Preview = (url, ext) => {
  const m = S3_VIDEO.exec(String(url || ''));
  return m ? `https://ugcad-media.s3.ap-south-1.amazonaws.com/previews/${m[1]}.${ext}` : '';
};
