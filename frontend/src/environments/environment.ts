export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8081',
  keycloak: {
    issuer: 'http://localhost:8080/realms/safecity',
    clientId: 'safecity-angular',
    redirectUri: window.location.origin + '/callback',
    responseType: 'code',
    scope: 'openid profile email',
    showDebugInformation: true,
    requireHttps: false,
  }
};
