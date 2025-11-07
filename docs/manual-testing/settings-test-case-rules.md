# Settings Manual Test Case Rules

Bu not, ayarlar alanı için manuel test senaryolarını nasıl üreteceğimizi kalıcı olarak tarif eder. Yeni modüller geldikçe aynı şemayı ve dil kurallarını kullanarak bu dosyayı genişletin.

## Kaynaklar

- Uygulama sayfaları `src/pages/settings/*.tsx` altında. Şu an Profil, Genel, Bildirimler, Potansiyel Müşteriler (Leads), Projeler, Hizmetler, Faturalandırma ve Tehlike Bölgesi sayfaları kapsanıyor.
- Yapışkan kaydet çubuğu, bölüm bazlı kirlenme takibi ve uyarılar `SettingsPageWrapper`, `CategorySettingsSection`, `SettingsStickyFooter` bileşenleriyle sağlanıyor. Senaryo yazarak bunların davranışını doğruluyoruz, ama metinde bileşen isimleri geçmiyor.
- Durum/veri güncellemeleri `useProfile`, `useOrganizationSettings`, `useWorkingHours`, `useOrganizationData` gibi hook’larla ve Supabase işlemleriyle yürütülüyor. Testleri yazmadan önce ilgili kodu okuyup hangi alanların görünür olduğunu anlayın, sonra yalnızca arayüzdeki metinlere referans verin.

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

## Kapsam Notları

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
