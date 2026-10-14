import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminUsers from './AdminUsers';
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'admin', role: 'admin', admin_role: 'founder' } }) }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));
test.each([
  [[{ id: 'creator', role: 'creator', nickname: 'Arushi', email: 'creator@example.com', profile: {} }]],
  [[null, { id: 'creator', role: 'creator', nickname: 'Arushi', email: 'creator@example.com', profile: { category: ['Fashion', 'Beauty'] } }]],
])('admin users renders the loaded directory without crashing', async (users) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockResolvedValue({ data: users });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try { await act(async () => root.render(<AdminUsers />)); expect(container.textContent).toContain('Arushi'); }
  finally { await act(async () => root.unmount()); container.remove(); }
});
