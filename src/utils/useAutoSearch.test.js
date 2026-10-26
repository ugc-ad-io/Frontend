import { act } from 'react';
import { createRoot } from 'react-dom/client';
import useAutoSearch from './useAutoSearch';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Box({ value, committed, commit }) {
  useAutoSearch(value, committed, commit, 300);
  return null;
}

let root;
const show = (props) => act(async () => { root.render(<Box {...props} />); });
const tick = (ms) => act(async () => { jest.advanceTimersByTime(ms); });

describe('useAutoSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    root = createRoot(document.createElement('div'));
  });
  afterEach(() => {
    act(() => root.unmount());
    jest.useRealTimers();
  });

  it('commits the trimmed text once typing pauses, without Enter', async () => {
    const commit = jest.fn();
    await show({ value: '', committed: '', commit });
    await show({ value: 'ser', committed: '', commit });
    await tick(200);
    expect(commit).not.toHaveBeenCalled();
    await show({ value: 'serum ', committed: '', commit });
    await tick(299);
    expect(commit).not.toHaveBeenCalled();
    await tick(2);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('serum');
  });

  it('does nothing when the box already matches what was searched', async () => {
    const commit = jest.fn();
    await show({ value: ' serum', committed: 'serum', commit });
    await tick(1000);
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits an emptied box so a search can be cleared', async () => {
    const commit = jest.fn();
    await show({ value: '', committed: 'serum', commit });
    await tick(400);
    expect(commit).toHaveBeenCalledWith('');
  });
});
