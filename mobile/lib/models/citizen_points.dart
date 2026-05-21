class CitizenPoints {
  final String username;
  final int totalPoints;

  CitizenPoints({required this.username, required this.totalPoints});

  factory CitizenPoints.fromJson(Map<String, dynamic> json) {
    return CitizenPoints(
      username: json['citizenUsername']?.toString() ?? 'You',
      totalPoints: json['totalPoints'] is int ? json['totalPoints'] : int.parse(json['totalPoints']?.toString() ?? '0'),
    );
  }
}
