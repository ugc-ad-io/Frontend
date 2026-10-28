import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SelectSheet from './SelectSheet';

jest.mock('./useAppBack', () => ({ useAppBack: () => {} }));

function Form({ onPick }) {
  const [v, setV] = useState('+91');
  return (
    <div>
      <label htmlFor="dial">Country code</label>
      <select id="dial" value={v} onChange={(e) => { setV(e.target.value); onPick(e.target.value); }}>
        <option value="+91">+91</option>
        <option value="+1">+1</option>
        <option value="+44" disabled>+44</option>
      </select>
      <select id="plain" data-native defaultValue="a"><option value="a">A</option></select>
      <SelectSheet />
    </div>
  );
}

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
async function mount(ui) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return () => act(async () => { root.unmount(); container.remove(); });
}
const opts = () => [...document.querySelectorAll('.ap-sel-opt')];

describe('SelectSheet (custom dropdown in app mode)', () => {
  it('opens a list instead of the OS picker, marks the selected option, and changes the value through React', async () => {
    const onPick = jest.fn();
    const unmount = await mount(<Form onPick={onPick} />);
    await click(document.getElementById('dial'));
    expect(document.querySelector('[role=dialog]').getAttribute('aria-label')).toBe('Country code');
    expect(opts().map((o) => o.textContent)).toEqual(['+91', '+1', '+44']);
    expect(opts()[0].getAttribute('aria-selected')).toBe('true');
    expect(opts()[2].disabled).toBe(true);
    await click(opts()[1]);
    expect(onPick).toHaveBeenCalledWith('+1');
    expect(document.getElementById('dial').value).toBe('+1');
    expect(document.querySelector('[role=dialog]')).toBeNull();
    await unmount();
  });

  it('leaves data-native selects alone', async () => {
    const unmount = await mount(<Form onPick={() => {}} />);
    await click(document.getElementById('plain'));
    expect(document.querySelector('[role=dialog]')).toBeNull();
    await unmount();
  });
});
