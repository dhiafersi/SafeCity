import { Injectable } from '@angular/core';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(
    private oauthService: OAuthService,
    private router: Router
  ) {}

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
    this.oauthService.initCodeFlow();
  }

  logout(): void {
    this.oauthService.logOut();
  }

  isLoggedIn(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  getAccessToken(): string {
    return this.oauthService.getAccessToken();
  }

  getIdentityClaims(): Record<string, any> {
    return this.oauthService.getIdentityClaims() as Record<string, any>;
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
}
