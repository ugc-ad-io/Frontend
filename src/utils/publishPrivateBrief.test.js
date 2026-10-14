import publishPrivateBrief from './publishPrivateBrief';
test('publishes the existing private draft without creating a second campaign', async () => {
  const client = { patch: jest.fn().mockResolvedValue({}), post: jest.fn().mockResolvedValue({}) };
  await publishPrivateBrief(client, '/api', 'original', { selected_creator: 'creator', visibility: 'private' });
  expect(client.patch).toHaveBeenCalledWith('/api/campaigns/original', expect.objectContaining({ visibility: 'private' }));
  expect(client.post.mock.calls).toEqual([['/api/campaigns/original/submit']]);
});
test('a temporary update failure never creates a duplicate', async () => {
  const client = { patch: jest.fn().mockRejectedValue({ response: { status: 500 } }), post: jest.fn() };
  await expect(publishPrivateBrief(client, '/api', 'original', {})).rejects.toEqual({ response: { status: 500 } });
  expect(client.post).not.toHaveBeenCalled();
});
