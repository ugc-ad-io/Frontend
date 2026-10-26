import { campaignStage, campaignPill, STAGE_LABELS } from './campaignStage';

const hiredCreator = [{ id: 'cr1' }];

describe('campaignStage', () => {
  it('a physical product keeps all six steps, and waits on "Shipped" until tracking exists', () => {
    const c = { status: 'in_progress', requires_shipment: true, selected_creators: hiredCreator };
    const waiting = campaignStage(c, false);
    expect(waiting.labels).toEqual(STAGE_LABELS);
    expect(waiting.label).toBe('Shipped');
    expect(waiting.step).toBe(3);
    expect(waiting.total).toBe(6);
    expect(campaignPill(c, false).text).toBe('Awaiting shipment');
    expect(campaignStage(c, true).label).toBe('Filming');
  });

  it('a digital product has no "Shipped" step: five steps, filming is step 3', () => {
    const c = { status: 'in_progress', requires_shipment: false, selected_creators: hiredCreator };
    const s = campaignStage(c);
    expect(s.labels).toEqual(['Brief', 'Bids', 'Filming', 'Review', 'Done']);
    expect(s.label).toBe('Filming');
    expect(s.step).toBe(3);
    expect(s.total).toBe(5);
    expect(s.shownIdx).toBe(2);
    expect(campaignPill(c).text).toBe('In progress');
  });

  it('review and done land on the right step without the shipping step', () => {
    expect(campaignStage({ status: 'work_submitted' }).label).toBe('Review');
    expect(campaignStage({ status: 'work_submitted' }).step).toBe(4);
    expect(campaignStage({ status: 'completed' }).label).toBe('Done');
    expect(campaignStage({ status: 'completed' }).step).toBe(5);
  });

  it('bids and brief stay the same for both kinds of campaign', () => {
    expect(campaignStage({ status: 'active', bids: [{}] }).label).toBe('Bids');
    expect(campaignStage({ status: 'draft' }).label).toBe('Brief');
  });
});
