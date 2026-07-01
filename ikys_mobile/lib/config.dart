// Backend API adresi.
//
// Varsayılan olarak Railway'deki production backend'e bağlanır. Yerel
// geliştirme yaparken (kendi bilgisayarındaki backend'i test etmek için)
// bunu her seferinde burada değiştirmek yerine uygulama içindeki
// "Sunucu Ayarları" ekranından (giriş ekranındaki dişli ikonu) çalışırken
// geçici olarak değiştirebilirsin — o ayar cihazda kalıcı olarak saklanır
// ve bu varsayılanı geçersiz kılar (bkz. services/storage.dart, services/api_client.dart).
//
// Yerel test için: telefonda "localhost" bilgisayarını değil telefonu
// gösterir; gerçek cihazda bilgisayarının yerel ağ IP'sini (örn.
// http://192.168.1.103:3000/api/v1), Android Emulator'da ise
// http://10.0.2.2:3000/api/v1 kullan.
// İstersen çalıştırırken --dart-define=API_URL=... ile de geçebilirsin.
const String apiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://ikys-production.up.railway.app/api/v1',
);
