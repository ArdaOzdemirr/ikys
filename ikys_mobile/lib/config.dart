// Backend API adresi.
//
// ÖNEMLI: Telefonda "localhost" senin bilgisayarını değil telefonu gösterir.
// - Gerçek cihaz (Expo Go'da kullandığın gibi): bilgisayarının yerel IP'si.
//   Daha önce Metro 192.168.1.104'te çalışıyordu; varsayılanı ona göre koydum.
//   IP'n farklıysa burayı değiştir.
// - Android Emulator kullanırsan: http://10.0.2.2:3000/api/v1
//
// İstersen çalıştırırken --dart-define=API_URL=... ile de geçebilirsin.
const String apiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://192.168.1.103:3000/api/v1',
);
