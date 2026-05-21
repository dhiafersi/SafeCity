import 'package:flutter/material.dart';
import '../models/incident.dart';

class IncidentDetailsDialog extends StatelessWidget {
  final Incident incident;

  const IncidentDetailsDialog({super.key, required this.incident});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(incident.title),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (incident.photoUrl != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  incident.photoUrl!,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (incident.description != null && incident.description!.isNotEmpty) ...[
              Text(incident.description!),
              const SizedBox(height: 12),
            ],
            Text('Status: ${incident.status}'),
            if (incident.aiCategory != null) ...[
              const SizedBox(height: 8),
              Text('AI Predicted Category: ${incident.aiCategory} (${((incident.aiConfidence ?? 0) * 100).toStringAsFixed(0)}%)'),
            ],
            if (incident.category != null) ...[
              const SizedBox(height: 8),
              Text('Category: ${incident.category}'),
            ],
            if (incident.address != null) ...[
              const SizedBox(height: 8),
              Text('Address: ${incident.address}'),
            ],
            if (incident.governorate != null || incident.delegation != null) ...[
              const SizedBox(height: 8),
              Text('Location: ${incident.delegation ?? incident.governorate ?? 'Unknown'}${incident.governorate != null && incident.delegation != null ? ', ${incident.governorate}' : ''}'),
            ],
            if (incident.reporterUsername != null) ...[
              const SizedBox(height: 8),
              Text('Reporter: ${incident.reporterUsername}'),
            ],
            if (incident.latitude != null && incident.longitude != null) ...[
              const SizedBox(height: 8),
              Text('Coordinates: ${incident.latitude}, ${incident.longitude}'),
            ],
            if (incident.createdAt != null) ...[
              const SizedBox(height: 8),
              Text('Reported: ${incident.createdAt}'),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
      ],
    );
  }
}

Future<void> showIncidentDetailsDialog(BuildContext context, Incident incident) async {
  await showDialog<void>(
    context: context,
    builder: (_) => IncidentDetailsDialog(incident: incident),
  );
}
