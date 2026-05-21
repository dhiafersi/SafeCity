import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/citizen_points.dart';
import '../services/api_service.dart';

class CitizenPointsScreen extends StatefulWidget {
  const CitizenPointsScreen({super.key});

  @override
  State<CitizenPointsScreen> createState() => _CitizenPointsScreenState();
}

class _CitizenPointsScreenState extends State<CitizenPointsScreen> {
  bool _loading = true;
  String? _error;
  CitizenPoints? _points;

  @override
  void initState() {
    super.initState();
    _loadPoints();
  }

  Future<void> _loadPoints() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiService>();
      final result = await api.fetchMyPoints();
      setState(() => _points = result);
    } catch (err) {
      setState(() => _error = err.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
            ? Center(child: Text(_error!))
            : Padding(
                padding: const EdgeInsets.all(16),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('Your Impact Points', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 16),
                        Text('Citizen: ${_points?.username ?? 'You'}', style: const TextStyle(fontSize: 16)),
                        const SizedBox(height: 12),
                        Text('Total Points', style: TextStyle(color: Colors.grey.shade300)),
                        const SizedBox(height: 8),
                        Text('${_points?.totalPoints ?? 0}', style: const TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: Colors.cyanAccent)),
                        const SizedBox(height: 12),
                        const Text('Keep reporting issues to earn more points and help your community.', style: TextStyle(fontSize: 14)),
                      ],
                    ),
                  ),
                ),
              );
  }
}
