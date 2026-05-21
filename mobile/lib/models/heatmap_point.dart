class HeatmapPoint {
  final double latitude;
  final double longitude;
  final int count;

  HeatmapPoint({
    required this.latitude,
    required this.longitude,
    required this.count,
  });

  factory HeatmapPoint.fromJson(Map<String, dynamic> json) {
    final latValue = json['lat'] ?? json['latitude'];
    final lngValue = json['lng'] ?? json['longitude'];
    return HeatmapPoint(
      latitude: latValue != null ? (latValue as num).toDouble() : 0.0,
      longitude: lngValue != null ? (lngValue as num).toDouble() : 0.0,
      count: json['count'] is int ? json['count'] : int.tryParse(json['count']?.toString() ?? '0') ?? 0,
    );
  }
}
