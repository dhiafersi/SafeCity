import '../utils/app_config.dart';

class Incident {
  final int id;
  final String title;
  final String? description;
  final String status;
  final String? category;
  final double? latitude;
  final double? longitude;
  final String? address;
  final String? reporterUsername;
  final String? aiCategory;
  final double? aiConfidence;
  String? governorate;
  String? delegation;
  final String? photoPath;
  final DateTime? createdAt;

  Incident({
    required this.id,
    required this.title,
    this.description,
    required this.status,
    this.category,
    this.latitude,
    this.longitude,
    this.address,
    this.reporterUsername,
    this.aiCategory,
    this.aiConfidence,
    this.governorate,
    this.delegation,
    this.photoPath,
    this.createdAt,
  });

  String? get photoUrl {
    if (photoPath == null || photoPath!.isEmpty) {
      return null;
    }
    if (photoPath!.startsWith('http')) {
      return photoPath;
    }
    return '${AppConfig.apiBaseUrl}/api/uploads/incidents/$photoPath';
  }

  factory Incident.fromJson(Map<String, dynamic> json) {
    return Incident(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      title: json['title'] ?? '',
      description: json['description'],
      status: json['status']?.toString() ?? 'UNKNOWN',
      category: json['category']?.toString(),
      latitude: json['latitude'] != null ? (json['latitude'] as num).toDouble() : null,
      longitude: json['longitude'] != null ? (json['longitude'] as num).toDouble() : null,
      address: json['address']?.toString(),
      reporterUsername: json['reporterUsername']?.toString(),
      aiCategory: json['aiCategory']?.toString(),
      aiConfidence: json['aiConfidence'] != null ? (json['aiConfidence'] as num).toDouble() : null,
      governorate: json['governorate']?.toString(),
      delegation: json['delegation']?.toString(),
      photoPath: json['photoPath']?.toString(),
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt'].toString()) : null,
    );
  }
}

class PageResult<T> {
  final List<T> content;
  final int totalPages;
  final int totalElements;

  PageResult({required this.content, required this.totalPages, required this.totalElements});

  factory PageResult.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) itemBuilder) {
    final contentJson = json['content'] as List<dynamic>? ?? [];
    return PageResult(
      content: contentJson.map((item) => itemBuilder(item as Map<String, dynamic>)).toList(),
      totalPages: json['totalPages'] is int ? json['totalPages'] : int.parse(json['totalPages']?.toString() ?? '0'),
      totalElements: json['totalElements'] is int ? json['totalElements'] : int.parse(json['totalElements']?.toString() ?? '0'),
    );
  }
}
