import axios from 'axios';

export async function loadCreatorDeal(api, target) {
  const [summaries, detail] = await Promise.all([
    axios.get(`${api}/deals/my?summary=true`),
    target ? axios.get(`${api}/deals/${encodeURIComponent(target)}/detail`) : Promise.resolve(null),
  ]);
  const list = Array.isArray(summaries.data) ? summaries.data : [];
  if (detail) return { list, detail: detail.data };
  const first = list[0]?.deal_id;
  return { list, detail: first ? (await axios.get(`${api}/deals/${encodeURIComponent(first)}/detail`)).data : null };
}
