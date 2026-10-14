import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SplitBidFields, { splitPayload } from './SplitBidFields';
import { maxCampaignBid } from '../utils/bidBudget';

test('a raw and edited brief asks for one inclusive bid amount', () => {
  const markup = renderToStaticMarkup(<SplitBidFields value={{ raw: '1500', edited: '' }} onChange={() => {}} max={1500} />);
  expect((markup.match(/<input/g) || []).length).toBe(1);
  expect(markup).toContain('both the raw video and the edited video');
  expect(splitPayload({ raw: 1500, edited: '' })).toEqual({});
  expect(maxCampaignBid({ budget_max: 1000, editing_fee_per_video: 500,
    deliverable_items: [{ quantity: 2, edited_required: true, edited_by: 'creator' }] })).toBe(1500);
});
