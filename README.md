# Trade-gunlugu
## Fikirler (`/fikirler/`)
Uygulamalarını, fikirlerini ve planlarını takip eder.
- **Uygulamalar:** her uygulamanın kendi sayfası var: *Nerede kaldım*, *Eklemem gerekenler* (tarih, gerekli işareti), *Ekleyebileceklerim* (fikirler), *Yaptıklarım / eklediklerim* (tarihli, aya göre). İsteğe bağlı güncelleme hatırlatması.
- **App Store Connect:** `.github/workflows/appstore-sync.yml` 6 saatte bir `scripts/appstore-sync.mjs` ile sürüm, inceleme durumu, build ve “Yenilikler” bilgilerini `fikirler/appstore.json` dosyasına yazar. Gerekli gizli değerler: `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY`.
- **Fikirler:** genel ya da bir uygulamaya bağlı fikirler, tarihli.
- **Planlar:** tarih/saat, tekrar, bildirim; “Takvime” ile telefon takvimine alarmlı eklenir.
Veriler cihazda saklanır; Yedek indir / Yedekten yükle ile taşınabilir.
