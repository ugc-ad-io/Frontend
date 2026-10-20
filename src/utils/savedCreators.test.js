import axios from 'axios';
import { toast } from 'sonner';
import {
  loadSavedCreators, toggleSavedCreator, removeSavedCreator, isCreatorSaved,
  isSavedCreatorsLoaded, __resetSavedCreators,
} from './savedCreators';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const URL = (id = '') => expect.stringMatching(new RegExp(`/api/business/saved-creators${id ? `/${id}` : ''}$`));

beforeEach(() => {
  jest.clearAllMocks();
  __resetSavedCreators();
  localStorage.clear();
  axios.get.mockResolvedValue({ data: { creator_ids: ['a'] } });
  axios.post.mockResolvedValue({ data: { saved: true } });
  axios.delete.mockResolvedValue({ data: { saved: false } });
});

test('load reads creator_ids from the server', async () => {
  expect(await loadSavedCreators()).toEqual(['a']);
  expect(axios.get).toHaveBeenCalledWith(URL());
  expect(isCreatorSaved('a')).toBe(true);
  expect(isCreatorSaved('b')).toBe(false);
});

test('legacy localStorage ids are POSTed once, then the key is cleared', async () => {
  localStorage.setItem('ugc_saved_creators', JSON.stringify([{ id: 'a' }, { id: 'b', name: 'B' }]));
  await loadSavedCreators();
  expect(axios.post).toHaveBeenCalledTimes(1);           // 'a' is already on the server
  expect(axios.post).toHaveBeenCalledWith(URL('b'));
  expect(localStorage.getItem('ugc_saved_creators')).toBeNull();
  expect(isCreatorSaved('b')).toBe(true);
  await loadSavedCreators();
  expect(axios.get).toHaveBeenCalledTimes(1);            // cached, no second migration
});

test('legacy key is kept when the migration hits a network error', async () => {
  localStorage.setItem('ugc_saved_creators', JSON.stringify([{ id: 'b' }]));
  axios.post.mockRejectedValue(new Error('Network Error'));
  await loadSavedCreators();
  expect(localStorage.getItem('ugc_saved_creators')).not.toBeNull();
});

test('a failed load is not cached and can be retried', async () => {
  axios.get.mockRejectedValueOnce(new Error('Network Error'));
  await loadSavedCreators();
  expect(isSavedCreatorsLoaded()).toBe(false);
  await loadSavedCreators();
  expect(isSavedCreatorsLoaded()).toBe(true);
});

test('toggle saves a new creator (POST) and unsaves a saved one (DELETE)', async () => {
  expect(await toggleSavedCreator({ id: 'b' })).toBe(true);
  expect(axios.post).toHaveBeenCalledWith(URL('b'));
  expect(isCreatorSaved('b')).toBe(true);
  expect(await toggleSavedCreator({ id: 'a' })).toBe(false);
  expect(axios.delete).toHaveBeenCalledWith(URL('a'));
  expect(isCreatorSaved('a')).toBe(false);
});

test('failed save rolls back and shows an error toast', async () => {
  await loadSavedCreators();
  axios.post.mockRejectedValue({ response: { status: 404, data: { detail: 'Creator not found' } } });
  expect(await toggleSavedCreator({ id: 'b' })).toBe(false);
  expect(isCreatorSaved('b')).toBe(false);
  expect(toast.error).toHaveBeenCalledWith('Creator not found');
});

test('failed unsave rolls back; offline gets the offline message', async () => {
  await loadSavedCreators();
  axios.delete.mockRejectedValue(new Error('Network Error'));
  expect(await removeSavedCreator('a')).toBe(true);
  expect(isCreatorSaved('a')).toBe(true);
  expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/offline/i));
});

test('double tap while a request is in flight sends one request', async () => {
  await loadSavedCreators();
  const [r1, r2] = await Promise.all([toggleSavedCreator({ id: 'b' }), toggleSavedCreator({ id: 'b' })]);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(r1).toBe(true);
  expect(r2).toBe(true);
});

test('creator without an id is ignored', async () => {
  expect(await toggleSavedCreator({})).toBe(false);
  expect(axios.post).not.toHaveBeenCalled();
});
