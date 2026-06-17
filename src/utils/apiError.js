// Normalise any axios/backend error into a plain string safe to pass to toast.error()
// or render in JSX.
//
// FastAPI returns validation (422) errors as `detail: [{ loc, msg, type }, ...]` — an ARRAY
// of objects. Passing that straight to toast.error() (or rendering it) makes React try to
// render objects as children and throws:
//   "Objects are not valid as a React child (found: object with keys {loc, msg, type})"
//
// This helper collapses every shape we get back — string detail, array of validation errors,
// a single object, or a plain message — down to one string, with a fallback.
export function apiErrorMessage(error, fallback = 'Something went wrong') {
  const data = error?.response?.data;
  const detail = data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const msg = detail
      .map((d) => {
        if (typeof d === 'string') return d;
        // FastAPI loc is like ["body", "age"] — surface the FIELD name so a 422 says exactly
        // which field was rejected (e.g. "age: input should be a valid integer").
        const field = Array.isArray(d?.loc)
          ? d.loc.filter((p) => p !== 'body' && p !== 'query' && p !== 'path').join('.')
          : '';
        return field ? `${field}: ${d?.msg}` : d?.msg;
      })
      .filter(Boolean)
      .join(', ');
    if (msg) return msg;
  }

  if (detail && typeof detail === 'object' && detail.msg) return detail.msg;

  if (typeof data?.message === 'string') return data.message;
  if (typeof error?.message === 'string' && !error.response) return error.message;

  return fallback;
}
