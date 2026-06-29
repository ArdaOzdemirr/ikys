// Backend API adresi.
//
// Bu sadece İLK ÇALIŞTIRMADAKİ varsayılan değerdir. Telefonda "localhost"
// bilgisayarını değil telefonu gösterir; gerçek cihazda bilgisayarının yerel
// ağ IP'sini kullanman gerekir. IP her ağ değişiminde değişebileceğinden,
// bunu her seferinde burada elle güncellemek yerine uygulama içindeki
// "Sunucu Ayarları" ekranından (giriş ekranındaki dişli ikonu) çalışırken
// değiştirebilirsin — o ayar cihazda kalıcı olarak saklanır ve bu varsayılanı
// geçersiz kılar (bkz. services/storage.dart, services/api_client.dart).
//
// - Android Emulator kullanırsan: http://10.0.2.2:3000/api/v1
// - İstersen çalıştırırken --dart-define=API_URL=... ile de geçebilirsin.
const String apiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://192.168.1.103:3000/api/v1',
);
