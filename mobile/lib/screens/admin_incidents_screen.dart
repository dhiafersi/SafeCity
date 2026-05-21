import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../models/incident.dart';
import '../services/api_service.dart';
import '../widgets/incident_details_dialog.dart';

class AdminIncidentsScreen extends StatefulWidget {
  const AdminIncidentsScreen({super.key});

  @override
  State<AdminIncidentsScreen> createState() => _AdminIncidentsScreenState();
}

class _AdminIncidentsScreenState extends State<AdminIncidentsScreen> {
  bool _loading = true;
  String? _error;
  List<Incident> _incidents = [];
  List<Incident> _filteredIncidents = [];
  String _filterStatus = '';
  String _filterGovernorate = '';
  String _filterDelegation = '';
  List<String> _governorates = [];
  List<String> _delegations = [];
  int? _updatingIncidentId;
  final Map<String, Map<String, String?>> _locationCache = {};
  final Set<int> _statusUpdatedIncidentIds = {};

  @override
  void initState() {
    super.initState();
    _loadIncidents();
  }

  Future<void> _loadIncidents() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiService>();
      final items = await api.fetchAdminIncidents();
      await _assignLocations(items);
      setState(() {
        _incidents = items;
        _applyFilters();
        _loading = false;
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadIncidents,
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildHeader(theme),
                    const SizedBox(height: 16),
                    _buildFilters(context, theme),
                    const SizedBox(height: 16),
                    if (_error != null)
                      Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                    else if (_filteredIncidents.isEmpty)
                      Container(
                        margin: const EdgeInsets.only(top: 40),
                        alignment: Alignment.center,
                        child: Text('No incidents match your current filters.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                      )
                    else
                      ..._filteredIncidents.map((i) => _buildIncidentCard(i, theme)).toList(),
                    const SizedBox(height: 40),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '📋 Incident Reports',
                style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                'Review and manage citizen reports across the city.',
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
        Badge(
          label: Text('${_filteredIncidents.length}'),
          largeSize: 24,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          backgroundColor: theme.colorScheme.primary,
          child: Icon(Icons.filter_list, color: theme.colorScheme.onSurfaceVariant),
        ),
      ],
    );
  }

  Widget _buildFilters(BuildContext context, ThemeData theme) {
    return LayoutBuilder(builder: (context, constraints) {
      final itemWidth = (constraints.maxWidth - 12) / 2;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          _buildDropdownFilter('Status', _filterStatus, [
            const DropdownMenuItem(value: '', child: Text('All Status')),
            const DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
            const DropdownMenuItem(value: 'VALIDATED', child: Text('Validated')),
            const DropdownMenuItem(value: 'RESOLVED', child: Text('Resolved')),
          ], (v) => setState(() { _filterStatus = v ?? ''; _applyFilters(); }), itemWidth, theme),

          _buildDropdownFilter('Governorate', _filterGovernorate, [
            const DropdownMenuItem(value: '', child: Text('All Region')),
            ..._governorates.map((gov) => DropdownMenuItem(value: gov, child: Text(gov))),
          ], (v) => setState(() { 
            _filterGovernorate = v ?? ''; 
            _filterDelegation = '';
            _updateDelegations(); 
            _applyFilters(); 
          }), itemWidth, theme),

          _buildDropdownFilter('Delegation', _filterDelegation, [
            const DropdownMenuItem(value: '', child: Text('All Area')),
            ..._delegations.map((d) => DropdownMenuItem(value: d, child: Text(d))),
          ], (v) => setState(() { _filterDelegation = v ?? ''; _applyFilters(); }), itemWidth, theme),

          SizedBox(
            width: itemWidth,
            child: FilledButton.tonalIcon(
              onPressed: _loadIncidents,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Refresh'),
              style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
            ),
          ),
        ],
      );
    });
  }

  Widget _buildDropdownFilter(String label, String value, List<DropdownMenuItem<String>> items, ValueChanged<String?> onChanged, double width, ThemeData theme) {
    return SizedBox(
      width: width,
      child: DropdownButtonFormField<String>(
        isExpanded: true,
        value: value.isEmpty ? null : value,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: theme.colorScheme.surfaceVariant.withOpacity(0.3),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12),
        ),
        items: items,
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildIncidentCard(Incident incident, ThemeData theme) {
    final statusColor = _statusColor(incident.status);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: theme.dividerColor.withOpacity(0.1)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => showIncidentDetailsDialog(context, incident),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(_iconForCategory(incident.category), style: const TextStyle(fontSize: 20)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(incident.title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        if (incident.address != null) 
                          Text(incident.address!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.primaryContainer.withOpacity(0.4),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(incident.category ?? 'OTHER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: theme.colorScheme.primary)),
                            ),
                            if (incident.delegation != null) ...[
                              const SizedBox(width: 8),
                              Text('📍 ${incident.delegation}', style: theme.textTheme.bodySmall?.copyWith(fontSize: 10, color: theme.colorScheme.onSurfaceVariant)),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  _buildStatusChip(incident.status, statusColor),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _buildCompactAction(incident, 'Verify', Colors.green, incident.status == 'PENDING' ? () => _changeStatus(incident, 'VALIDATED') : null)),
                  const SizedBox(width: 8),
                  Expanded(child: _buildCompactAction(incident, 'Resolve', theme.colorScheme.primary, incident.status != 'RESOLVED' ? () => _changeStatus(incident, 'RESOLVED') : null)),
                  const SizedBox(width: 8),
                  _buildIconButton(incident, Icons.delete_outline, Colors.red, () => _confirmDeleteIncident(incident)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusChip(String status, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(status, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildCompactAction(Incident incident, String label, Color color, VoidCallback? onPressed) {
    return OutlinedButton(
      onPressed: _updatingIncidentId == incident.id ? null : onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: onPressed == null ? Colors.grey.withOpacity(0.2) : color.withOpacity(0.5)),
        padding: const EdgeInsets.symmetric(vertical: 10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildIconButton(Incident incident, IconData icon, Color color, VoidCallback? onPressed) {
    return IconButton(
      onPressed: _updatingIncidentId == incident.id ? null : onPressed,
      icon: Icon(icon, color: color.withOpacity(0.8), size: 20),
      style: IconButton.styleFrom(
        backgroundColor: color.withOpacity(0.05),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  // (Keeping existing logic functions exactly as they were)
  String _iconForCategory(String? category) {
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

  Color _statusColor(String status) {
    switch (status) {
      case 'PENDING': return Colors.orange;
      case 'VALIDATED': return Colors.green;
      case 'RESOLVED': return const Color(0xFF06B6D4);
      default: return Colors.grey;
    }
  }

  Widget _buildCategoryIcon(Incident incident, Color statusColor) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: statusColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(_iconForCategory(incident.category), style: const TextStyle(fontSize: 20)),
        ),
        if (_statusUpdatedIncidentIds.contains(incident.id))
          Positioned(
            top: -4,
            right: -4,
            child: Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: Colors.cyan,
                shape: BoxShape.circle,
                border: Border.all(color: Theme.of(context).scaffoldBackgroundColor, width: 2),
              ),
              child: const Icon(Icons.mark_email_read, size: 14, color: Colors.white),
            ),
          ),
      ],
    );
  }

  void _applyFilters() {
    _filteredIncidents = _incidents.where((incident) {
      final statusMatch = _filterStatus.isEmpty || incident.status == _filterStatus;
      final governorateMatch = _filterGovernorate.isEmpty || incident.governorate == _filterGovernorate;
      final delegationMatch = _filterDelegation.isEmpty || incident.delegation == _filterDelegation;
      return statusMatch && governorateMatch && delegationMatch;
    }).toList();
  }

  Future<void> _assignLocations(List<Incident> incidents) async {
    final futures = incidents.map((incident) async {
      if (incident.latitude == null || incident.longitude == null) return;
      if (incident.governorate != null && incident.delegation != null) return;
      final cacheKey = '${incident.latitude},${incident.longitude}';
      if (_locationCache.containsKey(cacheKey)) {
        final cached = _locationCache[cacheKey]!;
        incident.governorate ??= cached['governorate'];
        incident.delegation ??= cached['delegation'];
        return;
      }
      final location = await _reverseGeocode(incident.latitude!, incident.longitude!);
      incident.governorate ??= location['governorate'];
      incident.delegation ??= location['delegation'];
      _locationCache[cacheKey] = location;
    });
    await Future.wait(futures);
    _updateGovernorateFilters();
  }

  Future<Map<String, String?>> _reverseGeocode(double lat, double lon) async {
    try {
      final uri = Uri.parse('https://nominatim.openstreetmap.org/reverse?lat=${Uri.encodeComponent(lat.toString())}&lon=${Uri.encodeComponent(lon.toString())}&format=json&addressdetails=1&zoom=12');
      final response = await http.get(uri);
      if (response.statusCode != 200) return {'governorate': null, 'delegation': null};
      final jsonBody = json.decode(response.body) as Map<String, dynamic>;
      final address = jsonBody['address'] as Map<String, dynamic>? ?? {};
      final governorate = address['state']?.toString() ?? address['region']?.toString() ?? address['country']?.toString();
      final delegation = address['state_district']?.toString() ?? address['county']?.toString() ?? address['city']?.toString() ?? address['town']?.toString() ?? address['village']?.toString() ?? address['suburb']?.toString();
      return {'governorate': governorate, 'delegation': delegation};
    } catch (_) { return {'governorate': null, 'delegation': null}; }
  }

  void _updateGovernorateFilters() {
    _governorates = _incidents.map((i) => i.governorate).whereType<String>().toSet().toList()..sort();
    if (_filterGovernorate.isNotEmpty && !_governorates.contains(_filterGovernorate)) {
      _filterGovernorate = ''; _filterDelegation = '';
    }
    _updateDelegations();
  }

  void _updateDelegations() {
    if (_filterGovernorate.isEmpty) { _delegations = []; _filterDelegation = ''; return; }
    _delegations = _incidents.where((i) => i.governorate == _filterGovernorate).map((i) => i.delegation).whereType<String>().toSet().toList()..sort();
    if (_filterDelegation.isNotEmpty && !_delegations.contains(_filterDelegation)) { _filterDelegation = ''; }
  }

  Future<void> _changeStatus(Incident incident, String status) async {
    setState(() { _updatingIncidentId = incident.id; });
    try {
      final api = context.read<ApiService>();
      final updated = await api.updateIncidentStatus(incident.id, status);
      final index = _incidents.indexWhere((item) => item.id == updated.id);
      if (index >= 0) { _incidents[index] = updated; }
      await _assignLocations(_incidents);
      setState(() { 
        _applyFilters(); 
        _statusUpdatedIncidentIds.add(updated.id); 
        _updatingIncidentId = null; 
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Incident #${incident.id} updated to $status')));
    } catch (err) { setState(() { _updatingIncidentId = null; }); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update status: $err'))); }
  }

  Future<void> _confirmDeleteIncident(Incident incident) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete incident'),
        content: Text('Delete incident #${incident.id} "${incident.title}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed == true) { await _deleteIncident(incident); }
  }

  Future<void> _deleteIncident(Incident incident) async {
    setState(() { _updatingIncidentId = incident.id; });
    try {
      final api = context.read<ApiService>();
      await api.deleteIncident(incident.id);
      setState(() { _incidents.removeWhere((item) => item.id == incident.id); _applyFilters(); _updatingIncidentId = null; });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Incident #${incident.id} deleted')));
    } catch (err) { setState(() { _updatingIncidentId = null; }); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to delete incident: $err'))); }
  }
}
