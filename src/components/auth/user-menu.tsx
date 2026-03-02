import { Link } from 'react-router-dom';
import { House, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/providers/auth-provider';

function getInitials(value: string | null | undefined) {
  if (!value) {
    return 'DL';
  }

  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function UserMenu() {
  const { isAdmin, profile, signOut, user } = useAuth();
  const displayName = profile?.full_name ?? profile?.username ?? user?.email ?? 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-full border-border/70 bg-background/80 px-2 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.65)]">
          <Avatar className="h-6 w-6">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-20 truncate text-xs sm:block">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          {displayName}
          <div className="mt-1 text-[11px] normal-case tracking-normal text-muted-foreground">{user?.email ?? 'Telegram account'}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/">
            <House className="h-4 w-4" />
            Home
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRound className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/admin/new">
              <ShieldCheck className="h-4 w-4" />
              New post
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            try {
              await signOut();
              toast.success('Signed out.');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Sign-out failed.');
            }
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
