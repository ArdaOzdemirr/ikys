import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/models.dart';

/// Token ve kullanıcı bilgisini cihazın güvenli alanında saklar
/// (Keychain / Keystore). expo-secure-store karşılığı.
class TokenStorage {
  TokenStorage._();
  static final TokenStorage instance = TokenStorage._();

  final _s = const FlutterSecureStorage();

  static const _kAccess = 'accessToken';
  static const _kRefresh = 'refreshToken';
  static const _kUser = 'user';
  static const _kApiBaseUrl = 'apiBaseUrlOverride';

  Future<String?> getAccess() => _s.read(key: _kAccess);
  Future<String?> getRefresh() => _s.read(key: _kRefresh);

  Future<void> setTokens(String access, String refresh) async {
    await _s.write(key: _kAccess, value: access);
    await _s.write(key: _kRefresh, value: refresh);
  }

  Future<void> setUser(User user) =>
      _s.write(key: _kUser, value: jsonEncode(user.toJson()));

  Future<User?> getUser() async {
    final raw = await _s.read(key: _kUser);
    if (raw == null) return null;
    try {
      return User.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    await _s.delete(key: _kAccess);
    await _s.delete(key: _kRefresh);
    await _s.delete(key: _kUser);
  }

  /// Kullanıcının ayarlar ekranından girdiği sunucu adresi (varsa).
  /// Yoksa config.dart'taki derleme zamanı varsayılanı kullanılır.
  Future<String?> getApiBaseUrlOverride() => _s.read(key: _kApiBaseUrl);

  Future<void> setApiBaseUrlOverride(String url) =>
      _s.write(key: _kApiBaseUrl, value: url);

  Future<void> clearApiBaseUrlOverride() => _s.delete(key: _kApiBaseUrl);
}
