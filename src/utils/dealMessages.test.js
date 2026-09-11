import { findCreatorDeal, getDealMessages } from './dealMessages';

const deal = { deal_id: 'd1', campaign: { id: 'campaign' }, creator: { id: 'deshna' }, chat_summary: { messages: [
  { id: 'brand', sender_type: 'system', message: "You've successfully selected Deshna for the campaign" },
  { id: 'creator', sender_type: 'system', message: "Congratulations! You've been selected for the campaign" },
  { id: 'other', sender_type: 'creator', sender_id: 'arushi', message: 'Private reply' },
  { id: 'wrong-deal', deal_id: 'd2', message: 'Other thread' },
  { id: 'private', sender_type: 'system', recipient_id: 'arushi', message: 'Private notice' },
  { id: 'shipment', sender_type: 'system', message: 'Shipment dispatched' },
] } };

test('does not fall back to another creator in the same campaign', () => {
  expect(findCreatorDeal([deal], 'campaign', 'arushi')).toBeNull();
  expect(findCreatorDeal([deal], 'campaign', 'deshna')).toBe(deal);
  expect(findCreatorDeal([deal], 'other', 'deshna')).toBeNull();
});

test('creator sees their selection copy and shared updates only', () => {
  expect(getDealMessages(deal, 'creator', 'deshna').map((m) => m.id)).toEqual(['creator', 'shipment']);
  expect(getDealMessages(deal, 'creator', 'arushi')).toEqual([]);
});

test('brand sees brand selection copy, not the creator notice', () => {
  expect(getDealMessages(deal, 'brand', 'brand-user').map((m) => m.id)).toEqual(['brand', 'shipment']);
});
