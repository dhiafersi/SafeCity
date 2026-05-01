export const environment = {
  production: true,
  apiBaseUrl: '/api',   // Nginx proxies /api → backend container
  keycloak: {
    issuer: 'http://localhost:8080/realms/safecity',
    clientId: 'safecity-angular',
    redirectUri: window.location.origin + '/',
    responseType: 'code',
    scope: 'openid profile email',
    showDebugInformation: false,
    requireHttps: false,
  }
};
