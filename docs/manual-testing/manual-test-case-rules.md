# Manuel Test Case Kuralları

Bu not, uygulamanın tamamı için manuel test senaryolarını nasıl üreteceğimizi kalıcı olarak tarif eder. Ayarlar, CRM modülleri, şablonlar, iş akışları gibi tüm alanlarda aynı şema ve dil kurallarını kullanarak bu dosyayı genişletin.

## Kaynaklar

- Modül sayfaları `src/pages/**/*.tsx`, destekleyici bileşenler `src/components/**` altında. Test eklemeden önce ilgili sayfayı ve destekleyen hook/bileşenleri inceleyin; senaryolarda **yalnızca kullanıcıya görünen metinleri** kullanın.
- Ayarlar özelinde `SettingsPageWrapper`, `SettingsStickyFooter`, `CategorySettingsSection` gibi bileşenler yapışkan kaydet/guard davranışını sağlar; bu akışları test ederken bileşen adını değil, görünen uyarı ve butonları anlatın.
- CRM modülleri (Leads, Projects, Sessions, Payments), Şablonlar, Workflows ve Global Search için `docs/manual-testing/tests/*.json` içindeki mevcut şemayı baz alın; yeni dosyalar oluştururken aynı yapıya sadık kalın.

## JSON Şeması

Tüm dosya aşağıdaki yapıyı kullanır:

```json
{
  "suite": "Sayfa Adı",
  "cases": [
    {
      "external_id": "CRM-PAGE-###",
      "title": "Kısa başlık",
      "description": "Senaryonun amacı",
      "steps": [
        {
          "action": "Kullanıcının yaptığı adım",
          "expected_result": "Beklenen ekran tepkisi"
        }
      ],
      "expected_result": "Genel son durum"
    }
  ]
}
```

Her sayfada 8-12 vaka bulunmalı ve `external_id` değerleri benzersiz olmalıdır.

## Dil ve Üslup Kuralları

- Senaryoları **Türkçe** yazın, kısa ve anlaşılır cümleler kurun.
- Manuel QA teknik değildir; fonksiyon, hook, komponent, ikon sınıfı gibi kod terimlerini adımlara veya beklentilere eklemeyin.
- Alan, buton, kart isimlerini ekranda göründükleri haliyle yazın (“Profil Bilgileri”, “Değişiklikleri Kaydet”, “Yeni logo seç” vb.).
- Beklenen sonuçlarda hem ekranda görülen değişiklikleri hem de kaydın kalıcı olup olmadığını kullanıcı gözüyle anlatın; “Sunucuya POST atılır” gibi teknik anlatımlardan kaçının.
- İhtiyaç varsa ön koşulları da basit Türkçe ile belirtin (“Bu testi çalıştırmadan önce en az bir paket oluşturun”).

## Kapsam Özeti

Aşağıdaki JSON dosyaları güncel durumda kapsam sağlıyor:

- `settings-manual-tests.json`: Profil, Genel, Bildirimler, Leads Settings, Projeler, Hizmetler, Faturalandırma, Tehlike Bölgesi.
- `leads-manual-tests.json`, `projects-manual-tests.json`, `sessions-manual-tests.json`, `payments-manual-tests.json`: CRM ana modüllerinin tablo, detay, sheet ve export akışları.
- `templates-manual-tests.json`, `workflows-manual-tests.json`: Şablon builder, görsel havuzu, workflow oluşturma/durum yönetimi, guard akışları.
- `global-search-manual-tests.json`: Header araması için lead/proje/seans/custom field kapsamı.
- `auth-manual-tests.json`, `onboarding-manual-tests.json`: Şimdilik TBD yer tutucuları; onboarding/Auth tamamlandığında ayrıntılandırılacak.
- `mobile-manual-tests.json`: Navigasyon sheet’leri, mobil ayarlar deneyimi, AppSheetModal davranışları ve builder/workflow akışlarının mobil doğrulamaları.

Aşağıdaki bölümler ayarlar modülüne özel kapsam notlarını listeler:

### Profil

- “Profil Bilgileri” kartındaki fotoğraf yükleme, önizleme ve silme butonlarını, ad/telefon alanlarının boşluk temizleme davranışını ve alt tarafta beliren “Kaydet/İptal” çubuğunu test edin.
- E-posta alanının yalnızca okunabilir olduğunu ve kullanıcı turu (tutorial) açıkken adımların doğru sırayla ilerlediğini gözlemleyin.
- “Çalışma Saatleri” bölümünde her gün için anahtar ve saat listelerinin doğru çalıştığını, her değişiklikte kullanıcıya bilgi verildiğini kontrol edin.

### Genel

- Marka formundaki “Şirket Adı, İş E-postası, İş Telefonu” alanlarını, renk seçiciyi ve hatalı giriş uyarılarını doğrulayın.
- Logo alanında dosya seçme, 2 MB sınırı, önizleme penceresi ve silme onayını akış halinde test edin.
- Sosyal bağlantılar listesindeki platform ekleme, özel platform alanı, sürükle-bırak sıralama ve silme uyarıları doğru metinlerle çalışmalı.
- “Bölgesel Tercihler” içinde tarih formatı, saat formatı, saat dilimi araması ve dil seçicinin birlikte çalıştığını onaylayın.

### Bildirimler

- Sayfanın üstündeki “Tüm bildirimler” anahtarı açıldığında alttaki tüm anahtarların eşleştiğini ve bilgi mesajı çıktığını doğrulayın.
- Günlük özet saatinin açılır listeden değişmesiyle kısa süreli kilitlenme ve başarı mesajını kontrol edin.
- “Günlük Özet” ve “Proje Aşamaları” kartlarında bulunan test gönder butonlarının başarılı/başarısız durumlarda hangi mesajları verdiğini kaydedin.
- Yüklenme sırasında iskelet ekranın gözüktüğünü ve veri geldikten sonra kaybolduğunu doğrulayın.

### Potansiyel Müşteriler (Leads)

- “Durum düğmelerini göster” anahtarının sistem durum etiketlerini açıp kapattığını ve tercih olarak saklandığını test edin.
- “Durum ekle” altlığıyla yeni durum oluşturma, renk seçme, yaşam döngüsü belirleme ve başarı mesajlarını takip edin; kullanılan durumlar silinmeye çalışıldığında uyarı vermeli.
- Durum etiketlerini sürükleyerek sıralamanın kalıcı değiştiğini ve kullanıcıya bilgi verildiğini doğrulayın.
- “Alanlar” bölümünde yeni alan ekleme, alan türü seçme, zorunlu işareti ve alan silme akışlarını kullanıcı dilinde kaydedin.

### Projeler

- “Proje Aşamaları” bölümünde varsayılan aşamaların otomatik oluştuğunu, yeni aşama ekleme penceresinin renk seçimini ve sürükle-bırak sıralamayı desteklediğini test edin.
- “Proje Türleri” listesindeki artı butonu, “Varsayılan yap” kutusu ve varsayılan türlerin silinememesi davranışlarını doğrulayın.
- “Oturum Durumları” kartlarında pasif rozetleri, varsayılan atama butonunu ve silme yerine “Pasif yap” seçeneğini kontrol edin.

### Hizmetler

- “Seans Türleri” bölümünde yeni tür ekleme modali, süre seçimi, varsayılan atama ve “Pasifleri göster” anahtarını birlikte test edin.
- “Paketler” kartlarında paket sihirbazını açma, fiyat alanlarının ve ek hizmet rozetlerinin doğru göründüğünü, pasifleştirme/silme seçeneklerinin kullanıcıya açıkça anlatıldığını doğrulayın.
- “Hizmetler” bölümünde Teslimat/Kapsam sekmeleri arasında geçiş yapan segment kontrolü, kategori başlıklarının açılıp kapanması ve her karttaki fiyat detaylarının doğru olduğunu kontrol edin.

### Faturalandırma

- Vergi profili kartında “Bireysel/Şirket” radio butonları, zorunlu şirket adı alanı, vergi numarası ve adres alanlarının birlikte çalıştığını; yanlış KDV yüzdesinde kırmızı uyarı verildiğini kaydedin.
- “KDV fiyatlara dahil” anahtarının kaydedilip kaydedilmediğini ve “Kaydet / Sıfırla” butonlarının yalnızca değişiklik olduğunda aktifleştiğini doğrulayın.

### Tehlike Bölgesi

- Kırmızı uyarı kartındaki “Tüm verileri sil” butonunun parola girmeden çalışmadığını, onay penceresinde hangi verilerin silineceğinin listelendiğini ve işlem sırasında butonların kilitlendiğini test edin.
- İşlem iptal edildiğinde parola alanının temizlendiğini ve başarılı silme sonrasında kırmızı bildirim çıktığını not edin.

## Adım Yazma İpuçları

1. Her adımda tek bir kullanıcı eylemi tarif edin (örn. “Profil sayfasında ‘Değişiklikleri Kaydet’ butonuna bas”).
2. Beklenen sonuç satırında hem ekrandaki görsel/metinsel değişikliği hem de veri kaydının kalıcı olduğunu anlatın (“Toast ‘Kaydedildi’ der, sayfayı yenileyince aynı değer kalır”).
3. Otomatik kaydeden akışlarda kontrolün kısa süreli kilitlendiğini ve bilgi mesajını bekleyin.
4. Ön koşul gerekiyorsa adımların başında belirtin (“Bu testi çalıştırmadan önce bir paket oluşturulmuş olmalı”).
5. Yeni sayfalar için aynı JSON şemasını, Türkçe dili ve teknik olmayan üslubu koruyarak yeni bölümler ekleyin.

## Sonraki Adımlar / Eksik Kapsam

1. **Onboarding & Auth akışları**: İlk girişte otomatik oluşturulan paketler, seans türleri, hizmetler, KDV/region ayarları için gerçek senaryolar (TBD dosyaları) doldurulmalı.
2. **Çoklu kanal entegrasyonları**: WhatsApp/SMS gönderimleri tamamlandığında workflows/templates testlerine gerçek cihaz doğrulamaları eklenmeli.
3. **Mobil/Responsive varyantlar**: Header Global Search ve kritik modüllerin mobil davranışları için ek senaryolar yazılmalı.
4. **Yeni modüller**: Pipeline’da olan onboarding adımları, auth iyileştirmeleri veya henüz kapsanmayan sayfalar için aynı şemayla yeni suite’ler açın.
5. **Analytics & Dashboard**: CRM Dashboard kartları, grafikler ve Analytics filtreleri için henüz manuel test JSON’u yok; metriklerin doğru hesaplandığını ve mobilde okunabilir kaldığını doğrulayan senaryolar eklenmeli.
6. **Takvim & Hatırlatıcı sayfaları**: `/calendar` ve `/reminders` sayfalarındaki timeline, hızlı filtreler, yeniden planlama sürükle-bırak akışları ayrı bir suite’te kapsanmalı.
