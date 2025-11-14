# Lumiso Feature Atlas & Yol Haritası

## Temel Kurallar
- Kaynağı olmayan özellik yok: Her maddeyi ilgili dosya, migration veya test senaryosu ile referanslıyoruz.
- Statü güncellemelerini yalnızca kodu gözden geçirip çalıştığını doğruladığımızda yapıyoruz; varsayımsal bilgi yok.
- Ayarları etkileyen değişikliklerde onboarding, vergi profili ve otomasyon tetikleyicilerine etkileri mutlaka not ediyoruz.
- Bu dosya tek gerçeklik kaynağımız; sprint sonunda veya yeni bir alanı teslim ettiğimizde status tracker'ı güncelliyoruz.

## Status Tracker (Güncel)
| Alan | Kapsam | Durum | Kanıt | Sonraki Adım |
| --- | --- | --- | --- | --- |
| Onboarding & Intake Gate | Profile Intake modal/kilit, Guided Setup, Getting Started checklist | ✅ Üretimde (manual suite `docs/manual-testing/tests/onboarding-manual-tests.json`) | `src/contexts/OnboardingContext.tsx`, `src/pages/GettingStarted.tsx` | Guided setup reset butonu + onboarding telemetrisi ekle |
| Leads & Custom Fields | Lead oluşturma, status yönetimi, custom field builder, KPI + export | ✅ Canlı, ekstra telemetri gerekiyor | `src/pages/AllLeads.tsx`, `src/components/LeadFieldsSection.tsx`, `supabase/migrations/20250820113005_...` | Lead alanları için alan türü bazlı validasyon testleri + server-side filtre API'si |
| Projects, Packages, Sessions | Project Creation Wizard (edit/overwrite), paket/servis seçimi, session planning | ⚙️ Devam, wizard edit modunda UX turu eksik | `src/features/project-creation`, `src/components/ProjectServicesSection.tsx`, `docs/session-planning-roadmap.md` | Wizard adımlarına telemetry + paket snapshot regresyon testleri |
| Finans & Ödemeler | Base price, kapora, add-on, iade, outstanding sync | ✅ Fonksiyonel fakat otomatik test eksik | `src/components/ProjectPaymentsSection.tsx`, `src/lib/payments/depositUtils.ts` | Deposit/refund için Supabase test seed'leri + rapor exportu |
| Takvim & Hatırlatıcılar | Day/Week/Month pano, session & reminder toggles, calendar sheets | ✅ Kullanımda, performans monitörü açık | `src/pages/Calendar.tsx`, `src/hooks/useOptimizedCalendarData.ts` | Mobile küçük ekran optimizasyonu + ICS export |
| Automations (Templates + Workflows + Notifications) | Template Builder, Workflow Manager, Resend tabanlı daily summary, session reminders | 🟡 Kanal başına derin QA gerekiyor | `src/pages/TemplateBuilder.tsx`, `src/pages/Workflows.tsx`, `supabase/functions/send-reminder-notifications` | Kanal bazlı smoke test listesi + workflow executor log UI |
| Auth & Güvenlik | Sign-in/up, recovery, breadcrumb telemetry, auth-hardening, destek playbook | ⚙️ Süregelen hardening | `docs/manual-testing/tests/auth-manual-tests.json`, `docs/auth-hardening-plan.md`, `docs/auth-support-playbook.md` | Auth telemetri otomasyonu + Resend callback healthchecks |
| Ayarlar & Vergi Profili | Genel ayarlar, profil, leads/projects/services, notification toggles, vergi profili, tüzel seçim | ✅ Üretimde, UI rehberi entegre | `src/pages/settings`, `src/hooks/useOrganizationTaxProfile.ts`, `docs/settings-experience-plan.md` | Tüzel profil değişikliğinde geçmiş projeleri yeniden fiyatlayacak batch planı |
| Veri & Migrasyonlar | Varsayılan status/paket seed, session type silme function, membership events | ⚙️ Süregelen | `supabase/migrations`, `supabase/functions/session-types-delete`, `docs/supabase-prod-runbook.md` | Migration diff checklist + otomatik lint pipeline |

---

## 1. Onboarding & İlk Deneyim
- **Profile Intake Gate & Modal Kilidi:** `docs/manual-testing/tests/onboarding-manual-tests.json` testleri, `Profile Intake Gate` modalının `/auth/signup` sonrasında tüm uygulamayı kilitleyip dört adımlı verileri (`display_name`, işletme adı, proje tipleri, sample data tercihi) zorunlu topladığını doğruluyor. Modal `src/contexts/OnboardingContext.tsx` ile kullanıcı ayarlarını kilitliyor; `debugIntake` parametresi QA için tekrar açıyor.
- **Manual Suite → Otomasyon Planı:** CRM-ONBOARD-101…108 senaryoları intake modal kilidi, form validasyonları ve Ayarlar senkronizasyonunu kapsıyor. Bu senaryoları Playwright/Cypress pipeline'ına taşımak için `onboarding-manual-tests.json` referans ID'lerini spec adlarıyla eşleştirip smoke suite'e eklememiz gerekiyor; öncelik CRM-ONBOARD-101 (modal kilidi) ve CRM-ONBOARD-106 (Ayarlar doğrulaması).
- **Guided Setup & Tutoriallar:** `src/components/shared/OnboardingTutorial.tsx` bileşeni Ayarlar → Profil/Genel/Services sayfalarına gömülü; `useOnboarding()` context'i guided setup aşamalarını kilitliyor, Getting Started sayfası (`src/pages/GettingStarted.tsx`) check-list sunuyor.
- **Getting Started içerikleri:** `src/pages/GettingStarted.tsx` pipeline kartları; lead ekle, proje oluştur, takvimi bağla vb. görevleri Onboarding aşamalarına bağlı gösteriyor.
- **İlk veri doğrulaması:** Intake adımlarında girilen bilgiler Settings → Profil & Genel sayfalarına taşınıyor (`docs/manual-testing/tests/onboarding...` case CRM-ONBOARD-106). Modal kapanmadan ana tablo erişimi yok.
- **Radar:** Guided setup reset butonu + onboarding aşaması telemetrisi yok; `useUserPreferences` yazma çağrıları instrument edilip `window.__lumisoOnboardingEvents` benzeri tampon planlanmalı.

## 2. Leads & CRM Temelleri
- **Lead Oluşturma & Custom Alanlar:** `src/components/EnhancedAddLeadDialog.tsx` ve `src/pages/AllLeads.tsx` lead creation dialog'u custom alan UI'ı ile birleştiriyor. Custom alan tanımları `src/components/LeadFieldsSection.tsx` + `src/hooks/useLeadFieldDefinitions.ts`; drag/drop reorder, field type (text, number, select, checkbox, date) desteği var. Değerler `lead_field_values` tablosunda (bkz. `supabase/migrations/..` seed fonksiyonları).
- **Lead Status Yönetimi:** `src/components/LeadStatusesSection.tsx` custom/lifecycle bazlı statüleri, `ensure_default_lead_statuses_for_org` migration fonksiyonu (20250820113005) default Planned/Contacted/Booked/Lost/Archived setini türetiyor. Lifecycle alanı Completed/Cancelled denge kontrolleri için toasts gösteriliyor.
- **KPI + Board görünümü:** `src/pages/AllLeads.tsx` `KpiCard` bileşenleri, `AdvancedDataTable` ile sunucuda sıralanmış (paginated) tablo, `useLeadsFilters` ile custom alan filtrasyonu, `writeFileXLSX` ile Excel export, `GlobalSearch` ile entegre.
- **Lead Detay & Aktiviteler:** `src/pages/LeadDetail.tsx`, `ProjectTodoListEnhanced` ve reminder scheduler lead tabına entegre; hatırlatıcılar `activities` tablosuna gidiyor, `Calendar` event'lerine yansıyor.
- **Radar:** Lead custom alan tipleri için backend validasyonu, mass update API'si ve telemetri (kaç filtre kaydedildi) eksik. Export formatında custom alan başlıklarının locale bazlı manipülasyonu planlanmalı.

## 3. Project, Package & Session Deneyimi
- **Project Creation Wizard (Overwrite Desteği):** `src/features/project-creation` altındaki wizard; lead, proje detayı, paket/servis, ödeme planı, teslimat ve review adımlarını tek sheet'te topluyor. `ProjectCreationWizardSheet` hem yeni kayıt hem `ProjectStagePipeline` üzerindeki “Edit” butonlarıyla overwrite modunda açılıyor (bkz. `src/components/ProjectSheetView.tsx` → `editWizardOpen`).
- **Paket & Servis Kütüphanesi:** `src/components/ProjectServicesSection.tsx`, `ProjectServicesQuickEditDialog` ve `services` tablosu; included vs. extra add-on satırları, VAT hesapları (`computeServiceTotals`) ve `ProjectPackageSnapshot` ile projeye kilitlenmiş paket görüntüsü. `supabase/migrations/*packages*` default paketleri ve line item alanlarını yönetiyor.
- **Session Types + Scheduling:** `src/components/SessionTypesSection.tsx` session type CRUD, default selection ve in-use guard'ı `supabase/functions/session-types-delete` ile enforced. `SessionSchedulingSheet` ve `SessionPlanning` roadmap dokümanları, lead/proje bağlamına göre wizard entry point'leri (bkz. `docs/session-planning-roadmap.md`).
- **Project Pano Görünümü:** `ProjectStagePipeline` bileşeni (kanban yerine pano) pipeline statuslerini oklarla gösteriyor; `useProjectStatusController` statü değişimlerini supabase'e basıyor, onboarding tooltip ile stage açıklıyor. Proje kartları `ProjectSheetView`'de unified summary, package, payments, sessions, reminders, add-on servisleri tek layout'ta.
- **Radar:** Wizard telemetry + package snapshot regression testleri, session planning wizard'ının lo-fi/hifi deliverable'ları `docs/session-planning-roadmap.md`'de planlı. Calendar entrypoints ile wizard'ın tam entegrasyonu QA bekliyor.

## 4. Finans, Ödeme Takibi & Kapora
- **Base Price & Kapora Yönetimi:** `ProjectPaymentsSection.tsx` base price editörü, `ProjectDepositDialogs` ile sabit/percent deposit ayarları (`computeDepositAmount`, `ProjectDepositConfig`). VAT modu `useOrganizationTaxProfile` ile tüzel/şahıs seçimine göre UI'da aç/kapa oluyor.
- **Ödeme Kayıt & Takibi:** Manual/scheduled payments `payments` tablosundan çekiliyor, `PAYMENT_COLORS` UI rozetleri, `IconActionButtonGroup` quick actions. `syncProjectOutstandingPayment` helper'ı outstanding amount'ı proje tablosuna yazıyor.
- **İade (Refund) Akışı:** Aynı komponentte refund dialog (`payments.refund.*` i18n) deposit'e uygulanıp uygulanmayacağını seçtiriyor; `deposit_toggle` kapora tahsilatını azaltıyor. İadeler negative entries olarak kaydediliyor ve badge renkle ayrılıyor.
- **Ek Hizmet & Add-on Fiyatlama:** Project services card, included vs. extra satırlarını VAT dahil/ hariç fiyatlıyor; `computeServiceTotals` net/vat/gross breakdown veriyor; `ProjectPackageSummaryCard` snapshot'ı hatırlatıyor.
- **Radar:** Kapora/ödeme regression testleri ve Supabase seeding planı (`docs/deposit-mini-plan.md`) hayata geçirilmeli. Ayrıca `ProjectPaymentsSection` pagination ve rapor export (CSV/PDF) bekliyor.

## 5. Takvim, Hatırlatıcılar & Günlük İş Akışı
- **Takvim Pano:** `src/pages/Calendar.tsx` day/week/month modları (SegmentedControl). `useOptimizedCalendarViewport` cihaz genişliğine göre default view'ı seçiyor; `useOptimizedTouchHandlers` swipe navigation, `useCalendarPerformanceMonitor` render sürelerini ölçüyor. Sessions + reminders toggles (localStorage) var.
- **Sheet Görünümleri:** Bir gün/aktivite seçildiğinde `ProjectSheetView` ya da `SessionSheetView` kaydırmalı panel açıyor; mobilde tam ekran (`mode='fullscreen'`).
- **Hatırlatıcılar:** To-do & reminder aktiviteleri `ProjectTodoListEnhanced` ile planlanıp calendar'a düşüyor. `supabase/functions/process-session-reminders` due olan `scheduled_session_reminders` kayıtlarını işleyip `workflow-executor`'ı tetikliyor.
- **Günlük Özet & Bildirim Ayarları:** `src/pages/settings/Notifications.tsx` global toggle, daily summary schedule (30 dk slot), `send-reminder-notifications` function'ına test çağrısı, immediate assignment notification ve project milestone tiplerini tetikleyebiliyor. `schedule-daily-notifications` edge function batch tetikleyicileri var.
- **Radar:** ICS/export, mobile timeline optimizasyonu ve reminder listesi için ana `/reminders` ekranı (şu an `ReminderDetails.tsx` legacy). Performance monitor raporları dashboard'a exposing planlanmalı.

## 6. Template Builder, Workflows & Otomasyon
- **Template Builder:** `src/pages/TemplateBuilder.tsx` e-posta/WhatsApp/SMS kanalları arasında geçiş, blok tabanlı editor (`OptimizedTemplateEditor`), inline subject & preheader editörleri, spam word check, preview dataset seçimi. `TemplateVariablesProvider` lead/proje placeholder'larını dolduruyor. Navigation guard, isim doğrulama, publish vs. save akışları var.
- **Workflow Manager:** `src/pages/Workflows.tsx` workflow listesi + KPI kartları, trigger filter, status toggles, `CreateWorkflowSheet` multi-step builder. `useWorkflows` hook Supabase `workflows` + `workflow_steps` tablosunu okuyor, channel icons (email/WhatsApp/SMS) ve delay (0–30 gün) validations var.
- **Workflow Executor & Notifications:** `supabase/functions/workflow-executor` trigger türüne göre (lead, project, session_reminder) template'leri ve kanal konfiglerini alıp `Resend` veya ilgili kanal API'sine yönlendiriyor; tarih-saat formatlaması organization settings (`date_format`, `time_format`) ile tutarlı.
- **Session Reminder Pipeline:** `process-session-reminders` due reminder'ları `workflow-executor`'a paslıyor, `scheduled_session_reminders` tablosu concurrency guard ile güncelleniyor. `send-reminder-notifications` function immediate assignment + project milestone + daily summary e-postalarını `Resend` ile gönderiyor, multi-locale template (en/tr) var.
- **Radar:** Kanal bazlı QA matrix (email/WhatsApp/SMS) henüz tamamlanmadı; workflow execution log'ları UI'ya yansımıyor. Template builder draft/publish ayrımı var ancak versiyonlama to-do. Workflow testing sandbox'ı (dry-run) planlanmalı.

## 7. Global Search, Mobil Uyumluluk & Günlük Kullanılabilirlik
- **Global Search:** `src/components/GlobalSearch.tsx` leads, projects, notes, reminders, sessions arıyor; custom field eşleşmelerini `lead_field_definitions` etiketleriyle gösteriyor. Status rozetleri preload ediliyor, keyboard navigation + `INITIAL_RESULT_COUNT` lazy load, `toast` hataları.
- **Mobil Uyumluluk:** `useIsMobile`, `ProjectSheetView` sheet/fullscreen toggle, Calendar view default'ları (`window.innerWidth` <= 768). `AppSidebar` responsive collapse, most data tables `ScrollArea` + `AdvancedDataTable` adaptörleri.
- **Project Görünümü (Pano):** `ProjectStagePipeline` + `ProjectStatusBadge` pipeline'ı; `ProjectSheetView` summary kartları (header summary, sessions summary, package summary) ile kanban yerine pano deneyimi sunuyor, `EntityHeader` metrikleri, `ProjectActivities` timeline.
- **Reminder & Daily Summary Insights:** `docs/simple-daily-notifications.md` planı, `notification-processor` function immediate teles. Günlük özetler `generateModernDailySummaryEmail` + `generateEmptyDailySummaryEmail` ile günden günde kapasiteleri raporluyor.
- **Radar:** Global search backend API'si henüz yok; client Supabase query'leri limitli. Mobil UI audit (<=375px) ve offline states backlogda.

## 8. Ayarlar, Tüzel Profil & Sistem Yapılandırmaları
- **Genel & Profil:** `src/pages/settings/General.tsx` marka adı, iletişim bilgileri, logo upload (2MB limit, `useSettingsFileUploader`), timezone/date/time formatı, `LanguageSwitcher`. `Profile.tsx` profil foto, çalışma saatleri (`useWorkingHours`), güvenlik e-postası tetikleyicisi, onboarding tutorial adımları.
- **Leads & Projects Ayarları:** Lead status + custom fields (`LeadStatusesSection`, `LeadFieldsSection`), Project status/type/session status (`src/pages/settings/Projects.tsx` + `ProjectStatusesSection`, `ProjectTypesSection`, `SessionStatusesSection`). Drag/drop reorder, default stage guard, `ensure_default_packages_for_org` seed fonksiyonları var.
- **Services, Packages, Session Types:** `src/pages/settings/Services.tsx` altındaki `SessionTypesSection`, `PackagesSection`, `ServicesSection` UI rehberi. `services_and_packages_plan.md` paylaşılan plan. `useOrganizationTaxProfile` Tüzel/Şahıs (companyName, vatExempt, legalEntityType) seçimine göre VAT UI'ı açıyor.
- **Notifications, Billing, Contracts, Danger Zone:** `Settings/Notifications.tsx` test butonları, `Settings/Billing*.tsx` plan özetleri, `Contracts.tsx` template builder ile entegre Sözleşme listesi, `DangerZone.tsx` workspace reset/ data wipe call-to-action.
- **Global Ayar Tutarlılığı:** `useSettingsCategorySection` pattern'i her sayfada consistent autosave/onsub events, `SettingsImageUploadCard` var. `docs/settings-experience-plan.md` UI rehberini tanımlıyor.
- **Radar:** Tax profile değişiminde geçmiş projelerin snapshot'ını güncelleyecek background job yok. Billing sayfasında self-serve upgrade/downgrade UI'sı placeholder. Notification settings telemetrisi toplanmalı.

## 9. Veri, Migrasyonlar & Edge Functions
- **Migration Stoğu:** `supabase/migrations` klasörü default lead/project/status/paket seed, membership events, kanban ayar kolonları, package delivery method, project package snapshot, trial membership plan, vb. Dönemsel fonksiyonlar `ensure_default_packages_for_org`, `ensure_system_lead_statuses`, `membership_events` tablosu.
- **Edge Functions:** `supabase/functions` altındaki `workflow-executor`, `send-reminder-notifications`, `process-session-reminders`, `notification-processor`, `schedule-daily-notifications`, `session-types-delete`, `send-template-email`. Ortak helper'lar `_shared` klasöründe (Resend client, i18n, error utils).
- **Edge Function Dependency Matrisi:**

| Function | Bağlı Olduğu Özellikler | Kaynak |
| --- | --- | --- |
| `workflow-executor` | Workflow tetikleyicileri, session reminder otomasyonları, project/lead assignment bildirimleri | `supabase/functions/workflow-executor/index.ts` |
| `process-session-reminders` | Calendar + Session Planning hatırlatıcıları, scheduled reminders tablosu | `supabase/functions/process-session-reminders/index.ts` |
| `send-reminder-notifications` | Notifications ayarları, daily summary ve immediate assignment/milestone e-postaları | `supabase/functions/send-reminder-notifications/index.ts` |
| `schedule-daily-notifications` | Günlük özet cron tetikleyicisi (batch halde `send-reminder-notifications`a çağrı) | `supabase/functions/schedule-daily-notifications/index.ts` |
| `notification-processor` | Workflow/CRM aktivite bildirimlerinin Resend webhook/queue işlemesi | `supabase/functions/notification-processor/index.ts` |
| `session-types-delete` | Settings → Session Types silme guard'ı (kullanımda olan tipler için hata) | `supabase/functions/session-types-delete/index.ts` |
| `send-template-email` | Template Builder canlı önizleme/test gönderileri | `supabase/functions/send-template-email/index.ts` |
| `get-users-email` | QA ve destek amaçlı kullanıcı lookup yardımcı aracı | `supabase/functions/get-users-email/index.ts` |
- **Seed & QA Yardımcıları:** `docs/seeding-after-intake.md`, `docs/intake-seeding-inventory.md` onboarding sonrası demo verisini; `supabase/seed` sample data. `get-users-email` function debug/test için var.
- **Runbook:** `docs/supabase-prod-runbook.md` deploy talimatları, `README.md` Netlify + Supabase publish notları, `packages` deploy komutları.
- **Radar:** Migration diff incelemesi manuel; otomatik lint ve apply-order kontrolü eklenmeli. Edge function monitoring (latency, failure) Sentry/Grafana planlanmalı.

## 10. QA, Test Planları & İzleme
- **Manual Test Suites:** `docs/manual-testing/tests/auth-manual-tests.json` ve `.../onboarding-manual-tests.json` login/onboarding gating senaryolarını kapsamlı şekilde listeliyor (CRM-AUTH-001..010, CRM-ONBOARD-101..108). Test Execution Tracker (`docs/test-execution-tracker.md`) runs & sonuçları loglamaya hazır.
- **Plan Dokümanları:** Session planning, package creation, settings experience, deposit mini plan vb. doc'lar (bkz. `docs/*-plan.md`) tasarım + build kararlarını izah ediyor.
- **Unit & Hook Testleri:** `src/services/__tests__/LeadDetailService.test.ts`, `src/hooks/__tests__/useKanbanSettings.test.ts`, `src/lib/paymentColors.test.ts` gibi targeted unit testler var ancak coverage sınırlı.
- **Telemetry & Debug Kancaları:** Auth sayfalarında `window.__lumisoAuthEvents`, onboarding'de benzer plan. Breadcrumb tamponları support ekibi için `docs/auth-support-playbook.md`'da anlatılıyor.
- **Radar:** CI'da JSDOM tabanlı component test suite'i (wizard steps, payments) eklenmeli. Manual test JSON'ları ile `how-to-run-tests.md` entegre rapor pipeline'ı (örn. GitHub issue template) to-do.

## 11. Güvenlik, Auth & Destek
- **Auth Manual Suite:** `docs/manual-testing/tests/auth-manual-tests.json` CRM-AUTH-001…010 aralığında sign-in, kayıt, recovery, breadcrumb telemetri ve Resend e-postalarını doğruluyor. `Auth - Temel Giriş / Kayıt` ve `Auth - Kurtarma & Şifre Yönetimi` bölümlerini otomatikleştirmek için Playwright spec'lerinde aynı ID'leri kullanarak smoke suite'e ekleyip CI'da nightly koşulması planlanmalı.
- **Hardening Yol Haritası:** `docs/auth-hardening-plan.md` brute-force koruması, bot tespiti, session fixation önlemleri ve MFA hazırlık görevlerini listeliyor. Roadmap'e göre env toggle'ları, rate limit log'ları ve secret rotation adımları Supabase policy güncellemeleriyle aynı jalonda ilerlemeli.
- **Destek Playbook'u:** `docs/auth-support-playbook.md` destek ekibine breadcrumb dump'ı, Resend log'ları ve Supabase admin panelinden kullanıcı onay akışlarını nasıl yöneteceklerini anlatıyor. Destek araçları için `window.__lumisoAuthEvents` tamponuna scrubbed e-posta + zaman damgası kayıtları tutuluyor.
- **Radar:** Resend callback healthcheck'leri, auth telemetri event'lerinin Sentry/Amplitude eşitlemesi ve kurtarma e-postası throttling'i henüz uygulanmadı; bu öğeler status tracker'daki “Auth & Güvenlik” satırındaki aksiyon listesiyle eşleştirilmeli.

---

Bu dosya, Lumiso CRM'in uçtan uca özellik setini ve hangi alanın hangi seviyede olduğunu tek kaynakta tutar. Bir sonraki güncellemede status tablosunu ve ilgili bölümleri yeni kanıtlarla güncelleyerek ilerleyelim.
