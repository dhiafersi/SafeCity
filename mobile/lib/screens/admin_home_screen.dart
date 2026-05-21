import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import 'admin_dashboard_screen.dart';
import 'admin_incidents_screen.dart';
import 'admin_analytics_screen.dart';
import 'public_map_screen.dart';

class AdminHomeScreen extends StatefulWidget {
  static const routeName = '/admin';
  const AdminHomeScreen({super.key});

  @override
  State<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends State<AdminHomeScreen> {
  int _selectedIndex = 1; // Default to Dashboard

  static const _titles = ['Live Map', 'Admin Dashboard', 'Incident Management', 'City Analytics'];

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
      AdminDashboardScreen(onNavigateToIncidents: () => setState(() => _selectedIndex = 2)),
      const AdminIncidentsScreen(),
      const AdminAnalyticsScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _titles[_selectedIndex],
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
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
            currentAccountPicture: const CircleAvatar(
              backgroundColor: Colors.white,
              child: Icon(Icons.admin_panel_settings, size: 40, color: Color(0xFF1E3A8A)),
            ),
            accountName: Text(auth.username ?? 'Admin User', style: const TextStyle(fontWeight: FontWeight.bold)),
            accountEmail: Text(auth.roles.join(', '), style: const TextStyle(fontSize: 12, color: Colors.white70)),
          ),
          _buildDrawerItem(Icons.map_outlined, 'Live Map', 0, theme),
          _buildDrawerItem(Icons.dashboard_outlined, 'Dashboard', 1, theme),
          _buildDrawerItem(Icons.list_alt_outlined, 'Manage Incidents', 2, theme),
          _buildDrawerItem(Icons.analytics_outlined, 'City Analytics', 3, theme),
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
