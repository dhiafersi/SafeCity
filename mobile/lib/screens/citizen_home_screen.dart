import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import 'citizen_report_screen.dart';
import 'citizen_reports_screen.dart';
import 'citizen_points_screen.dart';
import 'public_map_screen.dart';

class CitizenHomeScreen extends StatefulWidget {
  static const routeName = '/citizen';
  const CitizenHomeScreen({super.key});

  @override
  State<CitizenHomeScreen> createState() => _CitizenHomeScreenState();
}

class _CitizenHomeScreenState extends State<CitizenHomeScreen> {
  int _selectedIndex = 0;

  static const List<String> _titles = [
    'SafeCity Map',
    'Report an Incident',
    'My Reports History',
    'Citizen Impact Rewards',
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
    Navigator.pop(context); // Close drawer
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final theme = Theme.of(context);

    final List<Widget> pages = [
      const PublicMapContent(),
      const CitizenReportScreen(),
      const CitizenReportsScreen(),
      const CitizenPointsScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_selectedIndex], style: const TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_outlined),
            onPressed: () {},
          ),
          const SizedBox(width: 8),
        ],
      ),
      drawer: _buildDrawer(context, auth, theme),
      body: pages[_selectedIndex],
    );
  }

  Widget _buildDrawer(BuildContext context, AuthService auth, ThemeData theme) {
    return Drawer(
      child: Column(
        children: [
          UserAccountsDrawerHeader(
            decoration: BoxDecoration(
              color: theme.colorScheme.primary,
            ),
            currentAccountPicture: CircleAvatar(
              backgroundColor: Colors.white,
              child: Text(
                (auth.username ?? 'C').substring(0, 1).toUpperCase(),
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
              ),
            ),
            accountName: Text(auth.username ?? 'Citizen User', style: const TextStyle(fontWeight: FontWeight.bold)),
            accountEmail: const Text('Verified Resident', style: TextStyle(fontSize: 12, color: Colors.white70)),
          ),
          _buildDrawerItem(Icons.map_outlined, 'City Map', 0, theme),
          _buildDrawerItem(Icons.add_location_alt_outlined, 'New Report', 1, theme),
          _buildDrawerItem(Icons.history_outlined, 'My Reports', 2, theme),
          _buildDrawerItem(Icons.emoji_events_outlined, 'Impact Rewards', 3, theme),
          const Divider(),
          const Spacer(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.redAccent),
            title: const Text('Logout', style: TextStyle(color: Colors.redAccent)),
            onTap: () async {
              await auth.logout();
              if (mounted) {
                Navigator.pushNamedAndRemoveUntil(context, '/', (_) => false);
              }
            },
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildDrawerItem(IconData icon, String title, int index, ThemeData theme) {
    final isSelected = _selectedIndex == index;
    return ListTile(
      leading: Icon(icon, color: isSelected ? theme.colorScheme.primary : null),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          color: isSelected ? theme.colorScheme.primary : null,
        ),
      ),
      selected: isSelected,
      onTap: () => _onItemTapped(index),
    );
  }
}
