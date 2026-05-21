import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/incident.dart';
import '../services/api_service.dart';
import '../widgets/incident_details_dialog.dart';

class CitizenReportsScreen extends StatefulWidget {
  const CitizenReportsScreen({super.key});

  @override
  State<CitizenReportsScreen> createState() => _CitizenReportsScreenState();
}

class _CitizenReportsScreenState extends State<CitizenReportsScreen> {
  bool _loading = true;
  String? _error;
  List<Incident> _incidents = [];

  @override
  void initState() {
    super.initState();
    _loadReports();
  }

  Future<void> _loadReports() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiService>();
      final reports = await api.fetchMyIncidents();
      setState(() => _incidents = reports);
    } catch (err) {
      setState(() => _error = err.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadReports,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: _incidents.length,
                  itemBuilder: (context, index) {
                    final item = _incidents[index];
                    return Card(
                      child: ListTile(
                        title: Text(item.title),
                        subtitle: Text(item.address ?? 'No address'),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.blueGrey.shade800,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(item.status, style: const TextStyle(fontSize: 12)),
                        ),
                        onTap: () => showIncidentDetailsDialog(context, item),
                      ),
                    );
                  },
                ),
    );
  }
}
