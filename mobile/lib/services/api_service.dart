import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

import '../models/analytics_data.dart';
import '../models/admin_summary.dart';
import '../models/citizen_points.dart';
import '../models/heatmap_point.dart';
import '../models/incident.dart';
import '../models/leaderboard_item.dart';
import '../services/auth_service.dart';
import '../utils/constants.dart';
import '../utils/app_config.dart';
import 'package:network_info_plus/network_info_plus.dart';

class ApiService {
  final AuthService authService;

  late final Future<void> _discoveryFuture;
  bool _discoveryStarted = false;

  ApiService(this.authService) {
    // Start discovery in background so the app can auto-find a LAN backend.
    _discoveryStarted = true;
    _discoveryFuture = discoverLocalBackend();
  }

  /// Current base URL used by this service. Initialized from AppConfig but
  /// may be updated via discovery on first run.
  String _baseUrl = AppConfig.apiBaseUrl;

  String _authBaseUrl = AppConfig.authBaseUrl;

  Future<void> _ensureDiscovery() async {
    if (!_discoveryStarted) {
      _discoveryStarted = true;
      _discoveryFuture = discoverLocalBackend();
    }
    await _discoveryFuture;
  }

  /// Attempt to discover a backend on the local LAN when running on a device.
  /// This is best-effort and runs asynchronously; it will update the
  /// `_baseUrl` and AppConfig if a responsive local server is found.
  Future<void> discoverLocalBackend() async {
    try {
      _log('Starting local LAN discovery for backend');

      // If developer explicitly requested local emulator, skip discovery.
      if (kUseLocalEmulator) {
        _log('kUseLocalEmulator true, using $_baseUrl');
        AppConfig.apiBaseUrl = _baseUrl;
        AppConfig.authBaseUrl = _authBaseUrl;
        return;
      }

      final info = NetworkInfo();
      final wifiIp = await info.getWifiIP();
      _log('Device wifi IP: $wifiIp');
      final candidates = <String>[];

      if (wifiIp != null && wifiIp.isNotEmpty) {
        final parts = wifiIp.split('.');
        if (parts.length == 4) {
          final prefix = '${parts[0]}.${parts[1]}.${parts[2]}.';
          for (var i = 1; i <= 254; i++) {
            candidates.add('$prefix$i');
          }
        }
      }

      // common hostnames that might point to the host machine
      candidates.add('host.docker.internal');

      // Try each candidate in small concurrent batches to find a responsive
      // backend on port 8081.
      const int batchSize = 20;
      for (var s = 0; s < candidates.length; s += batchSize) {
        final batch = candidates.skip(s).take(batchSize).toList();
        _log('Probing batch starting with ${batch.first}');
        final futures = batch.map((host) async {
          final url = Uri.parse('http://$host:8081/api/public/incidents');
          try {
            final client = HttpClient();
            client.connectionTimeout = const Duration(seconds: 2);
            final req = await client.openUrl('HEAD', url);
            final resp = await req.close().timeout(const Duration(seconds: 2));
            final code = resp.statusCode;
            client.close(force: true);
            if (code >= 200 && code < 500) {
              _log('Found responsive backend at http://$host:8081 (status $code)');
              return host;
            }
          } catch (_) {
            // ignore
          }
          return null;
        }).toList();

        final results = await Future.wait(futures);
        final found = results.firstWhere((r) => r != null, orElse: () => null);
        if (found != null) {
          _baseUrl = 'http://$found:8081';
          _authBaseUrl = 'http://$found:8080';
          AppConfig.apiBaseUrl = _baseUrl;
          AppConfig.authBaseUrl = _authBaseUrl;
          _log('Discovery complete. Using $_baseUrl and $_authBaseUrl');
          return;
        }
      }

      _log('No local backend discovered; falling back to default $_baseUrl');
    } catch (e) {
      _log('Discovery error: $e');
    }
  }

  void _log(String msg) {
    // keep logs concise and visible in the terminal
    print('[API] $msg');
  }

  Map<String, String> get _defaultHeaders {
    final headers = <String, String>{
      'Accept': 'application/json',
    };
    if (authService.isAuthenticated && authService.accessToken != null) {
      headers['Authorization'] = 'Bearer ${authService.accessToken}';
    }
    return headers;
  }

  Uri _buildUri(String path, [Map<String, String>? queryParameters]) {
    return Uri.parse('$_baseUrl$path').replace(queryParameters: queryParameters);
  }

  Future<List<Incident>> fetchPublicIncidents() async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/public/incidents', {'page': '0', 'size': kPublicPageSize.toString()});
    _log('Fetching public incidents: GET $uri');
    _log('Request headers: ${_defaultHeaders}');
    final response = await http.get(uri, headers: _defaultHeaders);
    _log('Received ${response.statusCode} from $uri');
    if (response.statusCode != 200) {
      _log('Error body: ${response.body}');
      throw Exception('Failed to load public incidents (${response.statusCode})');
    }
    final jsonBody = json.decode(response.body) as Map<String, dynamic>;
    final page = PageResult.fromJson(jsonBody, (item) => Incident.fromJson(item));
    _log('Parsed ${page.content.length} incidents');
    return page.content;
  }

  Future<List<LeaderboardItem>> fetchLeaderboard() async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/public/leaderboard');
    _log('Fetching leaderboard: GET $uri');
    final response = await http.get(uri, headers: _defaultHeaders);
    _log('Received ${response.statusCode} from $uri');
    if (response.statusCode != 200) {
      _log('Error body: ${response.body}');
      throw Exception('Failed to load leaderboard (${response.statusCode})');
    }
    final jsonBody = json.decode(response.body) as List<dynamic>;
    _log('Parsed ${jsonBody.length} leaderboard items');
    return jsonBody.map((item) => LeaderboardItem.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<List<Incident>> fetchMyIncidents() async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/incidents/my', {'page': '0', 'size': '50'});
    final response = await http.get(uri, headers: _defaultHeaders);
    if (response.statusCode != 200) {
      throw Exception('Failed to load your incidents');
    }
    final jsonBody = json.decode(response.body) as Map<String, dynamic>;
    final page = PageResult.fromJson(jsonBody, (item) => Incident.fromJson(item));
    return page.content;
  }

  Future<CitizenPoints> fetchMyPoints() async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/gamification/points');
    final response = await http.get(uri, headers: _defaultHeaders);
    if (response.statusCode != 200) {
      throw Exception('Failed to load your points');
    }
    final jsonBody = json.decode(response.body) as Map<String, dynamic>;
    return CitizenPoints.fromJson(jsonBody);
  }

  Future<Incident> createIncident({
    required String title,
    String? description,
    String? category,
    double? latitude,
    double? longitude,
    String? address,
    XFile? photo,
  }) async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/incidents');
    _log('Creating incident POST $uri');
    final request = http.MultipartRequest('POST', uri);
    request.headers.addAll(_defaultHeaders);

    final data = <String, dynamic>{
      'title': title,
      if (description != null && description.isNotEmpty) 'description': description,
      if (category != null && category.isNotEmpty) 'category': category,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (address != null && address.isNotEmpty) 'address': address,
    };

    request.files.add(
      http.MultipartFile.fromString(
        'data',
        json.encode(data),
        contentType: MediaType('application', 'json'),
      ),
    );

    if (photo != null) {
      final file = await http.MultipartFile.fromPath('photo', photo.path, contentType: MediaType('image', photo.path.split('.').last));
      request.files.add(file);
    }

    _log('Sending multipart request with fields: ${request.fields.keys.toList()} and files: ${request.files.map((f) => f.filename).toList()}');
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    _log('Received ${response.statusCode} from incident creation');
    if (response.statusCode != 201) {
      _log('Error body: ${response.body}');
      throw Exception('Incident creation failed: ${response.body}');
    }
    final jsonBody = json.decode(response.body) as Map<String, dynamic>;
    return Incident.fromJson(jsonBody);
  }

  Future<List<Incident>> fetchAdminIncidents() async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/incidents', {'page': '0', 'size': '50'});
    _log('Fetching admin incidents: GET $uri');
    final response = await http.get(uri, headers: _defaultHeaders);
    _log('Received ${response.statusCode} from $uri');
    if (response.statusCode != 200) {
      _log('Error body: ${response.body}');
      throw Exception('Failed to load incidents (${response.statusCode})');
    }
    final jsonBody = json.decode(response.body) as Map<String, dynamic>;
    final page = PageResult.fromJson(jsonBody, (item) => Incident.fromJson(item));
    _log('Parsed ${page.content.length} admin incidents');
    return page.content;
  }

  Future<Incident> updateIncidentStatus(int id, String status) async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/incidents/$id/status');
    final body = json.encode({'status': status});
    _log('Updating incident status: PATCH $uri');
    final response = await http.patch(
      uri,
      headers: {
        ..._defaultHeaders,
        'Content-Type': 'application/json',
      },
      body: body,
    );
    _log('Received ${response.statusCode} from $uri');
    if (response.statusCode != 200) {
      _log('Error body: ${response.body}');
      throw Exception('Failed to update incident status (${response.statusCode})');
    }
    return Incident.fromJson(json.decode(response.body) as Map<String, dynamic>);
  }

  Future<void> deleteIncident(int id) async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/incidents/$id');
    _log('Deleting incident: DELETE $uri');
    final response = await http.delete(uri, headers: _defaultHeaders);
    _log('Received ${response.statusCode} from $uri');
    if (response.statusCode != 200 && response.statusCode != 204) {
      _log('Error body: ${response.body}');
      throw Exception('Failed to delete incident (${response.statusCode})');
    }
  }

  Future<AdminSummary> fetchAdminSummary() async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/admin/stats/summary');
    _log('Fetching admin summary: GET $uri');
    final response = await http.get(uri, headers: _defaultHeaders);
    _log('Received ${response.statusCode} from $uri');
    if (response.statusCode != 200) {
      _log('Error body: ${response.body}');
      throw Exception('Failed to load admin summary (${response.statusCode})');
    }
    final jsonBody = json.decode(response.body) as Map<String, dynamic>;
    return AdminSummary.fromJson(jsonBody);
  }

  Future<List<HeatmapPoint>> fetchAdminHeatmap() async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/admin/heatmap');
    _log('Fetching admin heatmap: GET $uri');
    final response = await http.get(uri, headers: _defaultHeaders);
    _log('Received ${response.statusCode} from $uri');
    if (response.statusCode != 200) {
      _log('Error body: ${response.body}');
      throw Exception('Failed to load heatmap data (${response.statusCode})');
    }
    final jsonBody = json.decode(response.body) as List<dynamic>;
    return jsonBody
        .map((item) => HeatmapPoint.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<AnalyticsData> fetchAnalytics() async {
    await _ensureDiscovery();
    final uri = _buildUri('/api/admin/analytics');
    _log('Fetching analytics: GET $uri');
    final response = await http.get(uri, headers: _defaultHeaders);
    _log('Received ${response.statusCode} from $uri');
    if (response.statusCode != 200) {
      _log('Error body: ${response.body}');
      throw Exception('Failed to load analytics (${response.statusCode})');
    }
    final jsonBody = json.decode(response.body) as Map<String, dynamic>;
    return AnalyticsData.fromJson(jsonBody);
  }

  /// Ask an AI service (optional) to suggest a description and category for
  /// an incident based on address/coords and optionally a photo. If no AI
  /// endpoint is configured, return a lightweight client-side suggestion.
  Future<Map<String, dynamic>> analyzeIncidentImage(XFile photo, {String? address, double? latitude, double? longitude}) async {
    await _ensureDiscovery();

    final file = await http.MultipartFile.fromPath(
      'image',
      photo.path,
      contentType: MediaType('image', photo.path.split('.').last),
    );

    if (AppConfig.aiEndpoint.isNotEmpty) {
      try {
        final uri = Uri.parse(AppConfig.aiEndpoint);
        final request = http.MultipartRequest('POST', uri);
        if (AppConfig.aiApiKey.isNotEmpty) {
          request.headers['Authorization'] = 'Bearer ${AppConfig.aiApiKey}';
        }
        request.files.add(file);
        if (address != null) request.fields['address'] = address;
        if (latitude != null) request.fields['latitude'] = latitude.toString();
        if (longitude != null) request.fields['longitude'] = longitude.toString();

        _log('Requesting custom AI image analysis from $uri');
        final streamed = await request.send().timeout(const Duration(seconds: 20));
        final response = await http.Response.fromStream(streamed);
        _log('Custom AI image analysis responded ${response.statusCode}');
        if (response.statusCode == 200) {
          final body = json.decode(response.body) as Map<String, dynamic>;
          return {
            'category': body['category']?.toString() ?? 'OTHER',
            'confidence': body['confidence'] is num ? (body['confidence'] as num).toDouble() : null,
          };
        }
      } catch (e) {
        _log('Custom AI image analysis error: $e');
      }
    }

    try {
      final uri = _buildUri('/api/ai/analyze');
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(_defaultHeaders);
      request.files.add(file);
      _log('Requesting backend AI image analysis from $uri');
      final streamed = await request.send().timeout(const Duration(seconds: 20));
      final response = await http.Response.fromStream(streamed);
      _log('Backend AI image analysis responded ${response.statusCode}');
      if (response.statusCode == 200) {
        final body = json.decode(response.body) as Map<String, dynamic>;
        return {
          'category': body['category']?.toString() ?? 'OTHER',
          'confidence': body['confidence'] is num ? (body['confidence'] as num).toDouble() : null,
        };
      }
    } catch (e) {
      _log('Backend AI image analysis error: $e');
    }

    return {'category': 'OTHER', 'confidence': 0.0};
  }

  Future<String> generateDescription(String category, double? confidence) async {
    await _ensureDiscovery();
    try {
      final uri = _buildUri('/api/ai/describe');
      final response = await http.post(
        uri,
        headers: {
          ..._defaultHeaders,
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'category': category,
          'confidence': confidence,
        }),
      ).timeout(const Duration(seconds: 15));

      _log('AI description responded ${response.statusCode}');
      if (response.statusCode == 200) {
        final body = json.decode(response.body) as Map<String, dynamic>;
        return body['description']?.toString() ?? '';
      }
    } catch (e) {
      _log('AI description error: $e');
    }

    return 'Reported issue in ${category.toLowerCase().replaceAll('_', ' ')}. Please verify details and location.';
  }

  Future<Map<String, String>> autofillIncident({String? address, double? latitude, double? longitude, XFile? photo}) async {
    await _ensureDiscovery();

    if (photo != null) {
      final analysis = await analyzeIncidentImage(photo, address: address, latitude: latitude, longitude: longitude);
      final category = (analysis['category'] as String?)?.isNotEmpty == true ? analysis['category'] as String : 'OTHER';
      final confidence = analysis['confidence'] is num ? (analysis['confidence'] as num).toDouble() : null;
      final description = await generateDescription(category, confidence);
      return {'description': description, 'category': category};
    }

    // Use configured AI endpoint if provided.
    if (AppConfig.aiEndpoint.isNotEmpty) {
      try {
        final uri = Uri.parse(AppConfig.aiEndpoint);
        final payload = <String, dynamic>{
          'address': address,
          'latitude': latitude,
          'longitude': longitude,
        };
        if (photo != null) payload['photoFilename'] = photo.name;

        final headers = <String, String>{'Content-Type': 'application/json'};
        if (AppConfig.aiApiKey.isNotEmpty) headers['Authorization'] = 'Bearer ${AppConfig.aiApiKey}';

        _log('Requesting AI autofill from $uri');
        final resp = await http.post(uri, headers: headers, body: json.encode(payload)).timeout(const Duration(seconds: 10));
        _log('AI autofill responded ${resp.statusCode}');
        if (resp.statusCode == 200) {
          final body = json.decode(resp.body) as Map<String, dynamic>;
          final description = (body['description'] ?? '') as String;
          final category = (body['category'] ?? '') as String;
          return {'description': description, 'category': category};
        }
      } catch (e) {
        _log('AI autofill error: $e');
      }
    }

    // Fallback heuristic: simple rules based on address text or proximity.
    final lower = (address ?? '').toLowerCase();
    String suggestedCategory = 'OTHER';
    if (lower.contains('pothole') || lower.contains('road') || lower.contains('street')) suggestedCategory = 'POTHOLE';
    else if (lower.contains('water') || lower.contains('leak')) suggestedCategory = 'WATER_LEAK';
    else if (lower.contains('light') || lower.contains('lamp')) suggestedCategory = 'BROKEN_STREETLIGHT';
    else if (lower.contains('graffiti')) suggestedCategory = 'GRAFFITI';
    else if (lower.contains('dump') || lower.contains('trash') || lower.contains('garbage')) suggestedCategory = 'ILLEGAL_DUMPING';
    else if (lower.contains('sign') || lower.contains('signal')) suggestedCategory = 'DAMAGED_SIGN';
    else if (lower.contains('flood') || lower.contains('flooding')) suggestedCategory = 'FLOODING';

    final descAddr = address != null && address.isNotEmpty ? ' near $address' : '';
    final description = 'Reported incident$descAddr. Please verify the exact location and details.';
    return {'description': description, 'category': suggestedCategory};
  }
}
