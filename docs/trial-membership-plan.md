## Assistant Checklist
- 🟡 Don't touch tests yet.
- 🟡 Add emojis at the beginning of each tracked item to monitor progress.
- 🟡 Ensure every assistant reads and follows this checklist before editing the plan.

# Trial & Premium Üyelik Planı

## Amaç & Başarı Kriterleri
- Trial sürecini varsayılan 14 günle başlatıp ikili anlaşmalara göre manuel/otomatik olarak uzatılabilir hale getirmek.
- Trial bitiminde uygulamayı kilitleyip sadece yükseltme ekranı göstererek ücretli dönüşümü zorunlu kılmak.
- Premium üyeliğe geçen kullanıcıların her yüzeyde net biçimde `premium` statüsünü görmesi; admin panelinde gerçek zamanlı olarak izlenebilmesi.
- CRM sahibi, kullanıcı listesine bakarak hangi müşterinin trial/premium durumda olduğunu, kaç gün kaldığını ve hangi aksiyonların alındığını görebilmeli.

## Kullanıcı Deneyimi Gereksinimleri

### Trial Durum Göstergeleri
- **Desktop sidebar**: avatar veya hesap bölümünün altında kalan trial gün sayısını gösteren pill. 3 günden az kaldığında renk uyarısı.
- **Mobil top bar**: uygulamanın en üstüne yapışık kısa bilgi çubuğu (dismiss edilebilir) → “Trial’ın bitmesine X gün kaldı, şimdiden yükselt.”
- **Premium badge**: kullanıcı premium olduğunda aynı slotlarda “Premium” etiketi ve avantajlara giden link.
- **Telemetry**: banner/pill gösterimleri `trial_indicator_viewed`, tıklamaları `trial_indicator_cta_clicked` şeklinde izlenmeli.

### Trial Bitiş & Erişim Engeli
- Trial süresi dolduğunda tüm uygulama shell’i yerine tam ekran bir “üyeliğini yükselt” sayfası render edilecek.
- İçerik: plan kartları, premium avantaj bullet’ları, “Satışla iletişime geç” (opsiyonel form), “Trial’ımı uzat” talep butonu.
- Kullanıcı ödeme yaptıysa ve webhook/kv temin edene kadar kilit kalkmıyorsa geçici grace view → “Ödemeni aldık, erişimin açılıyor.”
- Oturum açamayan kullanıcılar için `/billing/trial-expired` public route; epostayla paylaşılan link aynı ekranı göstermeli.
- Tek plan: trial bitince kullanıcı aylık premium plana geçer; fiyatlandırma ve ödeme servis sağlayıcısı (TR’de çalışan Stripe benzeri) henüz seçilmedi.
- Trial uzatma sınırı yok; admin istediği kadar gün ekleyebilir (audit kaydı tutulacak).

### Premium Durumu Sonrası
- Premium ve trial kullanıcıların özellik seti aynı; tek fark erişim süresi. Premium’a geçildiğinde yalnızca paywall/uyarı yüzeyleri gizlenir.
- Premium kullanıcılar için onboarding/checklist’ler açılmalı, trial CTA’ları gizlenmeli.
- Premium statüsü Supabase’de `membership_status = 'premium'` ile tutulup feature flag/guard tarafından tüketilmeli.
- Kullanıcı profiline “Üyelik planı” kartı eklenerek plan, yenileme tarihi, lisans sayısı gösterilmeli.

### Bildirim & İletişim Akışları
- **İn-app**: 7 gün kala bilgi çubuğu, 3 gün kala modalle zorlayıcı hatırlatma, bittiği gün kilit ekranı.
- **E-posta**: trial başlangıcı, 7/3/1 gün kala hatırlatma, bittiğinde “Upgrade etmeden devam edemezsin” mesajı. Tetikleyiciler Supabase edge function’dan.
- **Opsiyonel push/SMS**: B2B kritik müşteriler için manuel tetiklenebilir queue.

## Admin / CRM Paneli Yeniden Tasarımı

### Kullanıcı Listesi (`/admin/users`)
- Kolonlar: Ad/şirket, e-posta, `status (trial/premium/expired)`, `trial kalan gün`, `plan`, `son aktif`, `projeler (#)`, `ekip üyeleri (#)`, `planlanan seans (# upcoming)`.
- Statü filtresi (trial, trial son 3 gün, premium, manuel premium, suspend).
- Toplu aksiyonlar: trial uzat, premium’a geçir, ücretsiz premium tanımla, hesap kilitle/yeniden aç.
- Satır aksiyonu: “Kullanıcıyı yönet” butonu → lead’ler, projeler, seanslar, takvim etkinlikleri, ödemeler (ileride şablonlar/workflow vb.) için sekmeli sheet/sayfa açar.

### Kullanıcı Detay Sayfası
- **Genel kart**: plan, trial başlangıç/bitiş, kalan gün, manuel uzatma logu, premium aktivasyon tarihi.
- **Aktivite & kullanım**: toplam projeler, aktif projeler, ekip üyeleri, davet edilen kullanıcılar, planlanan seanslar (gelecek/past), takvim olayları, ödeme geçmişi.
- **Notlar & CRM verisi**: account owner, NPS, yapılacaklar, son konuşma notu.
- **Sekmeler**: Lead’ler, projeler, seanslar, takvim, ödemeler (gelecekte: template’ler, workflow’lar). Her sekme filtrelenebilir tablo + detay butonuna sahip.
- **İşlem butonları**: trial uzat (gün sayısı gir + neden), premium’a geçir (plan seç), ücretsiz premium (süre ve not), hesabı durdur.
- Yapılan her işlem `admin_action_log` tablosuna yazılır (kim, ne zaman, ne yaptı, not).
- Admin logları yalnızca `admin` rolüne sahip kullanıcılarca (ör. `togayaytemiz@gmail.com`) görülebilir.

### Manuel Ücretsiz Premium & Denemeler
- Her kullanıcı tipi (ör. ajans, freelancer, enterprise) için “promosyon şablonu” seçilerek ücretsiz premium atanmalı; şablon parametreleri: süre, limitler, not.
- Admin, mevcut premium kullanıcıya ekstra süre ekleyebilmeli (yenileme tarihine gün ekleyerek).
- Otomatik tetikleyici: belirli CRM segmentleri (ör. >5 proje açmış trial’lar) için bulk promosyon.

## Veri Modeli & Teknik Gereksinimler
- Yeni alanlar:
- `membership_status`: `trial | premium | expired | suspended | complimentary`.
- `trial_started_at`, `trial_expires_at`, `trial_extended_by_days`, `trial_extension_reason`.
- `premium_activated_at`, `premium_plan`, `premium_expires_at` (pay-as-you-go ise nullable).
- `manual_flag`: bool + `manual_flag_reason`.
- Audit tabloları:
  - `membership_events (user_id, type, meta, admin_id, created_at)`.
  - `billing_entitlements (user_id, feature_key, limit, expires_at)`.
- Supabase RLS güncellenip kullanıcı kendi kaydını sadece kısıtlı alanlar için okuyabilmeli; admin servis rolü tam erişim.
- Scheduler/cron job: her gece trial süresi dolanları `expired` statüsüne çekip tetiklemeleri çalıştırır.
- Edge function: upgrade event’lerini ödemeden (Stripe/Supabase pay) dinleyip `membership_status` günceller.

## Feature Flag & Guard Mimarisi
- `useMembershipGuard` hook’u her hassas feature girişinde trial/premium yetkisini doğrular.
- Flagler:
  - `trial.access_indicator` → UI banner/pill rollout.
  - `trial.paywall_fullscreen` → yeni kilit ekranı.
  - `admin.membership_console` → yeni CRM ekranı.
- Paywall bileşeni: varyantlı (A/B) CTA mesajları; Deneme vs Premium messaging.

## Ölçümleme & Uçtan Uca Akışlar
- Event şeması:
  - `trial_started`, `trial_day_nudge_shown`, `trial_extension_requested`, `trial_expired`, `paywall_viewed`, `plan_selected`, `upgrade_completed`.
  - Admin aksiyonları: `admin_trial_extended`, `admin_premium_granted`, `admin_manual_block`.
- Dashboard KPI’ları: günlük trial → premium dönüşüm, ortalama trial süresi, manuel uzatma sayısı, premium retention.
- Alerting: trial expirations > 5 dakika kilit ekranı alamazsa uyarı; upgrade webhook başarısızlığı; admin extension failure.

## Yol Haritası & Yapılacaklar
1. **Admin Deneyimi (öncelikli)**
   - `/admin/users` tabloyu yeniden kur (filtreleme, sıralama, bulk aksiyonlar).
   - Kullanıcı detay sheet/sayfası; lead/proje/seans/takvim/ödeme sekmeleri.
   - Manuel işlemler için formlar + loglama; testlerde önce kullanıcı listesi & detay sekmelerini doğrula.
2. **Altyapı**
   - Yeni membership alanlarını DB’de oluştur, migration + RLS.
   - Scheduler + edge function’ları yaz, Stripe/Supabase event’lerini bağla.
   - Ücretsiz premium tanımlarında faturalandırma üretme (entitlement-only).
3. **Kullanıcı Yüzeyi**
   - Sidebar/top bar banner, trial/premium badge.
   - Trial bitiş paywall ekranı + yönlendirme (web-only parity).
4. **İletişim & Otomasyon**
   - E-posta şablonları (welcome, reminders, expired).
   - Ops webhook + Zapier/CRM entegrasyonları.
5. **Test & Rollout**
   - Unit/integration testleri (membership guard, admin işlemleri).
   - Dark launch (flag ile), küçük müşteri grubuyla QA, telemetry doğrulaması.

## Açık Sorular & Yanıtlar
- **Plan yapısı**: Tek premium plan; trial bitince aylık plana geçilecek (yanıtlandı).
- **Trial uzatma**: Limit yok, admin istediği kadar uzatabilir (yanıtlandı).
- **Ücretsiz premium**: Faturalandırma yok, yalnızca entitlement olarak tanımlanacak (yanıtlandı).
- **Platform kapsamı**: Şimdilik sadece web; başka istemci yok (yanıtlandı).
- **Ödeme yöntemi**: Kredi kartı ile ödeme hedefleniyor; TR’de Stripe benzeri çözüm seçimi açık (kısmen açık).
- **Admin log erişimi**: Sadece `admin` rolü (ör. `togayaytemiz@gmail.com`) görüntüleyebilir (yanıtlandı).
