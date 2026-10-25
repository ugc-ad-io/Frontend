import AppShell from '../shell/AppShell';
import { useAuth } from '../../App';
import { BrandApprovalGate } from '../screens/brand/Signup';

// Same rule as the website's BrandTopNavLayout: a brand that is pending / needs more info / was rejected
// sees the approval screen instead of any feature page.
export default function withBrandGate(Inner) {
  return function BrandGated(props) {
    const { user, logout } = useAuth();
    const status = user?.approval_status;
    const isBrand = ['business', 'brand'].includes(String(user?.role || '').toLowerCase());
    if (isBrand && ['pending', 'more_info', 'rejected'].includes(status)) {
      return (
        <AppShell tabs={false} title="Your brand">
          <BrandApprovalGate status={status} user={user} onLogout={logout} />
        </AppShell>
      );
    }
    return <Inner {...props} />;
  };
}
