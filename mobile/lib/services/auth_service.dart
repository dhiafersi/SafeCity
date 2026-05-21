import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';
import '../utils/app_config.dart';

class AuthService extends ChangeNotifier {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  bool isLoading = true;
  bool isAuthenticated = false;
  String? accessToken;
  String? refreshToken;
  String? username;
  List<String> roles = [];

  AuthService() {
    _loadFromStorage();
  }

  Future<void> _loadFromStorage() async {
    accessToken = await _storage.read(key: 'access_token');
    refreshToken = await _storage.read(key: 'refresh_token');
    if (accessToken != null) {
      _decodeToken(accessToken!);
      isAuthenticated = true;
    }
    isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    final uri = Uri.parse(AppConfig.keycloakTokenUrl);
    final response = await http.post(uri, headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    }, body: {
      'grant_type': 'password',
      'client_id': kKeycloakClientId,
      'username': username,
      'password': password,
      'scope': kKeycloakScope,
    });

    if (response.statusCode != 200) {
      return false;
    }

    final payload = json.decode(response.body) as Map<String, dynamic>;
    accessToken = payload['access_token'] as String?;
    refreshToken = payload['refresh_token'] as String?;

    if (accessToken == null) {
      return false;
    }

    await _storage.write(key: 'access_token', value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: 'refresh_token', value: refreshToken);
    }

    _decodeToken(accessToken!);
    isAuthenticated = true;
    notifyListeners();
    return true;
  }

  Future<void> logout() async {
    accessToken = null;
    refreshToken = null;
    username = null;
    roles = [];
    isAuthenticated = false;
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
    notifyListeners();
  }

  bool hasRole(String role) {
    return roles.contains(role.toUpperCase());
  }

  void _decodeToken(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return;
      final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final data = json.decode(payload) as Map<String, dynamic>;
      username = data['preferred_username']?.toString() ?? data['email']?.toString();
      roles = <String>[];
      if (data['realm_access'] is Map) {
        final realmAccess = data['realm_access'] as Map<String, dynamic>;
        if (realmAccess['roles'] is List) {
          roles.addAll((realmAccess['roles'] as List).map((e) => e.toString().toUpperCase()));
        }
      }
      if (data['resource_access'] is Map) {
        final resourceAccess = data['resource_access'] as Map<String, dynamic>;
        for (final entry in resourceAccess.values) {
          if (entry is Map && entry['roles'] is List) {
            roles.addAll((entry['roles'] as List).map((e) => e.toString().toUpperCase()));
          }
        }
      }
      if (data['roles'] is List) {
        roles.addAll((data['roles'] as List).map((e) => e.toString().toUpperCase()));
      }
      roles = roles.toSet().toList();
    } catch (_) {
      username = null;
      roles = [];
    }
  }
}
