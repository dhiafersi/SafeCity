import 'dart:io';

class LoggingHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(context);
    // Log when a new HttpClient is created (helps surface when networking starts)
    // Detailed per-request logging is handled in ApiService where we control requests.
    print('[HTTP-LOG] HttpClient created');
    return client;
  }
}
