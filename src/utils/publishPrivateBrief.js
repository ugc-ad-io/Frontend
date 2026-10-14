export default async function publishPrivateBrief(client, api, draftId, payload) {
  if (draftId) {
    try {
      await client.patch(`${api}/campaigns/${draftId}`, payload);
    } catch (error) {
      const status = error?.response?.status;
      if (status !== 403 && status !== 404) throw error;
      await client.post(`${api}/campaigns`, { ...payload, status: 'pending_approval' });
      return;
    }
    await client.post(`${api}/campaigns/${draftId}/submit`);
    return;
  }
  await client.post(`${api}/campaigns`, { ...payload, status: 'pending_approval' });
}
