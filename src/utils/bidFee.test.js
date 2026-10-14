import { feeBreakdown, inr, pctLabel, DEFAULT_COMMISSION_PERCENT } from './bidFee';

test('20% of a ₹1,000 bid is a ₹200 fee and ₹800 to the creator', () => {
  expect(feeBreakdown(1000, 20)).toEqual({ gross: 1000, fee: 200, net: 800 });
});

test('uses the rate it is given, not a fixed 20', () => {
  expect(feeBreakdown(1000, 12.5)).toEqual({ gross: 1000, fee: 125, net: 875 });
  expect(feeBreakdown(1000, 0)).toEqual({ gross: 1000, fee: 0, net: 1000 });
});

test('rounds to paise and fee + net always add back to the bid', () => {
  const b = feeBreakdown(333, 20);
  expect(b.fee).toBe(66.6);
  expect(b.net).toBe(266.4);
  expect(Math.round((b.fee + b.net) * 100) / 100).toBe(333);
  const odd = feeBreakdown(1, 20);
  expect(odd.fee).toBe(0.2);
});

test('an empty, zero, negative or non-numeric amount has no breakdown', () => {
  expect(feeBreakdown('', 20)).toBeNull();
  expect(feeBreakdown(0, 20)).toBeNull();
  expect(feeBreakdown(-5, 20)).toBeNull();
  expect(feeBreakdown('abc', 20)).toBeNull();
  expect(feeBreakdown(100, 'x')).toBeNull();
});

test('defaults and labels', () => {
  expect(DEFAULT_COMMISSION_PERCENT).toBe(20);
  expect(feeBreakdown(500)).toEqual({ gross: 500, fee: 100, net: 400 });
  expect(pctLabel(20)).toBe('20');
  expect(pctLabel(12.5)).toBe('12.5');
  expect(inr(1234.5)).toBe('₹1,234.5');
});
