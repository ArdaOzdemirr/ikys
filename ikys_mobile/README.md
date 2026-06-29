# İKYS Mobil — Flutter

React Native ile yazdığımız mobil uygulamanın Flutter/Dart sürümü.
Backend (NestJS REST API) aynı; bu yalnızca istemci.

İçerik: login + 2FA, role göre alt menü, mesai (QR + GPS), izin (dinamik
kategoriler + ilk yıl ödeme durumu), profil/çıkış.

## Kurulum

Flutter SDK kurulu olmalı (https://docs.flutter.dev/get-started/install).
`flutter doctor` ile kontrol et.

### 1) Boş bir Flutter projesi oluştur (platform klasörleri için)

```bash
flutter create ikys_mobile
cd ikys_mobile
```

### 2) Bu paketteki dosyaları kopyala
- `lib/` klasörünü **olduğu gibi** projenin `lib/` üzerine yaz
- `pubspec.yaml`'ı projenin köküne kopyala (üzerine yaz)

### 3) Paketleri indir

```bash
flutter pub get
```

### 4) İzinleri ekle (kamera + konum)

**Android** — `android/app/src/main/AndroidManifest.xml` içinde `<manifest>`
etiketinin altına, `<application>`'dan ÖNCE ekle:

```xml
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.INTERNET"/>
```

Ayrıca `android/app/build.gradle` içinde `minSdkVersion`'ı en az 21 yap
(mobile_scanner için). Genelde zaten 21+ olur.

**iOS** — `ios/Runner/Info.plist` içine ekle:

```xml
<key>NSCameraUsageDescription</key>
<string>QR ile mesai girişi için kamera erişimi gereklidir.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Mesai giriş/çıkışında konum doğrulaması için kullanılır.</string>
```

### 5) API adresini ayarla
`lib/config.dart` içindeki `apiBaseUrl`:
- Gerçek cihaz: bilgisayarının yerel IP'si (ör. `http://192.168.1.104:3000/api/v1`).
  Varsayılanı buna göre koydum; IP'n farklıysa değiştir.
- Android Emulator: `http://10.0.2.2:3000/api/v1`

Telefon ile bilgisayar aynı Wi-Fi'da olmalı; backend `docker-compose up` ile açık olmalı.

### 6) Çalıştır
Cihazı USB ile bağla (veya emülatör aç) ve:

```bash
flutter run
```

## Test kullanıcıları (seed)
- Çalışan: `mehmet@firma.com` / `Emp123456!`
- İK: `ik@firma.com` / `Hr123456!`  (QR üretebilir + personeli var)
- Admin: `admin@firma.com` / `Admin123!`  (personeli yok, mesai/izin çalışmaz)

## Dosya yapısı
```
lib/
  main.dart            uygulama girişi + tema
  config.dart          API adresi
  router.dart          go_router + oturum yönlendirmesi
  models/models.dart   veri modelleri
  services/
    storage.dart       güvenli token saklama
    api_client.dart    dio + 401 refresh
    services.dart      auth / attendance / leave servisleri
  providers/
    auth_provider.dart oturum durumu (ChangeNotifier)
  screens/
    login, shell, home, attendance, leave, profile
```
