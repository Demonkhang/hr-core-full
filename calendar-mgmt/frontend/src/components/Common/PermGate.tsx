import { useAuthStore } from '@/store/authStore';

interface PermGateProps {
  perms: string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermGate({ perms, requireAll = false, children, fallback = null }: PermGateProps) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <>{fallback}</>;
  if (user.is_super_admin) return <>{children}</>;
  const p = user.permissions ?? {};
  const has = requireAll
    ? perms.every((k) => (p as any)[k] === true)
    : perms.some((k) => (p as any)[k] === true);
  return has ? <>{children}</> : <>{fallback}</>;
}
