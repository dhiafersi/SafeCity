class AdminSummary {
  final String title;
  final String tip;
  final String place;
  final List<Map<String, dynamic>> topNeighborhoods;
  final bool llmConfigured;
  final String llmModel;

  AdminSummary({
    required this.title,
    required this.tip,
    required this.place,
    required this.topNeighborhoods,
    required this.llmConfigured,
    required this.llmModel,
  });

  factory AdminSummary.fromJson(Map<String, dynamic> json) {
    return AdminSummary(
      title: json['title']?.toString() ?? 'City Overview',
      tip: json['tip']?.toString() ?? '',
      place: json['place']?.toString() ?? 'the city',
      topNeighborhoods: (json['topNeighborhoods'] as List<dynamic>?)
          ?.cast<Map<String, dynamic>>()
          .toList() ?? [],
      llmConfigured: json['llmConfigured'] == true,
      llmModel: json['llmModel']?.toString() ?? '',
    );
  }
}
