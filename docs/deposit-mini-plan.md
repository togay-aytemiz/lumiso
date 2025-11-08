# Kapora Akışı Mini Planı

## Problemler
- Beklenen kapora için `payments.type = deposit_due` kaydı oluşturuluyor ve bu satır ödemeler toplamına dahil oluyor; kapora taksitle ödendiğinde hem planlanan kapora hem de tahsilatlar toplanıp iki kat tahsilat varmış gibi görünüyor.
- Kapora ayarı yapıldığında beklenti kaydı oluşuyor fakat müşteri bir defada hem kapora hem kalan bakiyeyi ödediğinde sistem kaporayı hala "bekleniyor" olarak gösteriyor, çünkü `deposit_payment` tipindeki satırlar dışında hiçbir kayıt kapora hesabına yazılmıyor.
- İş akışında "müşteriye gönderilen kapora talebi" diye resmi bir ileti yok; fotoğrafçı sözlü/whatsapp iletmiş olabiliyor. Buna rağmen sistem beklenen kaporayı her hizmet güncellemesinde otomatik revize ediyor ve hangi tutarın teyitlendiği bilinmiyor.
- Ödeme listesinde proje taban fiyatını `base_price` satırı olarak tekrar gösteriyoruz; üstteki özet zaten toplamları verdiği için bu satır gereksiz, hatta statüsü `Bekliyor` olduğu için kafa karıştırıyor.

## Hedefler
1. Ödeme listesinde yalnızca gerçekleşmiş işlemler (kapora ödemeleri dahil) görünsün; beklentiler ayrı bir özet kartında takip edilsin.
2. Kapora statüsü, kullanıcı hangi ödeme tipini seçerse seçsin, toplam tahsilat içinde kaporaya ayrılan tutara bakarak güncellensin.
3. Fotoğrafçı "kaporayı şu tutarda kilitledim" diyebilsin; yeni hizmetler eklendiğinde otomatik artış yerine kilidi açıp yeniden hesaplama seçenekleri sunulsun.
4. Ödeme araçları sadeleşsin: `base_price` ve `deposit_due` tipleri kaldırılarak konfigürasyon + tahsilat ayrımı netleşsin.

## Önerilen Mimari Değişiklikler

### 1. Veri Modeli
- `payments` tablosuna `deposit_allocation numeric default 0` kolonu ekleyin. Bu kolon ödemenin ne kadarının kapora hesabına yazıldığını belirtir.
- Yeni tipler: sadece `manual`, `deposit_payment`, `balance_due`. `deposit_payment` varsayılan olarak `deposit_allocation = min(amount, remainingDeposit)` ile kaydedilir. Diğer tiplerde kullanıcı formdan değer girer.
- `deposit_due` satırları yerine `projects.deposit_config` içine `snapshot_amount`, `snapshot_total`, `snapshot_locked_at`, `snapshot_note` alanları eklenir. Bu alanlar müşteriye sözel iletilen kaporanın hangi toplam üzerinden kilitlendiğini gösterir.
- Eski veriyi taşımak için migration:
  1. `deposit_due` satırlarından `amount` değerini ilgili projenin `snapshot_amount` alanına yaz.
  2. Satırın `status = paid` olması halinde `deposit_allocation = amount` olacak şekilde aynı projede yeni bir `deposit_payment` kaydı üret veya mevcut kapora ödemeleri arasında paylaştır.
  3. Tüm `deposit_due` ve `base_price` satırlarını sil.

### 2. Kapora Hesaplama
- `financialSummary.depositAmount` aynı kalır ancak `depositPaid` artık `payments.reduce((sum, p) => sum + p.deposit_allocation, 0)` ile hesaplanır.
- `collected` metriği `payments` toplamından gelir, `deposit_due` gibi hayali değerler ortadan kalkar.
- Yeni `remainingDeposit = max(depositAmount - depositPaid, 0)` alanı özet kartına yazılır. Kapora kartında:
  - Kilitli tutar gösterilir (`snapshot_amount`), kullanıcının kaporayı kilitlemediği projelerde bu alan `hesaplanan` olarak etiketlenir.
  - Kapora tahsilatı gerçekleşmişse tarih, `deposit_allocation` kullanan ödemelerin son tarihinden alınır.

### 3. UI / Akış
- **Ödeme ekleme / düzenleme**: Formun altına `Kapora tahsilatına dahil et` switch'i eklenir. Switch açıkken kullanıcı tahsilatın ne kadarının kaporaya ayrıldığını girer (default: `min(amount, remainingDeposit)`).
- **Kapora kartı**:
  - "Kaporayı kilitle" butonu snapshot alanlarını doldurur. Kilitliyken yeni hizmet eklenirse kartta uyarı banner'ı çıkar: `"Kapora 2.500 TL olarak kilitlendi. Güncel hesap 3.100 TL. [Kilitli tutarı güncelle] [Farkı kalan bakiyeye taşı]"`.
  - "Kilitli tutarı güncelle" aksiyonu yeni snapshot oluşturur ve isteğe bağlı olarak otomatik mesaj metni üretir.
  - "Farkı kalan bakiyeye taşı" aksiyonu yalnızca proje kalan tutarını artırır; kapora snapshot değişmez.
- **Ödeme listesi**: `base_price` satırı çıkarılır. Liste her ödeme için `kapora katkısı` rozetini gösterir (örn. `Kapora payı: ₺1.000`).
- **Kapora statüsü**: `depositPaid >= depositAmount` ise "tahsil edildi", `depositPaid > 0` ise "kısmi", aksi halde "bekleniyor".

## Kullanıcı Akışları
1. **Kapora ödendi, sonradan ekstra hizmet istendi**  
   - Kapora kilitli ise uyarı banner'ı görünür. Fotoğrafçı isterse kilidi açıp yeni tutarı hesaplatır, isterse farkı kalan bakiyeye iter. Her iki aksiyon da audit log'a yazılır.
2. **Kapora sözel olarak iletildi, ödeme yok**  
   - Kullanıcı kilitli snapshot oluşturur ve kart "Kaporayı müşteriye ilettiniz (₂₅₀₀ TL)" mesajını gösterir. Ödeme gelene kadar sadece kilidi güncelle seçenekleri aktif olur.
3. **Kapora ödendi, müşteri kalan + kaporayı tek seferde ödedi**  
   - Yeni ödeme eklenirken switch açık kalır ve kapora payı `min(amount, remainingDeposit)` olarak doldurulur. Böylece kapora kartı "tahsil edildi"ye geçer ve ikinci sahte kayıt oluşmaz.

## Uygulama Adımları
1. Migration: `payments.deposit_allocation` kolonu, `deposit_due`/`base_price` temizliği ve `deposit_config` snapshot alanları.
2. Sunucu & client tip güncellemeleri (`src/integrations/supabase/types.ts`, deposit utils).
3. `ProjectPaymentsSection`: yeni hesaplama akışı, kapora kartı uyarıları, toplamlar için `deposit_due` hariç filtreler.
4. `AddPaymentDialog` ve `EditPaymentDialog`: kapora switch'i, otomatik defaultlar, validasyon.
5. `ProjectDepositDialogs`: kilit/snapshot UI'si, banner aksiyonları.
6. QA checklist: farklı akışları (tam kapora, kısmi, kilitleme, ekstra hizmet) manuel test senaryolarına ekleyin (`docs/manual-testing/tests/projects-manual-tests.json`).
