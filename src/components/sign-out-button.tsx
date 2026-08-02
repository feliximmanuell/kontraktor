import { signOut } from '@/lib/actions/auth';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm" className={className}>
        <LogOut />
        Keluar
      </Button>
    </form>
  );
}
