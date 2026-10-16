import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminFlaggedMessages from './AdminFlaggedMessages';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const chats = [{
  conversation_id: 'u1_u2', user1: { id: 'u1', nickname: 'Arushi' }, user2: { id: 'u2', nickname: 'Glow Labs' },
  last_message: 'hi', last_message_at: '2026-10-01T10:00:00Z', has_violations: true, violation_count: 1, report_count: 0,
}];
const messages = [
  { sender_id: 'u2', sender_nickname: 'Glow Labs', message: 'Welcome aboard', timestamp: '2026-10-01T09:00:00Z' },
  { sender_id: 'u1', sender_nickname: 'Arushi', message: 'call me on 9876543210', timestamp: '2026-10-01T10:00:00Z',
    filtered: true, blocked: true, violations: [{ type: 'phone', content: ['9876543210'] }] },
];

test('phone chat oversight: card opens the conversation, escalate sheet posts once, back closes', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({
    data: url.includes('/admin/chats') ? chats : url.includes('/admin/chat/') ? messages : [],
  }));
  axios.post.mockResolvedValue({ data: {} });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<AdminFlaggedMessages />));
    const card = container.querySelector('[data-testid="flagged-chat-0"]');
    expect(card.textContent).toContain('Arushi ↔ Glow Labs');
    expect(card.textContent).toContain('1 flagged');

    await click(card);
    const detail = container.querySelector('[data-testid="chat-detail"]');
    expect(detail.textContent).toContain('Welcome aboard');
    const flagged = container.querySelector('[data-testid="flagged-msg-1"]');
    expect(flagged.textContent).toContain('Arushi → Glow Labs');
    expect(flagged.querySelector('mark').textContent).toBe('9876543210');
    expect(flagged.textContent).toContain('phone');

    await click(container.querySelector('[data-testid="escalate-1"]'));
    const sheet = container.querySelector('[data-testid="escalate-choice-1"]');
    await click([...sheet.querySelectorAll('button')].find((b) => b.textContent.includes('Suspend user')));
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/message/moderate'),
      expect.objectContaining({ user1Id: 'u1', user2Id: 'u2', action: 'escalate', escalation: 'suspend' }));
    expect(container.querySelector('[data-testid="escalate-choice-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="resolution-1"]').textContent).toContain('suspended');
    expect(container.querySelector('[data-testid="approve-1"]')).toBeNull(); // no second post possible

    await click(container.querySelector('[data-testid="back-to-flagged"]'));
    expect(container.querySelector('[data-testid="chat-detail"]')).toBeNull();
    expect(container.querySelector('[data-testid="flagged-chat-0"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
