class AnalyticsData {
  final double averageResolutionTime;
  final List<CategoryStat> categorySplit;
  final List<ResolutionTrend> resolutionTrend;
  final List<NeighborhoodStat> neighborhoodStats;
  final String regionName;
  final String smartCityTip;

  AnalyticsData({
    required this.averageResolutionTime,
    required this.categorySplit,
    required this.resolutionTrend,
    required this.neighborhoodStats,
    required this.regionName,
    required this.smartCityTip,
  });

  factory AnalyticsData.fromJson(Map<String, dynamic> json) {
    return AnalyticsData(
      averageResolutionTime: json['averageResolutionTime'] is num ? (json['averageResolutionTime'] as num).toDouble() : 0.0,
      categorySplit: (json['categorySplit'] as List<dynamic>?)
          ?.map((item) => CategoryStat.fromJson(item as Map<String, dynamic>))
          .toList() ?? [],
      resolutionTrend: (json['resolutionTrend'] as List<dynamic>?)
          ?.map((item) => ResolutionTrend.fromJson(item as Map<String, dynamic>))
          .toList() ?? [],
      neighborhoodStats: (json['neighborhoodStats'] as List<dynamic>?)
          ?.map((item) => NeighborhoodStat.fromJson(item as Map<String, dynamic>))
          .toList() ?? [],
      regionName: json['regionName']?.toString() ?? 'City',
      smartCityTip: json['smartCityTip']?.toString() ?? '',
    );
  }
}

class CategoryStat {
  final String category;
  final int count;

  CategoryStat({required this.category, required this.count});

  factory CategoryStat.fromJson(Map<String, dynamic> json) {
    return CategoryStat(
      category: json['category']?.toString() ?? 'OTHER',
      count: json['count'] is int ? json['count'] : int.parse(json['count']?.toString() ?? '0'),
    );
  }
}

class ResolutionTrend {
  final String period;
  final double value;

  ResolutionTrend({required this.period, required this.value});

  factory ResolutionTrend.fromJson(Map<String, dynamic> json) {
    return ResolutionTrend(
      period: json['period']?.toString() ?? '',
      value: json['value'] is num ? (json['value'] as num).toDouble() : 0.0,
    );
  }
}

class NeighborhoodStat {
  final String name;
  final int count;

  NeighborhoodStat({required this.name, required this.count});

  factory NeighborhoodStat.fromJson(Map<String, dynamic> json) {
    return NeighborhoodStat(
      name: json['name']?.toString() ?? 'Unknown',
      count: json['count'] is int ? json['count'] : int.parse(json['count']?.toString() ?? '0'),
    );
  }
}
