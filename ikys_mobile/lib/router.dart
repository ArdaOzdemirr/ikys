import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/shell_screen.dart';

/// Bildirime tıklayınca (push_service.dart) ekran açabilmek için global anahtar.
final rootNavigatorKey = GlobalKey<NavigatorState>();

/// expo-router'daki AuthGate'in karşılığı: oturum durumuna göre yönlendirir.
GoRouter createRouter(AuthProvider auth) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/home',
    refreshListenable: auth,
    redirect: (context, state) {
      if (auth.loading) return null;
      final loggingIn = state.matchedLocation == '/login';
      if (!auth.isAuthenticated) return loggingIn ? null : '/login';
      if (loggingIn) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (c, s) => const LoginScreen()),
      GoRoute(path: '/home', builder: (c, s) => const ShellScreen()),
    ],
  );
}
