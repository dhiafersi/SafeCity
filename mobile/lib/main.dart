import 'dart:io';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'services/auth_service.dart';
import 'services/api_service.dart';
import 'utils/logging_http_overrides.dart';
import 'utils/constants.dart';
import 'utils/app_config.dart';

void main() {
  // Install a lightweight HttpOverrides implementation so we can see when
  // networking starts in the app (helpful for diagnosing tile 403s).
  HttpOverrides.global = LoggingHttpOverrides();

  // Initialize runtime AppConfig from compile-time constants so discovery
  // can start from the expected base URLs.
  AppConfig.apiBaseUrl = kApiBaseUrl;
  AppConfig.authBaseUrl = kAuthBaseUrl;

  print('[CONFIG] kUseLocalEmulator=$kUseLocalEmulator');
  print('[CONFIG] AppConfig.apiBaseUrl=${AppConfig.apiBaseUrl}');
  print('[CONFIG] AppConfig.keycloakTokenUrl=${AppConfig.keycloakTokenUrl}');

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ProxyProvider<AuthService, ApiService>(
          update: (_, auth, __) => ApiService(auth),
        ),
      ],
      child: const SafeCityApp(),
    ),
  );
}
