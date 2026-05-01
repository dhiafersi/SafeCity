import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Functional HTTP interceptor that attaches the Keycloak Bearer token
 * to every outgoing request directed at secured backend API endpoints.
 * Public endpoints under /api/public/** are intentionally left without
 * an Authorization header so they can be accessed anonymously.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  const isApiRequest = req.url.includes('/api');
  const isPublicEndpoint = req.url.includes('/api/public/');

  if (token && isApiRequest && !isPublicEndpoint) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authReq);
  }

  return next(req);
};

