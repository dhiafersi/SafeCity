import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/public_map_screen.dart';
import 'screens/login_screen.dart';
import 'screens/citizen_home_screen.dart';
import 'screens/admin_home_screen.dart';
import 'services/auth_service.dart';
import 'utils/theme.dart';

class SafeCityApp extends StatelessWidget {
  const SafeCityApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SafeCity Mobile',
      debugShowCheckedModeBanner: false,
      theme: buildLightTheme(),
      darkTheme: buildDarkTheme(),
      themeMode: ThemeMode.system, // Supports both light and dark mode automatically
      home: const RootScreen(),
      routes: {
        LoginScreen.routeName: (_) => const LoginScreen(),
        CitizenHomeScreen.routeName: (_) => const CitizenHomeScreen(),
        AdminHomeScreen.routeName: (_) => const AdminHomeScreen(),
      },
    );
  }
}

class RootScreen extends StatelessWidget {
  const RootScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    if (auth.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (auth.isAuthenticated) {
      if (auth.hasRole('ADMIN')) {
        return const AdminHomeScreen();
      }
      return const CitizenHomeScreen();
    }

    return const PublicMapScreen();
  }
}
