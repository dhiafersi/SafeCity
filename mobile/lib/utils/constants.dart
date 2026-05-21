// Set to `true` when running an Android emulator and you want the app to
// connect to the local host via the emulator's special address.
// For physical phones on the same LAN, keep this `false` and let the app
// auto-discover the backend on the LAN.
const bool kUseLocalEmulator = false;

const String _localHostForAVD = '10.0.2.2';
const String _localHostForDockerDesktop = 'host.docker.internal';

// If you set kUseLocalEmulator to true, update the host below to whichever
// mapping works for your setup (AVD vs physical device vs emulator).
const String _devHost = _localHostForAVD; // change if needed

const String kApiBaseUrl = kUseLocalEmulator
    ? 'http://$_devHost:8081'
    : 'https://api.safecitycnct.duckdns.org';

const String kAuthBaseUrl = kUseLocalEmulator
    ? 'http://$_devHost:8080'
    : 'https://auth.safecitycnct.duckdns.org';

const String kKeycloakTokenUrl = '$kAuthBaseUrl/realms/safecity/protocol/openid-connect/token';
const String kKeycloakClientId = 'safecity-angular';
const String kKeycloakScope = 'openid profile email';
const int kPublicPageSize = 200;
