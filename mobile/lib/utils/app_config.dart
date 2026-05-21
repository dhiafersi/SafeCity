class AppConfig {
  /// Runtime-configurable API base URL. Initialized from constants but may
  /// be overridden at runtime by discovery logic.
  static String apiBaseUrl = 'https://api.safecitycnct.duckdns.org';
  static String authBaseUrl = 'https://auth.safecitycnct.duckdns.org';

  // Optional AI autofill endpoint and API key. Leave empty to use client-side fallback.
  static String aiEndpoint = '';
  static String aiApiKey = '';

  static String get keycloakTokenUrl => '$authBaseUrl/realms/safecity/protocol/openid-connect/token';
}
