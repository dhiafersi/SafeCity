class LeaderboardItem {
  final String username;
  final int points;

  LeaderboardItem({required this.username, required this.points});

  factory LeaderboardItem.fromJson(Map<String, dynamic> json) {
    return LeaderboardItem(
      username: json['citizenUsername']?.toString() ?? 'Citizen',
      points: json['totalPoints'] is int ? json['totalPoints'] : int.parse(json['totalPoints']?.toString() ?? '0'),
    );
  }
}
