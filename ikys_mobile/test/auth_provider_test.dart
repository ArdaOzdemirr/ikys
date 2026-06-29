import 'package:flutter_test/flutter_test.dart';
import 'package:ikys_mobile/models/models.dart';
import 'package:ikys_mobile/providers/auth_provider.dart';

void main() {
  group('AuthProvider.hasRole', () {
    test('kullanıcı yokken hiçbir rolde değildir', () {
      final auth = AuthProvider();
      expect(auth.hasRole(['ADMIN']), isFalse);
      expect(auth.isAuthenticated, isFalse);
    });

    test('kullanıcının rolü listede varsa true döner', () {
      final auth = AuthProvider();
      auth.user = User(id: '1', email: 'a@b.com', role: 'ACCOUNTING');

      expect(auth.hasRole(['ACCOUNTING', 'ADMIN']), isTrue);
      expect(auth.isAuthenticated, isTrue);
    });

    test('kullanıcının rolü listede yoksa false döner', () {
      final auth = AuthProvider();
      auth.user = User(id: '1', email: 'a@b.com', role: 'EMPLOYEE');

      expect(auth.hasRole(['ACCOUNTING', 'ADMIN']), isFalse);
    });
  });
}
