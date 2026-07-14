import AdminUsers from './AdminUsers';

/**
 * "My Users" — the custom/ops admin's scoped view of the user directory.
 *
 * This used to be a separate, much simpler table (amc-*) that looked nothing like the
 * founder's Users page. It now renders the SAME AdminUsers component — identical table,
 * filters, eye/detail drawer and actions — just pointed at the scoped endpoint
 * (/admin/my-assigned) instead of /admin/users. Capability gating inside AdminUsers
 * already hides any action this admin isn't allowed to perform.
 */
export default function AdminMyCreators() {
  return (
    <AdminUsers
      endpoint="/admin/my-assigned"
      heading="My Users"
      subheading="Creators & brands in the categories assigned to you"
    />
  );
}
