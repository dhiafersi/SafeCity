import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../models/admin_summary.dart';
import '../models/heatmap_point.dart';
import '../models/incident.dart';
import '../services/api_service.dart';
import '../widgets/incident_details_dialog.dart';

class AdminDashboardScreen extends StatefulWidget {
  final VoidCallback? onNavigateToIncidents;
  const AdminDashboardScreen({super.key, this.onNavigateToIncidents});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  bool _loading = true;
  String? _error;
  AdminSummary? _summary;
  List<Incident> _incidents = [];
  List<HeatmapPoint> _heatmapPoints = [];
  bool _showHeatmap = false;
  String? _statusFilter;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiService>();
      final summary = await api.fetchAdminSummary();
      final incidents = await api.fetchAdminIncidents();
      final heatmapPoints = await api.fetchAdminHeatmap();
      setState(() {
        _summary = summary;
        _incidents = incidents;
        _heatmapPoints = heatmapPoints;
      });
    } catch (err) {
      setState(() => _error = err.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final totalIncidents = _incidents.length;
    final pendingCount = _incidents.where((i) => i.status == 'PENDING').length;
    final validatedCount = _incidents.where((i) => i.status == 'VALIDATED').length;
    final resolvedCount = _incidents.where((i) => i.status == 'RESOLVED').length;

    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeaderCard(theme),
          const SizedBox(height: 20),
          _buildStatGrid(totalIncidents, pendingCount, validatedCount, resolvedCount, theme),
          const SizedBox(height: 20),
          _buildMapCard(theme),
          const SizedBox(height: 20),
          _buildLegendCard(theme),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildHeaderCard(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.analytics, color: theme.colorScheme.primary),
                const SizedBox(width: 10),
                Text(
                  'Incident Overview',
                  style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Real-time urban incidents with predictive heatmap overlay.',
              style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 20),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.icon(
                  onPressed: _loadSummary,
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Refresh'),
                ),
                OutlinedButton.icon(
                  onPressed: widget.onNavigateToIncidents,
                  icon: const Icon(Icons.list_alt, size: 18),
                  label: const Text('Manage Reports'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatGrid(int total, int pending, int validated, int resolved, ThemeData theme) {
    return LayoutBuilder(builder: (context, constraints) {
      final itemWidth = (constraints.maxWidth - 12) / 2;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          SizedBox(width: itemWidth, child: _buildStatCard('Total Reports', total.toString(), theme.colorScheme.primary, theme)),
          SizedBox(width: itemWidth, child: _buildStatCard('Pending', pending.toString(), Colors.orange, theme)),
          SizedBox(width: itemWidth, child: _buildStatCard('Validated', validated.toString(), Colors.green, theme)),
          SizedBox(width: itemWidth, child: _buildStatCard('Resolved', resolved.toString(), theme.colorScheme.secondary, theme)),
        ],
      );
    });
  }

  Widget _buildMapCard(ThemeData theme) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Incident Map', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                _buildMapFilters(theme),
              ],
            ),
          ),
          SizedBox(
            height: 350,
            child: FlutterMap(
              options: MapOptions(
                initialCenter: _incidents.isNotEmpty ? LatLng(_incidents.first.latitude ?? 36.8065, _incidents.first.longitude ?? 10.1815) : const LatLng(36.8065, 10.1815),
                initialZoom: 12,
              ),
              children: [
                TileLayer(
                  urlTemplate: theme.brightness == Brightness.dark 
                    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                  userAgentPackageName: 'com.example.app_mobile',
                  subdomains: const ['a', 'b', 'c', 'd'],
                ),
                if (_showHeatmap)
                  CircleLayer(
                    circles: _heatmapPoints
                        .map((point) => CircleMarker(
                              point: LatLng(point.latitude, point.longitude),
                              color: Colors.red.withOpacity(0.2),
                              radius: 20 + point.count.toDouble() * 3,
                              borderStrokeWidth: 0,
                            ))
                        .toList(),
                  ),
                MarkerLayer(
                  markers: _visibleIncidents
                      .where((incident) => incident.latitude != null && incident.longitude != null)
                      .map((incident) {
                    final statusColor = _statusColor(incident.status);
                    return Marker(
                      point: LatLng(incident.latitude!, incident.longitude!),
                      width: 32,
                      height: 32,
                      child: GestureDetector(
                        onTap: () => showIncidentDetailsDialog(context, incident),
                        child: Container(
                          decoration: BoxDecoration(
                            color: statusColor,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                            boxShadow: [BoxShadow(color: statusColor.withOpacity(0.4), blurRadius: 6, spreadRadius: 1)],
                          ),
                          alignment: Alignment.center,
                          child: Text(_categoryEmoji(incident.category), style: const TextStyle(fontSize: 14)),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapFilters(ThemeData theme) {
    return Row(
      children: [
        DropdownButton<String?>(
          value: _statusFilter,
          dropdownColor: theme.colorScheme.surface,
          style: theme.textTheme.bodySmall,
          isDense: true,
          underline: const SizedBox(),
          items: <String?>[null, 'PENDING', 'VALIDATED', 'RESOLVED']
              .map((value) => DropdownMenuItem<String?>(
                    value: value,
                    child: Text(value == null ? 'All Status' : value),
                  ))
              .toList(),
          onChanged: (String? value) => setState(() => _statusFilter = value),
        ),
        const SizedBox(width: 8),
        IconButton(
          onPressed: _toggleHeatmap,
          icon: Icon(Icons.whatshot, size: 20, color: _showHeatmap ? Colors.red : theme.colorScheme.onSurfaceVariant),
          tooltip: 'Toggle Heatmap',
        ),
      ],
    );
  }

  Widget _buildLegendCard(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          spacing: 20,
          runSpacing: 10,
          children: [
            _buildLegendItem(Colors.orange, 'Pending'),
            _buildLegendItem(Colors.green, 'Validated'),
            _buildLegendItem(theme.colorScheme.secondary, 'Resolved'),
            _buildLegendItem(Colors.red.withOpacity(0.4), 'Heatmap'),
          ],
        ),
      ),
    );
  }

  List<Incident> get _visibleIncidents {
    if (_statusFilter == null) return _incidents;
    return _incidents.where((incident) => incident.status == _statusFilter).toList();
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

  void _toggleHeatmap() => setState(() => _showHeatmap = !_showHeatmap);

  Widget _buildStatCard(String label, String value, Color color, ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 8),
          Text(value, style: theme.textTheme.headlineSmall?.copyWith(color: color, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(text, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}
