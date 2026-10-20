import { hireUnfunded, hireUnfundedMessage, escrowHeldText, showUnfundedHire, WALLET_RECHARGE_PATH } from './hireFunding';

test('only funded === false counts as unfunded', () => {
  expect(hireUnfunded({ funded: false })).toBe(true);
  expect(hireUnfunded({ funded: true })).toBe(false);
  expect(hireUnfunded({})).toBe(false);
  expect(hireUnfunded(undefined)).toBe(false);
});

test('the prompt names the amount the hire costs, or just says funds when unknown', () => {
  expect(hireUnfundedMessage({ funded: false, amount_charged: 3300 }, 'Arushi'))
    .toBe('Arushi is hired, but your wallet is short. Add Rs. 3,300 to fund the escrow so work can start.');
  expect(hireUnfundedMessage({ funded: false })).toContain('Add funds to fund the escrow');
});

test('escrow text prefers amount_charged, falls back to amount, then no number', () => {
  expect(escrowHeldText({ amount: 3000, amount_charged: 3300 })).toBe('Rs. 3,300 held in escrow.');
  expect(escrowHeldText({ amount: 3000 })).toBe('Rs. 3,000 held in escrow.');
  expect(escrowHeldText({})).toBe('Payment held in escrow.');
});

test('the toast action opens the wallet recharge and does not block', () => {
  const toast = { warning: jest.fn() };
  const navigate = jest.fn();
  showUnfundedHire(toast, { funded: false, amount_charged: 500 }, 'Dev', navigate);
  const [msg, opts] = toast.warning.mock.calls[0];
  expect(msg).toContain('Add Rs. 500');
  expect(navigate).not.toHaveBeenCalled();
  opts.action.onClick();
  expect(navigate).toHaveBeenCalledWith(WALLET_RECHARGE_PATH);
});
