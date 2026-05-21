# SafeCity Mobile

This Flutter app is a mobile frontend for SafeCity with public map browsing, incident reporting, citizen dashboards, and admin analytics.

## Setup

1. Install Flutter if you do not already have it:
   - https://flutter.dev/docs/get-started/install

2. Open the mobile folder and get dependencies:

```bash
cd c:\Users\iyed\SafeCity\mobile
flutter pub get
```

3. Configure the API and auth endpoints:
   - The app uses `mobile/lib/utils/constants.dart`.
   - By default the app expects the backend via Caddy at:
     - `https://api.safecitycnct.duckdns.org` for backend APIs
     - `https://auth.safecitycnct.duckdns.org` for Keycloak
   - If you run locally on a device or emulator, replace `kApiBaseUrl` and `kAuthBaseUrl` with your accessible backend/Keycloak URLs.

4. Run on Android or iOS:

```bash
flutter run
```

## Features

- Public map view with live incident markers.
- Login screen using Keycloak password grant.
- Citizen flow: report incidents, view own reports, track points.
- Admin flow: dashboard, incident list, analytics.

## Notes

- The app currently uses a simple username/password login flow.
- On a real device, you may need to supply the proper backend host rather than `localhost`.
- Photo upload works via image picker and sends a multipart request to `/api/incidents`.

## Important

- If you want to use the same public domain as your web version, keep `safecitycnct.duckdns.org` configured and ensure Caddy forwards API/auth routes correctly.
- If the app is unable to contact the backend, update `mobile/lib/utils/constants.dart` to point to the reachable backend URL.
