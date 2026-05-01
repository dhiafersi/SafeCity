import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Guard: checks the user has at least one of the required roles.
 * Expected route data: { roles: ['CITIZEN'] } or { roles: ['ADMIN'] }
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const authService   = inject(AuthService);
  const router        = inject(Router);
  const requiredRoles = (route.data?.['roles'] ?? []) as string[];

  if (requiredRoles.length === 0) return true;

  const hasRole = requiredRoles.some(r => authService.hasRole(r));
  if (hasRole) return true;

  router.navigate(['/unauthorized']);
  return false;
};
