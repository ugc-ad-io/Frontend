import { act } from 'react';
import { createRoot } from 'react-dom/client';
import VideoReviewModal from './VideoReviewModal';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function type(el, value) {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function setup(props = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onSubmit = jest.fn();
  await act(async () => root.render(<VideoReviewModal src="a.mp4" onClose={() => {}} onSubmit={onSubmit} {...props} />));
  const addComment = async (text) => {
    await act(async () => type(host.querySelector('.vrm-input textarea'), text));
    await act(async () => host.querySelector('.vrm-send').click());
  };
  return { host, root, onSubmit, addComment, done: async () => { await act(async () => root.unmount()); host.remove(); } };
}

test('caps at 5 items with a visible counter, and sends the app payload with the deadline', async () => {
  const { host, onSubmit, addComment, done } = await setup();
  try {
    expect(host.querySelector('[data-testid="vrm-counter"]').textContent).toContain('0/5');
    for (let i = 1; i <= 6; i += 1) await addComment(`change ${i}`);
    expect(host.querySelector('[data-testid="vrm-counter"]').textContent).toContain('5/5');
    expect(host.querySelectorAll('.vrm-c')).toHaveLength(5);
    expect(host.querySelector('.vrm-send').disabled).toBe(true);
    await act(async () => host.querySelector('.vrm-submit').click());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.items).toHaveLength(5);
    expect(payload.items[0]).toEqual({ description: 'change 1', severity: 'must-fix', timestamp_seconds: 0 });
    expect(typeof payload.deadline_at).toBe('string');
    expect(payload.notes).toBe('');
  } finally { await done(); }
});

test('a note takes a slot: with 5 changes it blocks sending, and it rides as the last item', async () => {
  const { host, onSubmit, addComment, done } = await setup();
  try {
    for (let i = 1; i <= 4; i += 1) await addComment(`change ${i}`);
    await act(async () => type(host.querySelector('.vrm-notes'), 'please hurry'));
    expect(host.querySelector('[data-testid="vrm-counter"]').textContent).toContain('5/5');
    await act(async () => host.querySelector('.vrm-submit').click());
    const items = onSubmit.mock.calls[0][0].items;
    expect(items).toHaveLength(5);
    expect(items[4]).toEqual({ description: 'Note: please hurry', severity: 'preference' });
  } finally { await done(); }
});

test('fee text shows only server amounts, never the old Rs 500 / Rs 300', async () => {
  const withFee = await setup({ freeRemaining: 0, nextFee: 700 });
  try {
    expect(withFee.host.querySelector('.vrm-fee').textContent).toContain('₹700');
    expect(withFee.host.querySelector('.vrm-fee').textContent).not.toMatch(/500|300/);
  } finally { await withFee.done(); }
  const last = await setup({ freeRemaining: 1 });
  try {
    expect(last.host.querySelector('.vrm-fee').textContent).not.toMatch(/₹/);
  } finally { await last.done(); }
});
