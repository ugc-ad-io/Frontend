// Page numbers to show in a pager: first, last and the pages around the current one, with a
// '…' in each gap, so 60 pages is ~7 buttons instead of a row that runs off a 320px screen.
export function pageWindow(current, count, span = 1) {
  const keep = new Set([1, count]);
  for (let i = current - span; i <= current + span; i += 1) if (i >= 1 && i <= count) keep.add(i);
  const out = [];
  let prev = 0;
  [...keep].sort((a, b) => a - b).forEach((n) => {
    if (prev && n - prev === 2) out.push(prev + 1);
    else if (prev && n - prev > 2) out.push('…');
    out.push(n);
    prev = n;
  });
  return out;
}
