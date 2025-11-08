# Kapora Akışı Mini Planı

## Problemler

- Beklenen kapora için `payments.type = deposit_due` kaydı oluşturuluyor ve bu satır ödemeler toplamına dahil oluyor; kapora taksitle ödendiğinde hem planlanan kapora hem de tahsilatlar toplanıp iki kat tahsilat varmış gibi görünüyor.
- Kapora ayarı yapıldığında beklenti kaydı oluşuyor fakat müşteri bir defada hem kapora hem kalan bakiyeyi ödediğinde sistem kaporayı hala "bekleniyor" olarak gösteriyor, çünkü `deposit_payment` tipindeki satırlar dışında hiçbir kayıt kapora hesabına yazılmıyor.
- İş akışında "müşteriye gönderilen kapora talebi" diye resmi bir ileti yok; fotoğrafçı sözlü/whatsapp iletmiş olabiliyor. Buna rağmen sistem beklenen kaporayı her hizmet güncellemesinde otomatik revize ediyor ve hangi tutarın teyitlendiği bilinmiyor.
- Ödeme listesinde proje taban fiyatını `base_price` satırı olarak tekrar gösteriyoruz; üstteki özet zaten toplamları verdiği için bu satır gereksiz, hatta statüsü `Bekliyor` olduğu için kafa karıştırıyor.

## Hedefler

1. Ödeme listesinde yalnızca gerçekleşmiş işlemler (kapora ödemeleri dahil) görünsün; beklentiler ayrı bir özet kartında takip edilsin.
2. Kapora statüsü, kullanıcı ödeme formunda ekstra alanlarla uğraşmadan otomatik güncellensin.
3. Fotoğrafçı "kaporayı şu tutarda sabitledim" diyebilsin; yeni hizmetler eklendiğinde otomatik artış yerine sabit tutarı güncelleme ya da farkı bakiyeye taşıma seçenekleri sunulsun.
4. Ödeme araçları sadeleşsin: `base_price` ve `deposit_due` tipleri kaldırılarak konfigürasyon + tahsilat ayrımı netleşsin.

## Önerilen Mimari Değişiklikler

### 1. Veri Modeli

- `payments` tablosuna `deposit_allocation numeric default 0` kolonu ekleyin. Bu kolon ödemenin ne kadarının kapora hesabına yazıldığını belirtir.
- Yeni tipler: sadece `manual`, `deposit_payment`, `balance_due`. `deposit_payment` varsayılan olarak `deposit_allocation = min(amount, remainingDeposit)` ile kaydedilir. Diğer tiplerde kullanıcı formdan değer girer.
- `deposit_due` satırları yerine `projects.deposit_config` içine `snapshot_amount`, `snapshot_total`, `snapshot_locked_at`, `snapshot_note` alanları eklenir. Bu alanlar kaporanın hangi toplam üzerinden sabitlendiğini gösterir.
- `deposit_allocation` alanı kullanıcıya gösterilmez; backend ödeme niyetine göre bu değeri hesaplar (HoneyBook, Studio Ninja gibi çözümlerdeki “deposit payment” yaklaşımı referans alınır).
- Eski veriyi taşımak için migration:
  1. `deposit_due` satırlarından `amount` değerini ilgili projenin `snapshot_amount` alanına yaz.
  2. Satırın `status = paid` olması halinde `deposit_allocation = amount` olacak şekilde aynı projede yeni bir `deposit_payment` kaydı üret veya mevcut kapora ödemeleri arasında paylaştır.
  3. Tüm `deposit_due` ve `base_price` satırlarını sil.
- Var olan `deposit_payment` satırları için `deposit_allocation` değeri `amount` ile doldurulur; eksikse `0` kalır ve UI kullanıcıya kapora katkısı eklemesi için uyarı verir.

### 2. Kapora Hesaplama

- `financialSummary.depositAmount` aynı kalır ancak `depositPaid` artık `payments.reduce((sum, p) => sum + p.deposit_allocation, 0)` ile hesaplanır.
- `collected` metriği `payments` toplamından gelir, `deposit_due` gibi hayali değerler ortadan kalkar.
- Yeni `remainingDeposit = max(depositAmount - depositPaid, 0)` alanı özet kartına yazılır. Kapora kartında:
  - Sabitlenen tutar gösterilir (`snapshot_amount`), kullanıcı henüz sabitlemediyse kart "Hesaplanan kapora" etiketini kullanır.
  - Kapora tahsilatı gerçekleşmişse tarih, `deposit_allocation` kullanan ödemelerin son tarihinden alınır.

### 3. UI / Akış

- **Hızlı aksiyonlar**: Ödeme kartı yalnızca üç buton içerir ve hepsi gri `pill/pillDanger` varyantında sunulur: `Kapora ödemesi`, `Ödeme ekle`, `İade`. Bu butonlar tüm senaryoları kapsar; ekstra “kalan” veya “tamamını tahsil et” seçenekleri yoktur.
- **Kapora ödemesi**: Bu kısayol `ProjectDepositPaymentDialog`u açar; dialog kalan kapora tutarını otomatik doldurur ve kullanıcı isterse daha düşük veya yüksek değer girebilir. Kaydedilen her ödeme `deposit_payment` olarak işlenir ve `deposit_allocation = amount` olur.
- **Ödeme ekle (GeneralPaymentDialog)**: Kapora dışı tüm tahsilatlar bu sheet’ten geçer. Sheet üzerinde iki kritik detay bulunur:
  - Dialog, kalan bakiyeyi ve varsa kapora bakiyesini özetleyen helper metin + “Kalan tutarı doldur” bağlantısı gösterir. Bağlantı, outstanding toplamını `amount` alanına kopyalar.
  - `deposit_allocation`, `min(amount, depositRemaining)` olarak otomatik hesaplanır; kullanıcıya “Kapora hesabı hala açık” bilgisini veren kopya gösterilir ama ekstra alan gerekmez. Kapora zaten kapalıysa helper copy “Bu ödeme kaporayı etkilemez” şeklindedir.
  - Tutar alanı her açılışta boş gelir; kullanıcı istediği değeri elle girer veya “Kalan tutarı doldur” butonuyla tek tıkla otomatik doldurur.
- **İade (RefundPaymentDialog)**: Sheet, kapora toggle’ını kartın en üstünde gösterir ve switch varsayılan olarak kapalı gelir; kullanıcı sadece kaporadan düşmek istediğinde açar. Tutar alanı boş başlar, sağ üstündeki “Ödenen tutarın tamamını iade et” bağlantısı tüm tahsilatı otomatik doldurur. Toggle açıldığında `deposit_allocation` negatif değerle güncellenir; kullanıcı sadece pozitif tutar girer, backend eksi işaretini yönetir.
- **Kapora kartı ve snapshot banner’ı**:
  - "Kapora tutarını sabitle" / "Güncelle" aksiyonları snapshot alanlarını yönetir; kart, hangi toplam üzerinden kilitlendiğini ve son kilitlenme tarihini banner olarak gösterir.
  - Proje toplamı snapshot’tan saparsa sarı bilgi bandı çıkar. Kullanıcı “Yeni tutarı sabitle” veya “Farkı kalan bakiyeye taşı” aksiyonlarından birini seçene kadar banner kalır.
- **Ödeme listesi**: `base_price` satırı tamamen kaldırılır. Her ödeme satırında sistemin hesapladığı `Kapora payı` rozeti (örn. `Kapora payı: ₺1.000`) gösterilir; kullanıcı hiçbir adımda manuel oran girmez. İade satırları kırmızı tutar ve `İade` rozetleriyle vurgulanır; kaporadan düşülen miktarlar `Kapora iadesi: -₺X` etiketiyle listelenir. Quick action ile eklenen ödemeler ilgili rozetlerle (“Kapora ödemesi”, “Ödeme kaydı”, “İade”) etiketlenir.
- **Kapora statüsü**: `depositPaid >= depositAmount` → “Tahsil edildi”, `depositPaid > 0` → “Kısmi”, aksi halde “Bekleniyor”. İadeler `depositPaid` hesabında negatif olarak izlenir ve kartta “Kapora iadesi yapıldı” mesajı otomatik tetiklenir.

## Edge Case Kuralları

### 1. Ödeme Güncelleme / Silme

- `EditPaymentDialog`, satırın rozetine göre (Kapora ödemesi, Ödeme kaydı, İade) başlangıç durumunu gösterir. Kullanıcı tip değiştirirse sistem `type` ve `deposit_allocation` alanlarını otomatik günceller; kullanıcı sadece tutar/açıklama ile ilgilenir.
- Validasyon mesajları yalnızca iş kuralını anlatır (“Bu ödeme kaporayı 500 TL fazla kapatıyor. Farkı kalan ödemeye taşıyalım mı?”). Kullanıcı karmaşık rakamlar girmez; CTA’lar önerilen çözümü uygular.
- Bir ödeme silinmek istendiğinde modal “Bu işlemi silmek yerine iade kaydı oluşturmak ister misiniz?” diye sorar. Silme onaylanırsa kapora statüsü otomatik güncellenir ve audit log’a not düşülür.

### 2. Geri Ödeme / İade

- “İade” butonu `RefundPaymentDialog`u açar; kullanıcı yalnızca iade tutarını, isteğe bağlı sebebi ve tarihi girer. Tutar alanı boş gelir ve “Ödenen tutarın tamamını iade et” bağlantısı tek tıklamayla mevcut tahsilatı kopyalar.
- Dialogdaki “Kapora iadesi olarak uygula” switch'i varsayılan olarak kapalıdır; açılırsa `deposit_allocation` değerini otomatik negatif yapar ve kullanıcıya ne kadar kaporanın azalacağını helper metinle açıklar. Switch kapalıysa iade sadece kalan bakiyeden düşer.
- Kapora kartı `depositPaid` hesabına negatif değerleri dahil ederek "kapora iade edildi" durumunu gösterebilir; gerekli durumlarda otomatik banner ile “Kapora {{delta}} TL eksildi” mesajı çıkar.

### 3. Kapora Hedefi Azaldığında

- `depositAmount` yeni konfigürasyon nedeniyle düşerse `depositPaid > depositAmount` olabilir. Bu durumda kart “Kaporada {{overage}} TL fazla tahsilat var” uyarısı verir; aksiyonlar:
  - Fazlalığı kalan bakiye tahsilatına taşı (`deposit_allocation` değerlerini otomatik düşürüp farkı `balance_due`ya ekle).
  - Fazlalığı iade et (İade kısayolunu açar ve önerilen tutarı doldurur).
- Kullanıcı karar verene kadar snapshot kilidi sarı uyarıyla işaretlenir.

### 4. Kapora Devre Dışı

- Kapora modu `none` olduğunda snapshot alanları temizlenir ve tüm ödemelerin `deposit_allocation` değeri 0'a çekilir. Eğer kullanıcı devre dışı bırakırken mevcut kapora katkısı varsa sistem “Kapora paylarını sıfırlamak üzeresiniz” onayı ister ve kalan bakiye yeniden hesaplanır.

### 5. Bir Ödemeyi Parçalı Kapora Yapmak

- Kullanıcı aynı gün hem kapora hem bakiye tahsil etmek isterse `Kapora ödemesi` + `Ödeme ekle` kısayollarını ardışık kullanır; her biri tek sayfalık sade formdur.
- `Ödeme ekle` sheet'i, kapora henüz kapanmadıysa helper metinle bilgilendirir ve `deposit_allocation`ı `min(amount, depositRemaining)` olarak dağıtır. Böylece kullanıcı “kaporanın ne kadarı?” sorusuyla uğraşmaz.
- “Kalan tutarı doldur” bağlantısı tek tuşla outstanding bakiyeyi forma yazar; kapora da açıksa aynı işlem içinde otomatik kapatılır.

### 6. Var Olan Kapora Ödemelerinin Backfill'i

- Migration sonrasında `deposit_allocation` değeri olmayan satırlarda UI “Kapora payını seç” banner'ı gösterir; kullanıcı tek tıkla `amount` kadar pay atayabilir veya sıfır bırakabilir.
- Bu banner kapora statüsü "bilinmiyor" kaldığı için kapora kartında da “Kapora tahsilatı geçmiş ödemelerle eşleşmiyor” uyarısını tetikler; kullanıcı bunu tamamlayana kadar statü `pending` görünür.

## Kapsamlı Kullanıcı Yolculukları

### 1. Kapora Konfigürasyonu ve Sözlü Onay

1. Fotoğrafçı proje ödemeler kartından “Kapora ayarla”yı açar.
2. Yüzde ya da sabit mod seçip tutarı girer; “Kapora tutarını sabitle” butonuyla snapshot oluşturur.
3. Sistem `snapshot_amount`, `snapshot_total`, `snapshot_locked_at` alanlarını doldurur ve kartta “Kapora tutarı ₺X olarak belirlendi” mesajı belirir.
4. Kullanıcı müşteriye nasıl ileteceğini kendi belirler; UI varsayımda bulunmaz. Henüz ödeme olmadığı için yalnızca “Tutarı güncelle” aksiyonu aktiftir.

### 2. Kaporanın Taksitle Tahsili

1. Müşteri ilk taksit olarak ₺1.000 öder. Kullanıcı “Kapora ödemesi” kısayolunu açar; dialog kalan kaporayı önerir fakat kullanıcı 1.000 TL olarak günceller.
2. Sistem 1.000 TL’yi kapora olarak işler; kart `depositPaid = 1000`, `remainingDeposit = 1500` gösterir.
3. İkinci taksit geldiğinde aynı kısayol kullanılır; önerilen tutar 1.500 TL’dir. Kaydedildiğinde statü “tahsil edildi”ye döner.

### 3. Kapora + Bakiye Tek Ödemede

1. Çekim sonrası müşteri ₺12.400’ün tamamını yatırır.
2. Kullanıcı `Ödeme ekle` butonunu açar; helper metin “Kapora bakiyesi devam ediyor” mesajını gösterir ve “Kalan tutarı doldur” bağlantısı 12.400 TL’yi otomatik yazar.
3. Sistem eksik kaporayı önce kapatır, kalan tutarı bakiye olarak işler; ödeme listesinde tek satır görünür ve rozet `Kapora payı: ₺2.500` olarak etiketlenir.

### 4. Ek Hizmet Eklenmesi (Kapora Tutarı Sabitlenmişken)

1. Fotoğrafçı yeni albüm ekler, proje toplamı artar.
2. `financialSummary.depositAmount` büyür; snapshot farklı olduğu için kartta sarı banner çıkar: “Sabitlenen kapora 2.500 TL, hesaplanan tutar 3.100 TL.”
3. Kullanıcı iki seçenekten birini seçer:
   - “Kapora tutarını güncelle”: dialog açılır, yeni tutar sabitlenir ve kart mesajı yenilenir.
   - “Farkı kalan bakiyeye taşı”: snapshot aynı kalır, sistem `remaining` değerini artırır ve banner kapanır.

### 5. Kapora Hedefi Azaldığında (İndirim)

1. Kullanıcı kaporayı %30’dan %15’e düşürür.
2. Yeni hesap `depositAmount = 1.250`, ancak `depositPaid = 2.500` olduğu için kart “Kapora hedefinden 1.250 TL fazla tahsilat var” uyarısı verir.
3. Kullanıcı “Fazlayı kalana taşı” veya “İade oluştur” aksiyonlarından birini seçer; sistem seçime göre ödemeleri yeniden sınıflandırır ya da iade dialogunu açar.
4. Karar sonrası uyarı kapanır, snapshot yeni değeri referans alır.

### 6. Kaporanın Kapatılması

1. Kullanıcı kaporayı tamamen devre dışı bırakmak ister ve mod seçici üzerinden `none` seçer.
2. Sistem tüm `deposit_allocation` değerlerini 0’a çekmeden önce onay modalı gösterir (“Kapora paylarını sıfırlamak üzeresiniz”).
3. Onay verildiğinde snapshot alanları temizlenir, kart “Bu proje kaporasız ilerliyor” mesajını gösterir.

### 7. Kapora İadesi

1. Müşteri kaporasını geri ister. Kullanıcı “İade” butonuna basar; `RefundPaymentDialog` üstte kapora toggle’ını, altında tutar ve tarih alanlarını tek sheet’te gösterir.
2. Formdaki tutar alanı boş gelir; sağ üstteki “Ödenen tutarın tamamını iade et” bağlantısı tüm tahsilatı otomatik yazar. “Kapora iadesi olarak uygula” switch’i varsayılan olarak kapalıdır; kullanıcı kaporayı düşmek istediğinde açar.
3. İşlem tamamlandığında pozitif kayıt silinmez; sistem ayrı bir iade satırı ekler, satır `Kapora iadesi: -₺X` etiketini taşır ve kart “Kapora iade edildi” mesajıyla güncel `depositPaid` değerini gösterir.

### 8. Legacy Projelerde Kapora Payını Tamamlama

1. Migration sonrası bazı `deposit_payment` satırlarında `deposit_allocation = 0` ise ödeme tablosu üstünde “Kapora payını netleştir” banner'ı görünür.
2. Kullanıcı “Otomatik eşleştir” diyerek satırdaki tutarı kaporaya bağlar ya da “Elle dağıt” diyerek hızlı seçim listesinden değer seçer; karmaşık form alanları gösterilmez.
3. Kapora kartı uyarısı kaybolur, statü yeniden hesaplanır.

### 9. Ödeme Düzenleme/Silme Yolculuğu

1. Kullanıcı bir ödemeyi düzenlemek ister; dialog, ödeme hangi aksiyonla oluşturulduysa onu gösterir (ör. “Kapora ödemesi”). Gerekirse aksiyon değiştirilebilir.
2. Sistem yeni tutarın kapora hedefini aşması durumunda “Bu ödeme kaporayı 500 TL fazla kapatacak, farkı kalan bakiyeye taşıyalım mı?” şeklinde yönlendirici mesaj gösterir; kullanıcı sadece önerilen aksiyonlardan birini seçer.
3. Ödeme silinmek istendiğinde modal “Bu ödemeyi silmek yerine iade kaydı oluşturmak ister misiniz?” diye sorar. Kullanıcı gerçekten silerse kapora statüsü otomatik güncellenir ve audit log’a not düşülür.

## Uygulama Checklist'i

Bu listeyi her iterasyon sonunda güncelleyin; tamamlanan işleri kaydedip kalan adımları netleştirin.

### Tamamlananlar

- [x] Migration: `payments.deposit_allocation` kolonu, `deposit_due`/`base_price` temizliği ve `projects.deposit_config` snapshot alanları.
- [x] Tip güncellemeleri (`src/integrations/supabase/types.ts`, deposit utils) ve backend helper’ları; yeni `deposit_allocation` hesapları tüm servis katmanına yayıldı.
- [x] `ProjectPaymentsSection`: üç hızlı aksiyon, yeni kapora kartı uyarıları, snapshot banner’ları ve `deposit_due` hariç toplamlar devrede.
- [x] `GeneralPaymentDialog` + `EditPaymentDialog`: `Ödeme ekle` sheet’i, “Kalan tutarı doldur” kısayolu, otomatik kapora payı ve rozet temelli düzenleme akışı hazır.
- [x] `RefundPaymentDialog`: iade butonu, kapora toggle’ı, negatif kayıtların otomatik oluşturulması ve helper metinleri tamamlandı.
- [x] `ProjectDepositDialogs`: sabitleme/snapshot UI’si, “farkı kalana taşı” aksiyonu ve banner CTA’ları eklendi.
- [x] Lokalizasyonlar + QA rehberi: EN/TR çevirileri güncellendi, `docs/manual-testing/tests/projects-manual-tests.json` içine yeni senaryolar (tam kapora, kısmi, ekstra hizmet, iade) işlendi.
- [x] Quick action butonları için gri `pill` ve kırmızı `pillDanger` varyantlarını `Button` bileşeninde finalize et; tüm ödeme ekranlarında aynı stil kullanılmalı.
- [x] `AppSheetModal` kirli kapanış akışı: `GeneralPaymentDialog` ve `RefundPaymentDialog` NavigationGuardDialog ile entegre edildi, ESC/X/İptal + dirty guard davranışları sorunsuz kapanıyor.

### Devam Eden / Bekleyen

- [ ] Final QA + prod migration: Supabase migration henüz prod’a itilmedi; canlıya çıkmadan önce `db push` + smoke test turu planlanmalı (özellikle kapora iadesi ve legacy backfill senaryoları).
