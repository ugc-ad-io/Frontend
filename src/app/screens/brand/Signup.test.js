import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import BrandSignup, { BrandApprovalGate } from './Signup';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useLocation: () => ({ pathname: '/profile-setup/business' }) }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
const mockSetUser = jest.fn();
jest.mock('../../../App', () => ({ useAuth: () => ({ user: { id: 'b1', role: 'business', email: 'g@x.co' }, setUser: mockSetUser, logout: jest.fn() }) }));

const setVal = (el, v) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const mount = async (ui) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return { container, unmount: () => act(async () => { root.unmount(); container.remove(); }) };
};

test('brand details: required fields block submit; valid form PUTs /profile/business and shows Under review', async () => {
  axios.get.mockResolvedValue({ data: {} });
  axios.post.mockResolvedValue({ data: { valid: true } });
  axios.put.mockResolvedValue({ data: { approval_status: 'pending' } });
  const { container, unmount } = await mount(<BrandSignup />);
  const submit = () => click(container.querySelector('[data-testid="submit-profile-btn"]'));
  await submit();
  expect(axios.put).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Business name is required.');
  await act(async () => {
    setVal(container.querySelector('#bp-name'), 'Glow Labs');
    setVal(container.querySelector('#bp-web'), 'glowlabs.in');
    setVal(container.querySelector('#bp-phone'), '98765 43210');
    setVal(container.querySelector('#bp-country'), 'India');
  });
  await submit();
  expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/profile/business'), expect.objectContaining({
    business_name: 'Glow Labs', website: 'https://glowlabs.in', phone: '+91 98765 43210', country: 'India', business_description: '', product_type: '',
  }));
  expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ profile_completed: true, approval_status: 'pending' }));
  expect(container.querySelector('[data-testid="gate-pending"]')).not.toBeNull();
  await unmount();
});

test('approval gates: more-info lists the admin items, rejected shows the reason', async () => {
  const a = await mount(<BrandApprovalGate status="more_info" user={{ review: { more_info_message: 'Add GSTIN', more_info_items: ['GSTIN'] } }} />);
  expect(a.container.textContent).toContain('Add GSTIN');
  expect(a.container.textContent).toContain('Update my details');
  await a.unmount();
  const b = await mount(<BrandApprovalGate status="rejected" user={{ review: { reason_code: 'duplicate_account', reason_details: 'Seen before' } }} />);
  expect(b.container.textContent).toContain('Duplicate account');
  expect(b.container.textContent).toContain('Seen before');
  await b.unmount();
});
