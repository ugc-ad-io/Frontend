import { act } from 'react';
import { createRoot } from 'react-dom/client';
import LegalPage from './LegalPage';
import { LEGAL_DOCS } from './ProfileSettings';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), Link: ({ to, children }) => <a href={to}>{children}</a> }));
jest.mock('axios', () => ({}));
jest.mock('sonner', () => ({ toast: {} }));
jest.mock('../components/CreatorProfileModal', () => () => null);
jest.mock('../components/DashboardLayout', () => () => null);
jest.mock('../components/CreatorTopNavLayout', () => () => null);
jest.mock('../components/BrandTopNavLayout', () => () => null);
jest.mock('../App', () => ({ useAuth: () => ({}) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The routes /terms, /community-guidelines, /cookie-policy, /privacy-policy in App.js use these ids.
test.each(['privacy', 'terms', 'agreement', 'guidelines', 'cookies'])('legal page renders the %s text and a link home', async (id) => {
  const doc = LEGAL_DOCS.find((d) => d.id === id);
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<LegalPage docId={id} />));
    expect(host.querySelector('h1').textContent).toBe(doc.name);
    expect(host.querySelectorAll('section').length).toBe(doc.sections.length);
    expect(host.querySelector('a').getAttribute('href')).toBe('/');
  } finally { await act(async () => root.unmount()); host.remove(); }
});
