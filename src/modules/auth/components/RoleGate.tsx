import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import type { UserRole } from '../../../shared/types';

interface Props {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  redirectTo?: string;
}

export function RoleGate({ allowedRoles, children, redirectTo }: Props) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) {
    const fallback = redirectTo || defaultHomeForRole(user.role);
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

export function defaultHomeForRole(role: UserRole): string {
  if (role === 'VENDEDOR' || role === 'VENDEDOR_CAMPO') return '/pos';
  return '/dashboard';
}
