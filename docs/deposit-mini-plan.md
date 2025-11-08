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

-### 3. UI / Akış
- **Ödeme aksiyonları**: Ödeme kartının sağ üstünde üç temel buton bulunur: `Kapora ödemesi`, `Kalan ödeme`, `Tamamını tahsil et`. Kullanıcı senaryoya göre butonu seçer; form yalnızca tutar, tarih ve opsiyonel açıklama ister.
- **Otomatik kapora payı**: Kullanıcı tutarı girdikten sonra sistem seçilen aksiyona göre `deposit_allocation` değerini hesaplar.
  - Kapora ödemesi → `min(amount, remainingDeposit)`
  - Tamamını tahsil et → Kapora eksikse önce eksik kaporayı kapatır, kalanı bakiye tahsilatı olarak işler.
  - Kalan ödeme → Kapora zaten kapalıysa tamamını bakiyeye yazar; kapora eksikse kullanıcıya “Kaporayı da bugün tahsil etmek ister misin?” prompt'u gösterir.
- **Kapora kartı**:
  - "Kapora tutarını sabitle" butonu snapshot alanlarını doldurur. Sabitlendiğinde kart "Kapora tutarı ₺X olarak belirlendi" mesajını gösterir; kullanıcının müşteriye nasıl ilettiği varsayılmaz.
  - "Kapora tutarını güncelle" aksiyonu yeni snapshot oluşturur ve isteğe bağlı olarak paylaşılabilir kısa metin üretir.
  - "Farkı kalan bakiyeye taşı" aksiyonu yalnızca proje kalan tutarını artırır; kapora snapshot değişmez.
- **Ödeme listesi**: `base_price` satırı çıkarılır. Liste her ödeme için sistemin hesapladığı `Kapora payı` rozetini gösterir (örn. `Kapora payı: ₺1.000`); kullanıcı payı manuel girmez.
- **Kapora statüsü**: `depositPaid >= depositAmount` ise "tahsil edildi", `depositPaid > 0` ise "kısmi", aksi halde "bekleniyor".
- **İade**: Ayrı bir butonla açılır; kullanıcı sadece iade tutarı + sebep girer, negatif sayı girmez.

## Edge Case Kuralları

-### 1. Ödeme Güncelleme / Silme
- Düzenleme diyaloğu, ödemeyi oluşturan aksiyonu gösterir (Kapora, Kalan, Tam). Kullanıcı aksiyonu değiştirirse sistem `deposit_allocation` değerini otomatik yeniden hesaplar.
- Validasyon mesajları yalnızca iş kurallarını anlatır (“Bu ödeme kaporayı 500 TL fazla kapatıyor. Farkı kalan ödemeye taşıyalım mı?”). Kullanıcıdan sayı girmesi istenmez; yalnızca önerilen aksiyonlardan birini seçer.
- Bir ödeme silinmek istediğinde modal “Bu ödemeyi silmek yerine iade kaydı oluşturmak ister misiniz?” diye sorar. Silme tamamlanırsa kapora statüsü otomatik güncellenir ve audit log’a not düşülür.

### 2. Geri Ödeme / İade
- Ödeme kartındaki “İade” kısayolu ilgili diyalogu açar; kullanıcı sadece iade tutarını ve sebebini girer. Sistem arka planda `amount` değerini negatif, `deposit_allocation` alanını da girilen kapora payına göre ayarlar; kullanıcı manuel negatif sayı girmek zorunda kalmaz.
- Kapora kartı `depositPaid` hesabına negatif değerleri dahil ederek "kapora iade edildi" durumunu gösterebilir; gerekli durumlarda otomatik banner ile “Kapora {{delta}} TL eksildi” mesajı çıkar.

### 3. Kapora Hedefi Azaldığında
- `depositAmount` yeni konfigürasyon nedeniyle düşerse `depositPaid > depositAmount` olabilir. Bu durumda kart “Kaporada {{overage}} TL fazla tahsilat var” uyarısı verir; aksiyonlar:
  - Fazlalığı kalan bakiye tahsilatına taşı (`deposit_allocation` değerlerini otomatik düşürüp farkı `balance_due`ya ekle).
  - Fazlalığı iade et (İade kısayolunu açar ve önerilen tutarı doldurur).
- Kullanıcı karar verene kadar snapshot kilidi sarı uyarıyla işaretlenir.

### 4. Kapora Devre Dışı
- Kapora modu `none` olduğunda snapshot alanları temizlenir ve tüm ödemelerin `deposit_allocation` değeri 0'a çekilir. Eğer kullanıcı devre dışı bırakırken mevcut kapora katkısı varsa sistem “Kapora paylarını sıfırlamak üzeresiniz” onayı ister ve kalan bakiye yeniden hesaplanır.

-### 5. Bir Ödemeyi Parçalı Kapora Yapmak
- “Tamamını tahsil et” veya “Kalan ödeme” akışı seçildiğinde sistem kapora eksikse otomatik olarak önce kaporayı, sonra bakiyeyi kapatır; kullanıcıya bilgi metni gösterilir.
- Aynı gün birden fazla işlem yapılacaksa kullanıcı ayrı aksiyonları (Kapora ödemesi, Kalan ödeme) kullanır; ekstra alan gösterilmez.

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
1. Müşteri ilk taksit olarak ₺1.000 öder. Kullanıcı sağ üstteki “Kapora ödemesi” kısayolunu açar; dialog `amount = remainingDeposit` önerir ve `deposit_allocation` alanını otomatik doldurur.
2. Kart `depositPaid = 1000`, `remainingDeposit = 1500` gösterir ve statüyü “kısmi”ye çeker.
3. İkinci taksit geldiğinde aynı formda `deposit_allocation = 1500` seçilerek kayıt girilir; toplam `depositPaid = 2500` olur ve statü “tahsil edildi”ye döner.

### 3. Kapora + Bakiye Tek Ödemede
1. Çekim sonrası müşteri ₺12.400’ün tamamını yatırır.
2. Kullanıcı “Genel ödeme” kısayolunu açar; formda “Kapora payı” bölümü `min(amount, remainingDeposit)` değerini önerir ve kısa bir açıklama (örn. “Kapora için 2.500 TL ayırdık, kalan 9.900 TL bakiye olarak kaydedilecek”) gösterir.
3. Kullanıcı isterse değeri düzenler, kaydı kaydeder.
4. Kart “Kapora tahsil edildi” + “Kalan bakiye 9.900 TL tahsil edildi” mesajını gösterir; listede tek ödeme satırı olur, rozet `Kapora payı: ₺2.500`.

### 4. Ek Hizmet Eklenmesi (Kapora Tutarı Sabitlenmişken)
1. Fotoğrafçı yeni albüm ekler, proje toplamı artar.
2. `financialSummary.depositAmount` büyür; snapshot farklı olduğu için kartta sarı banner çıkar: “Kilitlediğiniz 2.500 TL kapora yerine hesaplanan tutar 3.100 TL.”
3. Kullanıcı iki seçenekten birini seçer:
   - “Kapora tutarını güncelle”: dialog açılır, yeni tutar sabitlenir ve kart mesajı yenilenir.
   - “Farkı kalan bakiyeye taşı”: snapshot aynı kalır, sistem `remaining` değerini artırır ve banner kapanır.

### 5. Kapora Hedefi Azaldığında (İndirim)
1. Kullanıcı kaporayı %30’dan %15’e düşürür.
2. Yeni hesap `depositAmount = 1.250`, ancak `depositPaid = 2.500` olduğu için kart “Kapora hedefinden 1.250 TL fazla tahsilat var” uyarısı verir.
3. Kullanıcı “Fazlayı kalana taşı” veya “İade oluştur” aksiyonlarından birini seçer; seçim `deposit_allocation` değerlerine yansıtılır.
4. Karar sonrası uyarı kapanır, snapshot yeni değeri referans alır.

### 6. Kaporanın Kapatılması
1. Kullanıcı kaporayı tamamen devre dışı bırakmak ister ve mod seçici üzerinden `none` seçer.
2. Sistem tüm `deposit_allocation` değerlerini 0’a çekmeden önce onay modalı gösterir (“Kapora paylarını sıfırlamak üzeresiniz”).
3. Onay verildiğinde snapshot alanları temizlenir, kart “Bu proje kaporasız ilerliyor” mesajını gösterir.

### 7. Kapora İadesi
1. Müşteri kaporasını geri ister. Kullanıcı “Kapora iadesi” butonuna basar; dialogda iade tutarı ve iade sebebi alanları bulunur.
2. Form, iade edilecek tutarı önerir (`depositPaid` kadar) ve işlem tamamlandığında pozitif tutarlı kayıt silinmez; bunun yerine otomatik bir iade satırı eklenir (`amount < 0`, `deposit_allocation < 0` arka planda belirlenir).
3. Kart “Kapora iade edildi” mesajını ve yeni `depositPaid` değerini gösterir; kullanıcı negatif tutar yazmakla uğraşmaz.

### 8. Legacy Projelerde Kapora Payını Tamamlama
1. Migration sonrası bazı `deposit_payment` satırlarında `deposit_allocation = 0` ise ödeme tablosu üstünde “Kapora payını netleştir” banner'ı görünür.
2. Kullanıcı “Otomatik eşleştir” diyerek satırdaki tutarı kaporaya bağlar ya da “Elle dağıt” diyerek hızlı seçim listesinden değer seçer; karmaşık form alanları gösterilmez.
3. Kapora kartı uyarısı kaybolur, statü yeniden hesaplanır.

### 9. Ödeme Düzenleme/Silme Yolculuğu
1. Kullanıcı bir ödemeyi düzenlemek ister; dialog, ödeme hangi aksiyonla oluşturulduysa onu gösterir (ör. “Kapora ödemesi”). Gerekirse aksiyon değiştirilebilir.
2. Sistem yeni tutarın kapora hedefini aşması durumunda “Bu ödeme kaporayı 500 TL fazla kapatacak, farkı kalan bakiyeye taşıyalım mı?” şeklinde yönlendirici mesaj gösterir; kullanıcı sadece önerilen aksiyonlardan birini seçer.
3. Ödeme silinmek istendiğinde modal “Bu ödemeyi silmek yerine iade kaydı oluşturmak ister misiniz?” diye sorar. Kullanıcı gerçekten silerse kapora statüsü otomatik güncellenir ve audit log’a not düşülür.


## Uygulama Adımları
1. Migration: `payments.deposit_allocation` kolonu, `deposit_due`/`base_price` temizliği ve `deposit_config` snapshot alanları.
2. Sunucu & client tip güncellemeleri (`src/integrations/supabase/types.ts`, deposit utils).
3. `ProjectPaymentsSection`: yeni hesaplama akışı, kapora kartı uyarıları, toplamlar için `deposit_due` hariç filtreler.
4. `AddPaymentDialog` ve `EditPaymentDialog`: kapora switch'i, otomatik defaultlar, validasyon.
5. `ProjectDepositDialogs`: sabitleme/snapshot UI'si, banner aksiyonları.
6. QA checklist: farklı akışları (tam kapora, kısmi, sabitleme, ekstra hizmet) manuel test senaryolarına ekleyin (`docs/manual-testing/tests/projects-manual-tests.json`).
