import { Injectable } from '@angular/core';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loginStateSubject = new BehaviorSubject<boolean>(false);

  constructor(
    private oauthService: OAuthService,
    private router: Router
  ) {
    // Initialize login state
    this.updateLoginState();

    // Listen to OAuth events
    this.oauthService.events.subscribe(() => {
      this.updateLoginState();
    });
  }

  private updateLoginState(): void {
    const isLoggedIn = this.oauthService.hasValidAccessToken();
    this.loginStateSubject.next(isLoggedIn);
  }

  get loginState$(): Observable<boolean> {
    return this.loginStateSubject.asObservable();
  }

  async initAuth(): Promise<void> {
    const authConfig: AuthConfig = {
      issuer:              environment.keycloak.issuer,
      clientId:            environment.keycloak.clientId,
      redirectUri:         environment.keycloak.redirectUri,
      responseType:        environment.keycloak.responseType,
      scope:               environment.keycloak.scope,
      showDebugInformation: environment.keycloak.showDebugInformation,
      requireHttps:        environment.keycloak.requireHttps,
      // PKCE (recommended for public clients)
      useSilentRefresh:    false,
      sessionChecksEnabled: false,
    };

    this.oauthService.configure(authConfig);
    this.oauthService.setupAutomaticSilentRefresh();

    await this.oauthService.loadDiscoveryDocumentAndTryLogin();
  }

  login(): void {
    this.router.navigate(['/login']);
  }

  async loginWithPassword(username: string, password: string): Promise<void> {
    const oauth = this.oauthService as OAuthService & { oidc: boolean };
    const previousOidc = oauth.oidc;

    try {
      // Password grant tokens are not returned from a nonce-backed browser redirect.
      oauth.oidc = false;
      await this.oauthService.fetchTokenUsingPasswordFlow(username, password);
    } finally {
      oauth.oidc = previousOidc;
    }

    this.updateLoginState();
  }

  loginWithIdentityProvider(provider: string): void {
    this.oauthService.initCodeFlow('', { kc_idp_hint: provider });
  }

  logout(): void {
    this.oauthService.logOut(true);
    this.updateLoginState();
    this.router.navigate(['/']);
  }

  isLoggedIn(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  getAccessToken(): string {
    return this.oauthService.getAccessToken();
  }

  getIdentityClaims(): Record<string, any> {
    const identityClaims = this.oauthService.getIdentityClaims() as Record<string, any>;
    if (identityClaims && Object.keys(identityClaims).length > 0) {
      return identityClaims;
    }

    return this.decodeJwtPayload(this.oauthService.getAccessToken());
  }

  getUsername(): string {
    const claims = this.getIdentityClaims();
    return claims?.['preferred_username'] ?? '';
  }

  getRoles(): string[] {
    const claims = this.getIdentityClaims();
    return (claims?.['roles'] as string[]) ?? [];
  }

  hasRole(role: string): boolean {
    return this.getRoles().includes(role);
  }

  private decodeJwtPayload(token: string): Record<string, any> {
    if (!token) return {};

    try {
      const payload = token.split('.')[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
      return JSON.parse(atob(padded));
    } catch {
      return {};
    }
  }
}
