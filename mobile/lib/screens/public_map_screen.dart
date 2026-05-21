import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../models/incident.dart';
import '../models/leaderboard_item.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class PublicMapScreen extends StatelessWidget {
  const PublicMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('SafeCity Live Map', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          if (!auth.isAuthenticated)
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: FilledButton.tonal(
                onPressed: () => Navigator.pushNamed(context, '/login'),
                child: const Text('Login'),
              ),
            ),
        ],
      ),
      drawer: auth.isAuthenticated ? null : _buildPublicDrawer(context, theme),
      body: const PublicMapContent(),
    );
  }

  Widget _buildPublicDrawer(BuildContext context, ThemeData theme) {
    return Drawer(
      child: Column(
        children: [
          DrawerHeader(
            decoration: BoxDecoration(color: theme.colorScheme.primary),
            child: const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.location_city, size: 50, color: Colors.white),
                  SizedBox(height: 10),
                  Text('SafeCity Connect', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('About Project'),
            onTap: () {},
          ),
          ListTile(
            leading: const Icon(Icons.help_outline),
            title: const Text('Help Center'),
            onTap: () {},
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.all(20),
            child: FilledButton(
              onPressed: () => Navigator.pushNamed(context, '/login'),
              style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
              child: const Text('Sign In to Participate'),
            ),
          ),
        ],
      ),
    );
  }
}

class PublicMapContent extends StatefulWidget {
  const PublicMapContent({super.key});

  @override
  State<PublicMapContent> createState() => _PublicMapContentState();
}

class _PublicMapContentState extends State<PublicMapContent> {
  final MapController _mapController = MapController();
  bool _loading = true;
  String? _error;
  List<Incident> _incidents = [];
  List<LeaderboardItem> _leaderboard = [];
  Incident? _selectedIncident;
  int _visibleCount = 0;

  @override
  void initState() {
    super.initState();
    _loadContent();
  }

  Future<void> _loadContent() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiService>();
      final incidents = await api.fetchPublicIncidents();
      final board = await api.fetchLeaderboard();
      setState(() {
        _incidents = incidents;
        _leaderboard = board;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _updateVisibleCount());
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  void _updateVisibleCount() {
    if (!mounted) return;
    final bounds = _mapController.camera.visibleBounds;
    final count = _incidents.where((incident) {
      if (incident.latitude == null || incident.longitude == null) return false;
      return bounds.contains(LatLng(incident.latitude!, incident.longitude!));
    }).length;

    if (_visibleCount != count) {
      setState(() {
        _visibleCount = count;
      });
    }
  }

  void _onMarkerTap(Incident incident) {
    setState(() {
      _selectedIncident = incident;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final mapCenter = _incidents.isNotEmpty
        ? LatLng(_incidents.first.latitude ?? 36.8065, _incidents.first.longitude ?? 10.1815)
        : const LatLng(36.8065, 10.1815);

    return Stack(
      children: [
        Positioned.fill(
          child: FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: mapCenter,
              initialZoom: 12,
              onTap: (_, __) => setState(() => _selectedIncident = null),
              onPositionChanged: (_, __) => _updateVisibleCount(),
            ),
            children: [
              TileLayer(
                urlTemplate: theme.brightness == Brightness.dark 
                  ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                  : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                userAgentPackageName: 'com.example.app_mobile',
                subdomains: const ['a', 'b', 'c', 'd'],
              ),
              MarkerLayer(
                markers: _incidents
                    .where((incident) => incident.latitude != null && incident.longitude != null)
                    .map((incident) {
                  final point = LatLng(incident.latitude!, incident.longitude!);
                  final statusColor = _statusColor(incident.status);
                  return Marker(
                    point: point,
                    width: 38,
                    height: 38,
                    child: GestureDetector(
                      onTap: () => _onMarkerTap(incident),
                      child: Container(
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: [
                            BoxShadow(color: statusColor.withOpacity(0.4), blurRadius: 10, spreadRadius: 1)
                          ],
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          _categoryEmoji(incident.category),
                          style: const TextStyle(fontSize: 16),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),

        // Info Overlay Box
        Positioned(
          top: 16,
          left: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface.withOpacity(0.95),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: theme.dividerColor.withOpacity(0.1)),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 15, offset: const Offset(0, 5))
              ],
            ),
            child: Row(
              children: [
                _buildInfoItem('Visible Reports', '$_visibleCount', theme.colorScheme.primary, theme),
                const Spacer(),
                if (_leaderboard.isNotEmpty)
                  _buildInfoItem('Top Contributor', _leaderboard.first.username, theme.colorScheme.secondary, theme),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.only(left: 12),
                    child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  ),
              ],
            ),
          ),
        ),

        if (_selectedIncident != null)
          Positioned(
            bottom: 16,
            left: 16,
            right: 16,
            child: _buildSelectedIncidentCard(_selectedIncident!, theme),
          ),

        if (_error != null)
          Positioned(
            bottom: 100,
            left: 20,
            right: 20,
            child: Card(
              color: theme.colorScheme.error.withOpacity(0.9),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(_error!, style: const TextStyle(color: Colors.white, fontSize: 13)),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildInfoItem(String label, String value, Color color, ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label.toUpperCase(), style: theme.textTheme.labelSmall?.copyWith(fontSize: 8, letterSpacing: 1.0, color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 4),
        Text(value, style: theme.textTheme.titleMedium?.copyWith(color: color, fontWeight: FontWeight.bold, fontSize: 15)),
      ],
    );
  }

  Widget _buildSelectedIncidentCard(Incident incident, ThemeData theme) {
    return Card(
      elevation: 10,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(incident.title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                ),
                IconButton.filledTonal(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () => setState(() => _selectedIncident = null),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (incident.photoUrl != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.network(
                  incident.photoUrl!,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
              const SizedBox(height: 16),
            ],
            Text(incident.description ?? 'No description.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 20),
            Row(
              children: [
                _buildStatusTag(incident.status, _statusColor(incident.status), theme),
                const SizedBox(width: 10),
                if (incident.category != null) _buildStatusTag(incident.category!, Colors.blueGrey, theme),
              ],
            ),
            if (incident.address != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.location_on_outlined, size: 14, color: theme.colorScheme.primary),
                  const SizedBox(width: 4),
                  Expanded(child: Text(incident.address!, style: theme.textTheme.bodySmall)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusTag(String text, Color color, ThemeData theme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'PENDING': return Colors.orange;
      case 'VALIDATED': return Colors.green;
      case 'RESOLVED': return const Color(0xFF06B6D4);
      default: return Colors.grey;
    }
  }

  String _categoryEmoji(String? category) {
    switch (category) {
      case 'POTHOLE': return '🕳️';
      case 'WATER_LEAK': return '💧';
      case 'BROKEN_STREETLIGHT': return '💡';
      case 'GRAFFITI': return '🎨';
      case 'ILLEGAL_DUMPING': return '🗑️';
      case 'DAMAGED_SIGN': return '🚧';
      case 'FLOODING': return '🌊';
      default: return '❗';
    }
  }
}
