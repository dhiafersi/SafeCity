import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../services/api_service.dart';

class CitizenReportScreen extends StatefulWidget {
  const CitizenReportScreen({super.key});

  @override
  State<CitizenReportScreen> createState() => _CitizenReportScreenState();
}

class _CitizenReportScreenState extends State<CitizenReportScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  String _selectedCategory = 'POTHOLE';
  final TextEditingController _latitudeController = TextEditingController();
  final TextEditingController _longitudeController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  XFile? _photo;
  bool _submitting = false;
  bool _locationBusy = false;
  bool _aiBusy = false;
  String? _message;

  final _categories = [
    'POTHOLE',
    'WATER_LEAK',
    'BROKEN_STREETLIGHT',
    'GRAFFITI',
    'ILLEGAL_DUMPING',
    'DAMAGED_SIGN',
    'FLOODING',
    'OTHER',
  ];

  final ImagePicker _picker = ImagePicker();

  Future<void> _pickPhoto(ImageSource source) async {
    final picked = await _picker.pickImage(source: source, maxWidth: 1600, imageQuality: 80);
    if (picked != null) {
      setState(() {
        _photo = picked;
        _message = 'Image selected. Requesting AI autofill...';
      });
      await _autofillWithAI();
    }
  }

  Future<void> _captureLocation() async {
    setState(() {
      _locationBusy = true;
      _message = null;
    });

    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      setState(() {
        _message = 'Location services are disabled. Please enable GPS.';
        _locationBusy = false;
      });
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      setState(() {
        _message = 'Location permission is required to capture your position.';
        _locationBusy = false;
      });
      return;
    }

    try {
      final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      _latitudeController.text = position.latitude.toStringAsFixed(6);
      _longitudeController.text = position.longitude.toStringAsFixed(6);

      final address = await _reverseGeocode(position.latitude, position.longitude);
      if (address != null) {
        _addressController.text = address;
      }

      setState(() {
        _message = 'Location captured successfully.';
      });
    } catch (err) {
      setState(() {
        _message = 'Unable to capture location: $err';
      });
    } finally {
      setState(() {
        _locationBusy = false;
      });
    }
  }

  Future<void> _autofillWithAI() async {
    if (_photo == null) {
      setState(() => _message = 'Please upload a photo to trigger AI autofill.');
      return;
    }

    setState(() {
      _aiBusy = true;
      _message = 'Analyzing image and generating description...';
    });

    try {
      final api = context.read<ApiService>();
      final analysis = await api.analyzeIncidentImage(_photo!,
        address: _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
        latitude: _latitudeController.text.isNotEmpty ? double.tryParse(_latitudeController.text) : null,
        longitude: _longitudeController.text.isNotEmpty ? double.tryParse(_longitudeController.text) : null,
      );

      final category = (analysis['category'] as String?)?.trim();
      final confidence = analysis['confidence'] is num ? (analysis['confidence'] as num).toDouble() : null;

      if (category != null && category.isNotEmpty && _categories.contains(category)) {
        setState(() => _selectedCategory = category);
      }

      if (_titleController.text.trim().isEmpty && category != null && category.isNotEmpty) {
        setState(() => _titleController.text = 'Reported ${_formatCategoryLabel(category)}');
      }

      final description = await api.generateDescription(_selectedCategory, confidence);
      if (description.isNotEmpty) {
        if (_descriptionController.text.trim().isEmpty) {
          _descriptionController.text = description;
        }
      }

      setState(() => _message = 'AI autofill completed. Please review details before submitting.');
    } catch (e) {
      setState(() => _message = 'AI autofill failed: $e');
    } finally {
      setState(() {
        _aiBusy = false;
      });
    }
  }

  String _formatCategoryLabel(String category) {
    return category
        .toLowerCase()
        .replaceAll('_', ' ')
        .split(' ')
        .map((part) => part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  Future<String?> _reverseGeocode(double lat, double lng) async {
    try {
      final uri = Uri.parse('https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=18&addressdetails=0');
      final response = await http.get(uri, headers: {'User-Agent': 'SafeCityMobile/1.0'});
      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        return data['display_name']?.toString();
      }
    } catch (_) {
      // ignore reverse geocode failures
    }
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _message = null;
    });
    try {
      final api = context.read<ApiService>();
      final incident = await api.createIncident(
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        category: _selectedCategory.trim().isEmpty ? null : _selectedCategory.trim(),
        latitude: _latitudeController.text.isNotEmpty ? double.tryParse(_latitudeController.text) : null,
        longitude: _longitudeController.text.isNotEmpty ? double.tryParse(_longitudeController.text) : null,
        address: _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
        photo: _photo,
      );
      setState(() {
        _message = 'Incident submitted successfully (ID ${incident.id}).';
      });
      _formKey.currentState!.reset();
      _photo = null;
    } catch (err) {
      setState(() {
        _message = 'Submission failed: $err';
      });
    } finally {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Report an incident to help your city improve road safety, public lighting, and waste cleanup.', style: TextStyle(fontSize: 16)),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _titleController,
                  decoration: const InputDecoration(labelText: 'Title *'),
                  validator: (value) => value?.trim().isEmpty == true ? 'Title is required' : null,
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: _selectedCategory,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: _categories.map((option) => DropdownMenuItem(value: option, child: Text(option))).toList(),
                  onChanged: (value) {
                    if (value != null) {
                      setState(() {
                        _selectedCategory = value;
                      });
                    }
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _descriptionController,
                  decoration: const InputDecoration(labelText: 'Description'),
                  maxLines: 3,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _latitudeController,
                  decoration: const InputDecoration(labelText: 'Latitude'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _longitudeController,
                  decoration: const InputDecoration(labelText: 'Longitude'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _addressController,
                  decoration: const InputDecoration(labelText: 'Address'),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _locationBusy ? null : _captureLocation,
                        icon: const Icon(Icons.my_location),
                        label: _locationBusy
                            ? const Text('Capturing...')
                            : const Text('Capture Location'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _aiBusy ? null : () => _pickPhoto(ImageSource.camera),
                        icon: const Icon(Icons.camera_alt),
                        label: const Text('Open Camera'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _aiBusy ? null : () => _pickPhoto(ImageSource.gallery),
                        icon: const Icon(Icons.photo_library),
                        label: const Text('Pick from Gallery'),
                      ),
                    ),
                    if (_aiBusy) ...[
                      const SizedBox(width: 12),
                      const SizedBox(
                        height: 48,
                        width: 48,
                        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                if (_photo != null) ...[
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(File(_photo!.path), height: 180, width: double.infinity, fit: BoxFit.cover),
                  ),
                ],
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting ? const CircularProgressIndicator() : const Text('Submit Report'),
                ),
                if (_message != null) ...[
                  const SizedBox(height: 16),
                  Text(_message!, style: const TextStyle(color: Colors.white70)),
                ],
                const SizedBox(height: 16),
                const Text(
                  'Note: photo upload now triggers AI autofill automatically. Review the category and description before submitting.',
                  style: TextStyle(fontSize: 12, color: Colors.white60),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
