import { useRef, useState } from 'react';
import axios from 'axios';
import { useLiveEffect } from './liveUpdates';

export default function useAdminStats(api, userId) {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('loading');
  const controller = useRef(null);
  const load = async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setStatus('loading');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await axios.get(`${api}/admin/stats`, { timeout: 15000, signal: request.signal });
        if (request.signal.aborted) return;
        if (!response.data || typeof response.data !== 'object') throw new Error('Invalid stats response');
        setStats(response.data);
        setStatus('ready');
        return;
      } catch (error) {
        if (request.signal.aborted) return;
        const code = error.response?.status;
        if (attempt === 2 || (code && code < 500 && code !== 429)) break;
      }
    }
    setStatus('error');
  };
  useLiveEffect(() => {
    if (userId) load();
    const recover = () => { if (userId) load(); };
    window.addEventListener('online', recover);
    return () => { controller.current?.abort(); window.removeEventListener('online', recover); };
  }, [userId]);
  return { stats, status, reload: load };
}
