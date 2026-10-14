import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { publishLiveUpdate, useLiveEffect, useLiveUpdates } from './liveUpdates';

global.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
beforeEach(() => {
  jest.useFakeTimers();
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); jest.useRealTimers(); jest.restoreAllMocks();
});

test('cursor changes invalidate cached reads and refresh the mounted data effect', async () => {
  const load = jest.fn(), invalidate = jest.fn();
  let version = 'one';
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ version }) }));
  function Page() { useLiveUpdates('token', invalidate); useLiveEffect(load, []); return <div />; }
  await act(async () => { root.render(<Page />); });
  expect(load).toHaveBeenCalledTimes(1);
  version = 'two';
  await act(async () => { jest.advanceTimersByTime(15000); });
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => { jest.advanceTimersByTime(15000); });
  expect(load).toHaveBeenCalledTimes(2);
});

test('editing an input defers refresh until focus leaves and retains its value', async () => {
  const load = jest.fn();
  function Page() { useLiveEffect(load, []); return <input defaultValue="My draft" />; }
  await act(async () => { root.render(<Page />); });
  const input = host.querySelector('input'); input.focus(); input.value = 'Unsaved changes';
  act(() => publishLiveUpdate());
  expect(load).toHaveBeenCalledTimes(1);
  input.blur();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(load).toHaveBeenCalledTimes(2);
  expect(input.value).toBe('Unsaved changes');
});

test('a dirty form continues to defer data refresh after the input loses focus', async () => {
  const load = jest.fn();
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ version: 'one' }) }));
  function Page() { useLiveUpdates('token', () => {}); useLiveEffect(load, []); return <form onSubmit={event => event.preventDefault()}><input defaultValue="draft" /></form>; }
  await act(async () => { root.render(<Page />); });
  const input = host.querySelector('input'); input.focus(); input.value = 'Edited draft';
  input.dispatchEvent(new Event('input', { bubbles: true })); input.blur();
  act(() => publishLiveUpdate());
  expect(load).toHaveBeenCalledTimes(1);
  host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  act(() => publishLiveUpdate());
  expect(load).toHaveBeenCalledTimes(2);
});
