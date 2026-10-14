/**
 * The bid gate: an incomplete profile gets a pop-up listing what's missing (and never the
 * bid form); a complete one sees the platform-fee pop-up first. No testing-library in this
 * repo, so this drives React 19 directly.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const mockNavigate = jest.fn();
const mockGet = jest.fn();

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('axios', () => ({ __esModule: true, default: { get: (...a) => mockGet(...a) } }));

// eslint-disable-next-line import/first
import { useBidGate, BidFeeNotice } from './BidGate';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let gate;

function Harness({ user }) {
  gate = useBidGate(user);
  return <div>{gate.ui}</div>;
}

const text = () => container.textContent;
const click = async (label) => {
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
  if (!btn) throw new Error(`no button "${label}" in: ${text()}`);
  await act(async () => { btn.click(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async (user = {}) => { await act(async () => { root.render(<Harness user={user} />); }); };

test('an incomplete profile gets a pop-up listing what is missing, and cannot continue', async () => {
  mockGet.mockResolvedValue({ data: {
    can_bid: false, commission_percent: 20,
    missing: ['a profile picture', 'an intro video'],
  } });
  await render();
  let ok;
  await act(async () => { ok = await gate.ensureProfile(); });

  expect(ok).toBe(false);
  expect(text()).toContain('Complete your profile to bid');
  expect(text()).toContain('a profile picture');
  expect(text()).toContain('an intro video');
  expect(text()).not.toContain('Platform fee');
});

test('"Complete profile" takes the creator to the profile tab of settings and closes the pop-up', async () => {
  mockGet.mockResolvedValue({ data: { can_bid: false, missing: ['an intro video'], commission_percent: 20 } });
  await render();
  await act(async () => { await gate.ensureProfile(); });
  await click('Complete profile');

  expect(mockNavigate).toHaveBeenCalledWith('/settings?tab=profile');
  expect(text()).not.toContain('Complete your profile to bid');
});

test('"Not now" closes the pop-up without leaving the page', async () => {
  mockGet.mockResolvedValue({ data: { can_bid: false, missing: ['an intro video'], commission_percent: 20 } });
  await render();
  await act(async () => { await gate.ensureProfile(); });
  await click('Not now');

  expect(mockNavigate).not.toHaveBeenCalled();
  expect(text()).not.toContain('Complete your profile to bid');
});

test('a complete profile is let through and then sees the platform fee pop-up with the live rate', async () => {
  mockGet.mockResolvedValue({ data: { can_bid: true, missing: [], commission_percent: 25 } });
  await render();
  const open = jest.fn();
  let ok;
  await act(async () => { ok = await gate.ensureProfile(); });
  expect(ok).toBe(true);
  expect(text()).not.toContain('Complete your profile to bid');

  await act(async () => { gate.showFee(open); });
  expect(text()).toContain('Platform fee: 25%');
  expect(text()).toContain('₹1,000');   // worked example uses the server's rate
  expect(text()).toContain('₹250');
  expect(text()).toContain('₹750');
  expect(open).not.toHaveBeenCalled();   // the form does not open until they continue

  await click('Continue to bid');
  expect(open).toHaveBeenCalledTimes(1);
  expect(text()).not.toContain('Platform fee: 25%');
});

test('cancelling the fee pop-up never opens the bid form', async () => {
  mockGet.mockResolvedValue({ data: { can_bid: true, missing: [], commission_percent: 20 } });
  await render();
  const open = jest.fn();
  await act(async () => { await gate.ensureProfile(); });
  await act(async () => { gate.showFee(open); });
  await click('Cancel');

  expect(open).not.toHaveBeenCalled();
  expect(text()).not.toContain('Platform fee: 20%');
});

test('if the server cannot be reached it falls back to the website checklist', async () => {
  mockGet.mockRejectedValue(new Error('offline'));
  await render({ profile: {} });   // empty profile → everything missing
  let ok;
  await act(async () => { ok = await gate.ensureProfile(); });

  expect(ok).toBe(false);
  expect(text()).toContain('Complete your profile to bid');
  expect(container.querySelectorAll('[data-testid="bgate-missing"] li').length).toBeGreaterThan(0);
});

test('the in-form notice shows the fee and the amount the creator receives, updating with the bid', async () => {
  await act(async () => { root.render(<BidFeeNotice amount="" percent={20} />); });
  expect(text()).toContain('platform fee: 20%');
  expect(text()).not.toContain('You receive');

  await act(async () => { root.render(<BidFeeNotice amount="2500" percent={20} />); });
  expect(text()).toContain('₹2,500');
  expect(text()).toContain('₹500');
  expect(text()).toContain('You receive');
  expect(text()).toContain('₹2,000');
});
