import type { Metadata } from 'next';
import { AdminConsole } from '../../components/admin/AdminConsole';
import { LoginGate } from '../../components/admin/LoginGate';

export const metadata: Metadata = {
  title: 'admin',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Reached from the terminal with `sudo -i`. There is no link to it anywhere on
 * the public site, and it is excluded from indexing — the password is the only
 * thing protecting it, so it may as well not advertise.
 */
export default function AdminPage() {
  return (
    <LoginGate>
      <AdminConsole />
    </LoginGate>
  );
}
