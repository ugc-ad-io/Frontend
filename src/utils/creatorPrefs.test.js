import { mergeNotif, mergePrivacy, persistPrefs, DEFAULT_PRIVACY } from './creatorPrefs';

test('server prefs override defaults; missing server prefs give defaults', () => {
  expect(mergeNotif({ weekly_digest: true, messages: false })).toMatchObject({ weekly_digest: true, messages: false, bid_updates: true });
  expect(mergeNotif(undefined).brief_matches).toBe(true);
  expect(mergePrivacy(null)).toEqual(DEFAULT_PRIVACY);
});

test('the legacy app key allow_direct_messages is read once and replaced by allow_messages', () => {
  const p = mergePrivacy({ allow_direct_messages: false, show_earnings: true });
  expect(p.allow_messages).toBe(false);
  expect(p.show_earnings).toBe(true);
  expect('allow_direct_messages' in p).toBe(false);
  // allow_messages wins when both exist
  expect(mergePrivacy({ allow_messages: true, allow_direct_messages: false }).allow_messages).toBe(true);
});

test('persistPrefs sends {key: value} and reports success', async () => {
  const put = jest.fn().mockResolvedValue({});
  const r = await persistPrefs(put, 'privacy', { public_profile: false }, { public_profile: true });
  expect(put).toHaveBeenCalledWith({ privacy: { public_profile: false } });
  expect(r).toEqual({ ok: true, value: { public_profile: false } });
});

test('persistPrefs rolls back to the last saved value when the request fails', async () => {
  const err = new Error('offline');
  const r = await persistPrefs(jest.fn().mockRejectedValue(err), 'notification_prefs', { messages: false }, { messages: true });
  expect(r).toEqual({ ok: false, value: { messages: true }, error: err });
});
