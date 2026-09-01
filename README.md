# 🐬 Dolphin — GitHub Proje Yöneticisi

GitHub hesabınla giriş yap, public/private repolarından takip etmek istediklerini seç,
her proje için **not** al, **todo** yaz ve **commit geçmişini** incele.

- **Next.js 16** (App Router, Server Actions)
- **SQLite** (better-sqlite3) — tek dosyalık yerel veritabanı
- **Tailwind CSS 4 + daisyUI 5** — iki özel tema: `dolphin-light` ve `dolphin-dark`, üst bardaki switch ile değişir ve `localStorage`da saklanır
- **Motion (Framer Motion)** — sayfa geçişleri, kademeli liste girişleri; `prefers-reduced-motion` tercihine uyar
- **Inter** (next/font ile yerel barındırma) + **Lucide** ikonları
- **PWA** — manifest, maskable ikonlar, service worker ve çevrimdışı sayfası
- **İki dil** — Türkçe ve İngilizce, çerez tabanlı (URL'de dil öneki yok)
- **Vitest** — 170 test; sunucu action'ları, veritabanı ve GitHub katmanı dahil
- Port ve tüm ayarlar `.env` dosyasından

## Kurulum

### 1. Bağımlılıklar

```bash
npm install
```

### 2. GitHub OAuth App oluştur

<https://github.com/settings/developers> → **New OAuth App**

| Alan | Değer |
| --- | --- |
| Application name | Dolphin |
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/api/auth/callback` |

> Portu değiştirirsen callback adresini de aynı porta göre güncelle.

### 3. `.env` dosyasını doldur

`.env.example` dosyası `.env` olarak kopyalanmış durumda:

```env
PORT=3000
APP_URL=http://localhost:3000
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
DATABASE_PATH=./data/dolphin.db
```

- `PORT` — uygulamanın çalışacağı port. `npm run dev` ve `npm run start` bu değeri okur.
- `APP_URL` — OAuth callback'in döneceği adres; port ile tutarlı olmalı.
- `DATABASE_PATH` — SQLite dosyasının yolu. Tablolar ilk çalıştırmada otomatik oluşur.
- `ISSUE_SYNC_TTL_MINUTES` — issue/PR önbelleğinin tazelik süresi (varsayılan 360 = 6 saat).
  Sekme açıldığında önbellek bundan eskiyse GitHub'dan tazelenir; zamanlanmış iş yoktur.
- `REPO_SYNC_TTL_MINUTES` — depo meta verisi (yıldız, açıklama, son push) için tazelik
  süresi (varsayılan 720 = 12 saat). Tek istekle tüm depolar güncellenir.
- `ARCHIVE_RETENTION_DAYS` — arşivdeki depo bu kadar gün sonra notları ve görevleriyle
  birlikte kalıcı olarak silinir (varsayılan 30). `0` yazılırsa otomatik silme kapanır.
  Temizlik zamanlanmış bir işle değil, sayfa açılışlarında yapılır.
- `ENCRYPTION_KEY` — GitHub access token'ları bu anahtarla (AES-256-GCM) şifrelenir.
  Boş bırakılırsa `data/.encryption-key` dosyası üretilir. Anahtarı veritabanından
  ayrı tutmak daha güvenlidir; anahtar değişirse kullanıcıların yeniden giriş yapması gerekir.

### 4. Çalıştır

```bash
npm run dev            # geliştirme
npm run build          # üretim derlemesi
npm run start          # üretim sunucusu
npm test               # testler
npm run test:coverage  # kapsam raporu
npm run lint           # eslint
```

## Marka ve ikonlar

Kaynak logo: `public/logo.svg`. Tüm ikonlar bundan türetilir:

```bash
node scripts/clean-logo.mjs      # dolguları 3 marka rengine sabitler + svgo
node scripts/generate-icons.mjs  # favicon, apple-icon, PWA ikonları, sıkı varyant
```

`clean-logo.mjs` yalnızca logoyu değiştirdiğinde gerekir: vektörleştirilmiş
dosyalar yüzlerce "neredeyse aynı" renk (anti-aliasing izi) taşır ve küçük
boyutlarda gri gürültüye dönüşür; bu adım hepsini üç renge indirir.

`generate-icons.mjs` ayrıca `public/logo-mark.svg` üretir — logonun kenar boşluğu
kırpılmış hâli. Favicon ve uygulama içindeki küçük logo bunu kullanır, çünkü tam
çerçeve 16-32 pikselde okunmuyor.

Marka renkleri: mürekkep `#1D1D1F`, yüzey `#F5F5F7`, kıvılcım `#21CAE7`.
Arayüzde `primary` nötr mürekkep (açık temada siyah, koyuda beyaz), `accent` ise
camgöbeği kıvılcım: odak halkası, seçim izi ve sabitlenmiş not çubuğu.

## Dil

Arayüz Türkçe ve İngilizce. Dil şu sırayla belirlenir:

1. Kullanıcının açıkça seçtiği dil (`dolphin-locale` çerezi)
2. Tarayıcı/işletim sistemi dili (`Accept-Language` başlığı)
3. İngilizce

Seçim altbilgideki **TR / EN** düğmelerinden yapılır; URL'de dil öneki yoktur. Metinler
`src/lib/i18n/messages/` altında; `en.ts` tip düzeyinde `tr.ts` ile aynı anahtarlara
sahip olmak zorunda, ayrıca bir test iki sözlüğün eşitliğini doğrular.

## Kullanım akışı

1. **/login** — GitHub ile giriş. İstenen izin `repo` kapsamıdır; private repoları
   listeleyebilmek ve commit geçmişini okuyabilmek için gerekir.
2. **/repos** — Erişebildiğin tüm repolar listelenir (arama + public/private/seçili
   filtreleri). İşaretle, **Kaydet** de. Seçimden çıkardığın deponun **notları ve
   görevleri silinmez**: kayıt varsa depo arşive alınır, tekrar seçtiğinde verisiyle
   geri gelir. Kaydetmeden önce neyin arşivleneceğini gösteren bir onay ekranı çıkar.
   Sayfanın altındaki **Arşiv** bölümünden geri getirebilir veya kalıcı silebilirsin.
3. **/** — Seçtiğin repolar liste hâlinde; açık todo ve not sayaçlarıyla birlikte.
4. **Ctrl+K** — komut paleti: projeler, notlar, görevler ve issue/PR'lar arasında arama
   ve hızlı geçiş.
5. **/projects/[id]** — Dört sekme:
   - **Notlar** — başlık + markdown içerik (tablo, kod bloğu, liste), düzenleme,
     sabitleme, silme.
   - **Todo** — öncelikli (yüksek/normal/düşük) görevler, tamamlananları temizleme.
     **Toplu düzenle** ile birden çok görevi seçip tamamlandı işaretleyebilir veya
     silebilirsin. Bir görevden **GitHub issue açılabilir** — onay diyaloğu
     başlık/açıklamayı düzenletir ve işlemin sonuçlarını açıkça listeler. Açılan issue
     numarası göreve bağlanır; iki yönlü senkron yoktur.
   - **PR & Issue** — deponun açık/kapalı pull request ve issue'ları; etiket, yorum
     sayısı ve son güncelleme ile listelenir. Veri `issues` tablosunda önbelleklenir;
     yalnızca TTL dolduğunda veya **Yenile** düğmesiyle GitHub'a gidilir.
   - **Git geçmişi** — dal seçici + sayfalı commit listesi. Bir commit'e tıklayınca
     açılan modal; tam mesaj, yazar, üst commit'ler, +/- istatistikleri ve dosya
     bazında diff gösterir.

   Sekmelerin üstünde **Özet** paneli vardır: markdown yazabilir veya
   **README'den aktar** ile deponun README dosyasını çekebilirsin. Todo sekmesindeki
   **TODO.md'den aktar** ise depodaki TODO.md dosyasını okur, `- [ ]` / `- [x]`
   maddelerini **önizleme olarak listeler** (zaten ekli olanlar işaretsiz gelir); hangilerini
   ekleyeceğini sen seçersin. Aktarımdan sonra tek tıkla **geri alabilirsin**.

## Testler

`npm test` 170 testi çalıştırır. Suit iki katmandan oluşur:

**Saf mantık** — markdown ayrıştırma, tarih biçimlendirme (SQLite'ın Z taşımayan eski
damgaları dahil), token şifreleme, çeviri ve GitHub hata sınıflandırması.

**Veritabanına dokunan mantık** — sunucu action'ları, şema göçleri, issue önbelleği,
depo senkronu ve oturum yaşam döngüsü. Bunlar **gerçek SQLite** üzerinde çalışır:
`src/test/setup.ts` her test dosyası için geçici bir `.db` açar, GitHub ve
`next/*` bağımlılıkları taklit edilir. Böylece asıl risk taşıyan yerler —
arşivleme, sahiplik kontrolleri (`WHERE user_id = ?`), silme zinciri, içe aktarma
partisi ve geri alma — gerçekten çalıştırılarak doğrulanır.

Kapsam `npm run test:coverage` ile görülebilir; hedef `src/lib` altındaki sunucu
mantığıdır, arayüz bileşenleri bu suitin kapsamında değildir.

## Veri modeli

| Tablo | Açıklama |
| --- | --- |
| `users` | GitHub profili + access token |
| `sessions` | Çerezdeki oturum anahtarı (30 gün) |
| `repos` | Kullanıcının panoda görmeyi seçtiği depolar (`is_archived`, `missing_since`) |
| `notes` | Repo bazlı notlar |
| `todos` | Repo bazlı görevler (issue açıldıysa `issue_number` / `issue_url`) |
| `issues` | GitHub issue/PR önbelleği (`repos.issues_synced_at` tazelik damgası) |

Repo satırındaki `summary`, `summary_source` ve `summary_updated_at` kolonları özet
alanını tutar; şema ilk açılışta otomatik güncellenir.

Notlar ve görevler depoya `ON DELETE CASCADE` ile bağlıdır, ama depo seçimden
çıkarıldığında **silinmez** — `is_archived` işaretlenir. Gerçek silme yalnızca arşiv
bölümündeki açık onayla olur.

Bir depo GitHub listesinden düşerse (silinmiş, devredilmiş ya da erişim kalkmış olabilir)
depo tazelemesi onu `missing_since` ile işaretler; yine silmez. Panoda uyarı rozeti
çıkar, **Repo seçimi** sayfasındaki *GitHub'da bulunamadı* bölümünden arşive alınabilir
veya kalıcı silinebilir. Kayıp depolar kendiliğinden silinmez — geri gelebilirler.

Arşive alınan depolar ise `ARCHIVE_RETENTION_DAYS` gün sonra kalıcı olarak silinir.
Kalan süre arşiv listesinde her satırda yazar; geri getirilen deponun sayacı sıfırlanır.

**Arşivleme ve silme** üç yerden yapılabilir: proje detayındaki **⋯** menüsü, *Repo seçimi*
sayfasındaki arşiv ve *GitHub'da bulunamadı* bölümleri. Kalıcı silme her yerde aynı
diyaloğu açar: işlemin geri alınamayacağını, kaç not/görev gideceğini ve GitHub'daki
deponun silinmeyeceğini söyler, ardından onay için deponun tam adının
(`owner/repo`) yazılmasını ister. Bu eşleşme sunucuda da kontrol edilir — yanlış
bağlanmış bir arayüz silme yapamaz. Uzak liste boş dönerse ya da sayfa üst sınırına dayanırsa
hiçbir şey işaretlenmez — geçici bir API hatası tüm depoları "silinmiş" göstermesin diye.

Zaman damgaları her yerde ISO-8601/UTC yazılır (`lib/time.ts`); eski `datetime('now')`
biçimindeki satırlar okunurken de doğru yorumlanır.

## Dizin yapısı

```
src/
  app/
    api/auth/{login,callback,logout}/route.ts   GitHub OAuth akışı
    login/page.tsx                              giriş ekranı
    repos/page.tsx                              repo seçimi
    projects/[id]/page.tsx                      proje detayı (notlar/todo/git)
    page.tsx                                    anasayfa
  components/
    ui/        ortak sayfa başlığı / özet şeridi
    shell/     uygulama kabuğu (üst gezinme, tema switch'i)
    home/      proje listesi
    repos/     repo seçim listesi
    project/   notlar, todo, commit geçmişi
    motion/    ortak animasyon ön ayarlari
  lib/
    db.ts        SQLite bağlantısı + şema göçleri
    crypto.ts    token şifreleme (AES-256-GCM)
    session.ts   oturum yönetimi
    github.ts    GitHub REST çağrıları + hata sınıflandırma
    issues.ts    issue/PR önbelleği ve senkronu
    repos.ts     depo meta verisi senkronu
    time.ts      tek biçim zaman damgası
    actions.ts   server action'lar
    *.test.ts    birim testler
scripts/run-next.mjs                            .env içindeki PORT ile next'i başlatır
```
