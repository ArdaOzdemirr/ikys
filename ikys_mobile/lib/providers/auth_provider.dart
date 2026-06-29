import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../services/services.dart';
import '../services/storage.dart';

/// React'teki AuthContext'in karşılığı.
class AuthProvider extends ChangeNotifier {
  User? user;
  bool loading = true;

  bool get isAuthenticated => user != null;

  bool hasRole(List<String> roles) =>
      user != null && roles.contains(user!.role);

  /// Uygulama açılışında saklı kullanıcıyı yükle
  Future<void> bootstrap() async {
    try {
      user = await TokenStorage.instance.getUser();
    } catch (_) {
      user = null;
    }
    loading = false;
    notifyListeners();
  }

  Future<AuthResult> login(String email, String password, {String? token2FA}) async {
    final res = await AuthService.login(email, password, token2FA: token2FA);
    if (!res.requires2FA) {
      await TokenStorage.instance.setTokens(res.accessToken!, res.refreshToken!);
      await TokenStorage.instance.setUser(res.user!);
      user = res.user;
      notifyListeners();
    }
    return res;
  }

  Future<void> logout() async {
    try {
      await AuthService.logout();
    } catch (_) {
      // token süresi dolmuş olabilir; yerel temizlik yine de yapılır
    }
    await TokenStorage.instance.clear();
    user = null;
    notifyListeners();
  }

  /// API katmanı refresh başaramazsa çağrılır (API çağrısı yapmadan çıkış)
  void forceLogout() {
    TokenStorage.instance.clear();
    user = null;
    notifyListeners();
  }
}
