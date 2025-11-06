# Test Execution Tracker

- Last updated: 2025-11-06 13:24 UTC
- Total tests: 233 (Jest: 221, Deno: 12)

## How to Use
- Execute each test sequentially from the table below.
- Use `npx jest --runInBand <test-path>` for Jest suites unless noted otherwise.
- Use `deno test <test-path>` (or `deno task test` for full Supabase coverage) for Deno suites.
- Update the `Status` and `Notes` columns after each run (examples: Passed, Failed, Stalled, Needs fix).

## Test Inventory
| # | Runner | Test Path | Status | Notes |
| - | - | - | - | - |
| ✅ 1 | jest | `src/components/__tests__/ActivityForm.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ActivityForm.test.tsx` ✅ |
| ✅ 2 | jest | `src/components/__tests__/ActivitySection.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ActivitySection.test.tsx` ✅ |
| ✅ 3 | jest | `src/components/__tests__/ActivityTimeline.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ActivityTimeline.test.tsx` ✅ |
| ✅ 4 | jest | `src/components/__tests__/ActivityTimelineItem.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ActivityTimelineItem.test.tsx` ✅ |
| ✅ 5 | jest | `src/components/__tests__/AddLeadDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/AddLeadDialog.test.tsx` ✅ |
| ✅ 6 | jest | `src/components/__tests__/AddPaymentDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/AddPaymentDialog.test.tsx` ✅ |
| ✅ 7 | jest | `src/components/__tests__/AppSidebar.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/AppSidebar.test.tsx` ✅ |
| ✅ 8 | jest | `src/components/__tests__/BaseOnboardingModal.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/BaseOnboardingModal.test.tsx` ✅ |
| ✅ 9 | jest | `src/components/__tests__/CalendarTimePicker.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/CalendarTimePicker.test.tsx` ✅ |
| ✅ 10 | jest | `src/components/__tests__/CreateWorkflowSheet.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/CreateWorkflowSheet.test.tsx` ✅ |
| ✅ 11 | jest | `src/components/__tests__/DeadSimpleSessionBanner.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/DeadSimpleSessionBanner.test.tsx` ✅ |
| ✅ 12 | jest | `src/components/__tests__/EditLeadDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/EditLeadDialog.test.tsx` ✅ |
| ✅ 13 | jest | `src/components/__tests__/EditPaymentDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/EditPaymentDialog.test.tsx` ✅ |
| ✅ 14 | jest | `src/components/__tests__/EnhancedAddLeadDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/EnhancedAddLeadDialog.test.tsx` ✅ |
| ✅ 15 | jest | `src/components/__tests__/EnhancedEditLeadDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/EnhancedEditLeadDialog.test.tsx` ✅ |
| ✅ 16 | jest | `src/components/__tests__/EnhancedSessionsSection.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/EnhancedSessionsSection.test.tsx` ✅ |
| ✅ 17 | jest | `src/components/__tests__/ErrorBoundary.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ErrorBoundary.test.tsx` ✅ |
| ✅ 18 | jest | `src/components/__tests__/ExitGuidanceModeButton.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ExitGuidanceModeButton.test.tsx` ✅ |
| ✅ 19 | jest | `src/components/__tests__/FilterBar.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/FilterBar.test.tsx` ✅ |
| ✅ 20 | jest | `src/components/__tests__/GlobalSearch.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/GlobalSearch.test.tsx` ✅ |
| ✅ 21 | jest | `src/components/__tests__/GuidedStepProgress.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/GuidedStepProgress.test.tsx` ✅ |
| ✅ 22 | jest | `src/components/__tests__/LanguageSwitcher.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/LanguageSwitcher.test.tsx` ✅ |
| ✅ 23 | jest | `src/components/__tests__/LeadActivitySection.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/LeadActivitySection.test.tsx` ✅ |
| ✅ 24 | jest | `src/components/__tests__/MobileStickyNav.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/MobileStickyNav.test.tsx` ✅ |
| ✅ 25 | jest | `src/components/__tests__/OfflineBanner.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/OfflineBanner.test.tsx` ✅ |
| ✅ 26 | jest | `src/components/__tests__/OnboardingModal.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/OnboardingModal.test.tsx` ✅ |
| ✅ 27 | jest | `src/components/__tests__/OnboardingTutorial.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/OnboardingTutorial.test.tsx` ✅ |
| ❌ 28 | jest | `src/components/__tests__/PerformanceMonitor.test.tsx` | ❌ Failed | Invalid hook call (`useRef`) when rendering component; needs provider/test setup fix |
| ✅ 29 | jest | `src/components/__tests__/ProjectActivitySection.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ProjectActivitySection.test.tsx` ✅ |
| ✅ 30 | jest | `src/components/__tests__/ProjectKanbanBoard.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ProjectKanbanBoard.test.tsx` ✅ |
| ❌ 31 | jest | `src/components/__tests__/ProjectPaymentsSection.test.tsx` | ❌ Failed | Missing copy for `payments.services.none` expectation; localization stub? |
| ❌ 32 | jest | `src/components/__tests__/ProjectServicesSection.test.tsx` | ❌ Failed | `scrollIntoView` not supported in jsdom; adjust test or guard + insert args mismatch |
| ✅ 33 | jest | `src/components/__tests__/ProjectSheetPreview.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ProjectSheetPreview.test.tsx` ✅ |
| ✅ 34 | jest | `src/components/__tests__/ProjectSheetView.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ProjectSheetView.test.tsx` ✅ |
| ✅ 35 | jest | `src/components/__tests__/ProtectedRoute.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ProtectedRoute.test.tsx` ✅ |
| ✅ 36 | jest | `src/components/__tests__/ReminderCard.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ReminderCard.test.tsx` ✅ |
| ✅ 37 | jest | `src/components/__tests__/RestartGuidedModeButton.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/RestartGuidedModeButton.test.tsx` ✅ |
| ✅ 38 | jest | `src/components/__tests__/RoutePrefetcher.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/RoutePrefetcher.test.tsx` ✅ |
| ✅ 39 | jest | `src/components/__tests__/SampleDataModal.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/SampleDataModal.test.tsx` ✅ |
| ✅ 40 | jest | `src/components/__tests__/ScheduleSessionDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/ScheduleSessionDialog.test.tsx` ✅ |
| ❌ 41 | jest | `src/components/__tests__/ServiceInventorySelector.test.tsx` | ❌ Failed | Failing queries for group toggles (Crew/Equipment buttons not found) |
| ✅ 42 | jest | `src/components/__tests__/SessionBanner.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/SessionBanner.test.tsx` ✅ |
| ✅ 43 | jest | `src/components/__tests__/SessionFormFields.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/SessionFormFields.test.tsx` ✅ |
| ✅ 44 | jest | `src/components/__tests__/SessionSchedulingSheet.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/SessionSchedulingSheet.test.tsx` ✅ |
| ✅ 45 | jest | `src/components/__tests__/SessionStatusBadge.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/SessionStatusBadge.test.tsx` ✅ |
| ✅ 46 | jest | `src/components/__tests__/SessionTypesSection.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/SessionTypesSection.test.tsx` ✅ |
| ✅ 47 | jest | `src/components/__tests__/SessionsSection.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/SessionsSection.test.tsx` ✅ |
| ✅ 48 | jest | `src/components/__tests__/TimeSlotPicker.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/TimeSlotPicker.test.tsx` ✅ |
| ✅ 49 | jest | `src/components/__tests__/TimezoneSelector.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/TimezoneSelector.test.tsx` ✅ |
| ✅ 50 | jest | `src/components/__tests__/TruncatedTextWithTooltip.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/TruncatedTextWithTooltip.test.tsx` ✅ |
| ✅ 51 | jest | `src/components/__tests__/TutorialExitGuardDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/TutorialExitGuardDialog.test.tsx` ✅ |
| ✅ 52 | jest | `src/components/__tests__/TutorialFloatingCard.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/TutorialFloatingCard.test.tsx` ✅ |
| ✅ 53 | jest | `src/components/__tests__/UnifiedClientDetails.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/UnifiedClientDetails.test.tsx` ✅ |
| ✅ 54 | jest | `src/components/__tests__/UserMenu.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/UserMenu.test.tsx` ✅ |
| ✅ 55 | jest | `src/components/__tests__/WeeklySchedulePreview.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/WeeklySchedulePreview.test.tsx` ✅ |
| ✅ 56 | jest | `src/components/__tests__/WorkflowDeleteDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/WorkflowDeleteDialog.test.tsx` ✅ |
| ✅ 57 | jest | `src/components/__tests__/WorkflowHealthDashboard.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/__tests__/WorkflowHealthDashboard.test.tsx` ✅ |
| ✅ 58 | jest | `src/components/calendar/__tests__/CalendarDay.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/calendar/__tests__/CalendarDay.test.tsx` ✅ (DOM nesting warning) |
| ✅ 59 | jest | `src/components/calendar/__tests__/CalendarDayView.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/calendar/__tests__/CalendarDayView.test.tsx` ✅ |
| ✅ 60 | jest | `src/components/calendar/__tests__/CalendarErrorBoundary.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/calendar/__tests__/CalendarErrorBoundary.test.tsx` ✅ |
| ✅ 61 | jest | `src/components/calendar/__tests__/CalendarMonthView.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/calendar/__tests__/CalendarMonthView.test.tsx` ✅ |
| ✅ 62 | jest | `src/components/calendar/__tests__/CalendarSkeleton.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/calendar/__tests__/CalendarSkeleton.test.tsx` ✅ |
| ✅ 63 | jest | `src/components/calendar/__tests__/CalendarWeek.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/calendar/__tests__/CalendarWeek.test.tsx` ✅ |
| ⚠️ 64 | jest | `src/components/data-table/__tests__/AdvancedDataTable.test.tsx` | ⚠️ Skipped | Entire suite marked with `describe.skip`; investigate enabling tests. |
| ✅ 65 | jest | `src/components/data-table/__tests__/TableSearchInput.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/data-table/__tests__/TableSearchInput.test.tsx` ✅ |
| ✅ 66 | jest | `src/components/data-table/__tests__/useAdvancedTableSearch.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/data-table/__tests__/useAdvancedTableSearch.test.tsx` ✅ |
| ✅ 67 | jest | `src/components/data-table/__tests__/useDraftFilters.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/data-table/__tests__/useDraftFilters.test.tsx` ✅ |
| ✅ 68 | jest | `src/components/mobile/__tests__/BottomSheetMenu.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/mobile/__tests__/BottomSheetMenu.test.tsx` ✅ |
| ✅ 69 | jest | `src/components/mobile/__tests__/MobileBottomNav.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/mobile/__tests__/MobileBottomNav.test.tsx` ✅ |
| ✅ 70 | jest | `src/components/modals/__tests__/HelpModal.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/modals/__tests__/HelpModal.test.tsx` ✅ (jsdom logs a mailto navigation not implemented warning) |
| ✅ 71 | jest | `src/components/navigation/__tests__/StickySectionNav.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/navigation/__tests__/StickySectionNav.test.tsx` ✅ |
| ❌ 72 | jest | `src/components/services/__tests__/ServicesTableCard.test.tsx` | ❌ Failed | `npx jest --runInBand src/components/services/__tests__/ServicesTableCard.test.tsx` ❌ (table render lacks the em dash "—" indicator expected by the test) |
| ✅ 73 | jest | `src/components/settings/__tests__/LeadStatusDialogs.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/settings/__tests__/LeadStatusDialogs.test.tsx` ✅ |
| ✅ 74 | jest | `src/components/settings/__tests__/NavigationGuardDialog.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/settings/__tests__/NavigationGuardDialog.test.tsx` ✅ |
| ✅ 75 | jest | `src/components/settings/__tests__/PackageDialogs.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/settings/__tests__/PackageDialogs.test.tsx` ✅ |
| ✅ 76 | jest | `src/components/settings/__tests__/ProjectStageDialogs.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/settings/__tests__/ProjectStageDialogs.test.tsx` ✅ |
| ✅ 77 | jest | `src/components/settings/__tests__/ProjectTypeDialogs.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/settings/__tests__/ProjectTypeDialogs.test.tsx` ✅ |
| ⚠️ 78 | jest | `src/components/settings/__tests__/ServiceDialogs.test.tsx` | ⚠️ Skipped | Entire suite wrapped in `describe.skip`; enable tests before recording pass. |
| ✅ 79 | jest | `src/components/settings/__tests__/SessionStatusDialogs.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/settings/__tests__/SessionStatusDialogs.test.tsx` ✅ |
| ✅ 80 | jest | `src/components/settings/__tests__/SessionTypeDialogs.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/settings/__tests__/SessionTypeDialogs.test.tsx` ✅ (expected console.error when mocking failure path) |
| ✅ 81 | jest | `src/components/settings/__tests__/SettingsHelpButton.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/settings/__tests__/SettingsHelpButton.test.tsx` ✅ |
| ❌ 82 | jest | `src/components/settings/__tests__/SettingsLayout.test.tsx` | ❌ Failed | TypeError: `categoryChanges[currentPath]` undefined (needs fallback for `/settings/*` routes). |
| ✅ 83 | jest | `src/components/settings/__tests__/SettingsPageWrapper.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/settings/__tests__/SettingsPageWrapper.test.tsx` ✅ |
| ❌ 84 | jest | `src/components/settings/__tests__/SettingsStickyFooter.test.tsx` | ❌ Failed | Missing i18n translations (buttons render keys like `buttons.cancel`, breaking role queries). |
| ✅ 85 | jest | `src/components/support/__tests__/HelpOptionCard.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/support/__tests__/HelpOptionCard.test.tsx` ✅ |
| ✅ 86 | jest | `src/components/template-builder/__tests__/CompactStorageIndicator.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/CompactStorageIndicator.test.tsx` ✅ |
| ✅ 87 | jest | `src/components/template-builder/__tests__/ImageLibrarySheet.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/ImageLibrarySheet.test.tsx` ✅ |
| ✅ 88 | jest | `src/components/template-builder/__tests__/ImageUpload.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/ImageUpload.test.tsx` ✅ (logs expected upload error for failure path) |
| ✅ 89 | jest | `src/components/template-builder/__tests__/InlineEditors.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/InlineEditors.test.tsx` ✅ |
| ✅ 90 | jest | `src/components/template-builder/__tests__/StorageQuotaDisplay.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/StorageQuotaDisplay.test.tsx` ✅ |
| ✅ 91 | jest | `src/components/template-builder/__tests__/TemplateBuilderAssets.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/TemplateBuilderAssets.test.tsx` ✅ |
| ✅ 92 | jest | `src/components/template-builder/__tests__/TemplateBuilderDialogs.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/TemplateBuilderDialogs.test.tsx` ✅ |
| ✅ 93 | jest | `src/components/template-builder/__tests__/TemplateBuilderEditors.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/TemplateBuilderEditors.test.tsx` ✅ |
| ✅ 94 | jest | `src/components/template-builder/__tests__/TemplateBuilderPreview.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/TemplateBuilderPreview.test.tsx` ✅ (jsdom logs error toast path when email send fails) |
| ✅ 95 | jest | `src/components/template-builder/__tests__/TemplateBuilderStorage.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/TemplateBuilderStorage.test.tsx` ✅ |
| ✅ 96 | jest | `src/components/template-builder/__tests__/TemplatePreview.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/template-builder/__tests__/TemplatePreview.test.tsx` ✅ |
| ✅ 97 | jest | `src/components/ui/__tests__/app-sheet-modal.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/app-sheet-modal.test.tsx` ✅ |
| ✅ 98 | jest | `src/components/ui/__tests__/card.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/card.test.tsx` ✅ |
| ✅ 99 | jest | `src/components/ui/__tests__/data-table-container.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/data-table-container.test.tsx` ✅ |
| ✅ 100 | jest | `src/components/ui/__tests__/data-table.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/data-table.test.tsx` ✅ |
| ✅ 101 | jest | `src/components/ui/__tests__/date-time-picker.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/date-time-picker.test.tsx` ✅ |
| ✅ 102 | jest | `src/components/ui/__tests__/kpi-presets.test.ts` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/kpi-presets.test.ts` ✅ |
| ✅ 103 | jest | `src/components/ui/__tests__/loading-presets.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/loading-presets.test.tsx` ✅ |
| ✅ 104 | jest | `src/components/ui/__tests__/long-press-button.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/long-press-button.test.tsx` ✅ |
| ✅ 105 | jest | `src/components/ui/__tests__/page-header.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/page-header.test.tsx` ✅ |
| ✅ 106 | jest | `src/components/ui/__tests__/pagination.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/pagination.test.tsx` ✅ |
| ✅ 107 | jest | `src/components/ui/__tests__/progress-bar.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/progress-bar.test.tsx` ✅ |
| ✅ 108 | jest | `src/components/ui/__tests__/progress.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/progress.test.tsx` ✅ |
| ✅ 109 | jest | `src/components/ui/__tests__/segmented-control.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/segmented-control.test.tsx` ✅ |
| ✅ 110 | jest | `src/components/ui/__tests__/switch.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/switch.test.tsx` ✅ |
| ✅ 111 | jest | `src/components/ui/__tests__/toast.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/toast.test.tsx` ✅ |
| ✅ 112 | jest | `src/components/ui/__tests__/toaster.test.tsx` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/toaster.test.tsx` ✅ |
| ✅ 113 | jest | `src/components/ui/__tests__/use-toast.test.ts` | ✅ Passed | `npx jest --runInBand src/components/ui/__tests__/use-toast.test.ts` ✅ |
| ✅ 114 | jest | `src/contexts/__tests__/AuthContext.test.tsx` | ✅ Passed | `npx jest --runInBand src/contexts/__tests__/AuthContext.test.tsx` ✅ |
| ✅ 115 | jest | `src/contexts/__tests__/OnboardingContext.test.tsx` | ✅ Passed | `npx jest --runInBand src/contexts/__tests__/OnboardingContext.test.tsx` ✅ (logs expected provider guard error) |
| ✅ 116 | jest | `src/contexts/__tests__/OrganizationContext.test.tsx` | ✅ Passed | `npx jest --runInBand src/contexts/__tests__/OrganizationContext.test.tsx` ✅ (logs expected provider guard error) |
| ✅ 117 | jest | `src/features/package-creation/components/__tests__/PackageCreationWizard.test.tsx` | ✅ Passed | `npx jest --runInBand src/features/package-creation/components/__tests__/PackageCreationWizard.test.tsx` ✅ |
| ✅ 118 | jest | `src/features/package-creation/services/__tests__/packageCreationSnapshot.test.ts` | ✅ Passed | `npx jest --runInBand src/features/package-creation/services/__tests__/packageCreationSnapshot.test.ts` ✅ |
| ✅ 119 | jest | `src/features/package-creation/state/__tests__/packageCreationReducer.test.ts` | ✅ Passed | `npx jest --runInBand src/features/package-creation/state/__tests__/packageCreationReducer.test.ts` ✅ |
| ✅ 120 | jest | `src/features/package-creation/steps/__tests__/PricingStep.test.tsx` | ✅ Passed | `npx jest --runInBand src/features/package-creation/steps/__tests__/PricingStep.test.tsx` ✅ |
| ❌ 121 | jest | `src/features/package-creation/steps/__tests__/SummaryStep.test.tsx` | ❌ Failed | `npx jest --runInBand src/features/package-creation/steps/__tests__/SummaryStep.test.tsx` ❌ (hook requires PackageCreationProvider; SummaryStep render crashes) |
| ✅ 122 | jest | `src/features/project-creation/components/__tests__/ProjectCreationWizard.test.tsx` | ✅ Passed | `npx jest --runInBand src/features/project-creation/components/__tests__/ProjectCreationWizard.test.tsx` ✅ (React warns about act() while fetching lead definitions) |
| ✅ 123 | jest | `src/features/project-creation/components/__tests__/ProjectCreationWizardSheet.test.tsx` | ✅ Passed | `npx jest --runInBand src/features/project-creation/components/__tests__/ProjectCreationWizardSheet.test.tsx` ✅ |
| ✅ 124 | jest | `src/features/project-creation/state/__tests__/ProjectCreationReducer.test.ts` | ✅ Passed | `npx jest --runInBand src/features/project-creation/state/__tests__/ProjectCreationReducer.test.ts` ✅ |
| ✅ 125 | jest | `src/features/session-planning/components/__tests__/SessionPlanningWizardSheet.test.tsx` | ✅ Passed | `npx jest --runInBand src/features/session-planning/components/__tests__/SessionPlanningWizardSheet.test.tsx` ✅ |
| ✅ 126 | jest | `src/features/session-planning/state/__tests__/SessionPlanningProvider.integration.test.tsx` | ✅ Passed | `npx jest --runInBand src/features/session-planning/state/__tests__/SessionPlanningProvider.integration.test.tsx` ✅ |
| ✅ 127 | jest | `src/features/session-planning/state/__tests__/SessionPlanningReducer.startStep.test.ts` | ✅ Passed | `npx jest --runInBand src/features/session-planning/state/__tests__/SessionPlanningReducer.startStep.test.ts` ✅ |
| ✅ 128 | jest | `src/hooks/__tests__/use-mobile.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/use-mobile.test.tsx` ✅ |
| ✅ 129 | jest | `src/hooks/__tests__/useAccessibility.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useAccessibility.test.tsx` ✅ |
| ✅ 130 | jest | `src/hooks/__tests__/useCalendarPerformanceMonitor.test.ts` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useCalendarPerformanceMonitor.test.ts` ✅ |
| ❌ 131 | jest | `src/hooks/__tests__/useDataTable.test.tsx` | ❌ Failed | `npx jest --runInBand src/hooks/__tests__/useDataTable.test.tsx` ❌ (filtered results only include "Alice"; expected "Charlie" as well) |
| ✅ 132 | jest | `src/hooks/__tests__/useDebounce.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useDebounce.test.tsx` ✅ |
| ✅ 133 | jest | `src/hooks/__tests__/useEntityActions.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useEntityActions.test.tsx` ✅ |
| ❌ 134 | jest | `src/hooks/__tests__/useEntityData.test.tsx` | ❌ Failed | `npx jest --runInBand src/hooks/__tests__/useEntityData.test.tsx` ❌ (waitFor never sees loading=false after dependency change) |
| ✅ 135 | jest | `src/hooks/__tests__/useKanbanSettings.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useKanbanSettings.test.tsx` ✅ |
| ✅ 136 | jest | `src/hooks/__tests__/useLeadDetailData.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useLeadDetailData.test.tsx` ✅ |
| ✅ 137 | jest | `src/hooks/__tests__/useLeadStatusActions.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useLeadStatusActions.test.tsx` ✅ |
| ✅ 138 | jest | `src/hooks/__tests__/useMilestoneNotifications.test.ts` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useMilestoneNotifications.test.ts` ✅ |
| ❌ 139 | jest | `src/hooks/__tests__/useNotificationTriggers.test.ts` | ❌ Failed | `npx jest --runInBand src/hooks/__tests__/useNotificationTriggers.test.ts` ❌ (toast expectations differ from error message values) |
| ✅ 140 | jest | `src/hooks/__tests__/useOrganizationData.test.ts` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useOrganizationData.test.ts` ✅ |
| ✅ 141 | jest | `src/hooks/__tests__/useOrganizationQuickSettings.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useOrganizationQuickSettings.test.tsx` ✅ |
| ✅ 142 | jest | `src/hooks/__tests__/useOrganizationSettings.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useOrganizationSettings.test.tsx` ✅ |
| ✅ 143 | jest | `src/hooks/__tests__/useOrganizationTimezone.test.ts` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useOrganizationTimezone.test.ts` ✅ |
| ✅ 144 | jest | `src/hooks/__tests__/useProjectPayments.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useProjectPayments.test.tsx` ✅ (logs error handling branch and refetch fallback) |
| ✅ 145 | jest | `src/hooks/__tests__/useProjectSessionsSummary.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useProjectSessionsSummary.test.tsx` ✅ (logs expected Supabase error for failure case) |
| ✅ 146 | jest | `src/hooks/__tests__/useReminderActions.test.ts` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useReminderActions.test.ts` ✅ |
| ✅ 147 | jest | `src/hooks/__tests__/useSessionActions.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useSessionActions.test.tsx` ✅ |
| ✅ 148 | jest | `src/hooks/__tests__/useSessionEditForm.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useSessionEditForm.test.tsx` ✅ |
| ✅ 149 | jest | `src/hooks/__tests__/useSessionForm.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useSessionForm.test.tsx` ✅ |
| ✅ 150 | jest | `src/hooks/__tests__/useSessionReminderScheduling.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useSessionReminderScheduling.test.tsx` ✅ |
| ❌ 151 | jest | `src/hooks/__tests__/useSettingsSection.test.ts` | ❌ Failed | `npx jest --runInBand src/hooks/__tests__/useSettingsSection.test.ts` ❌ (hangs after "Maximum update depth exceeded" loop) |
| ✅ 152 | jest | `src/hooks/__tests__/useSmartTimeRange.test.ts` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useSmartTimeRange.test.ts` ✅ |
| ✅ 153 | jest | `src/hooks/__tests__/useTemplateBuilder.test.tsx` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useTemplateBuilder.test.tsx` ✅ |
| ✅ 154 | jest | `src/hooks/__tests__/useTemplateValidation.test.ts` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useTemplateValidation.test.ts` ✅ |
| ✅ 155 | jest | `src/hooks/__tests__/useUserPreferences.test.ts` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useUserPreferences.test.ts` ✅ |
| ✅ 156 | jest | `src/hooks/__tests__/useWorkflowTriggers.test.ts` | ✅ Passed | `npx jest --runInBand src/hooks/__tests__/useWorkflowTriggers.test.ts` ✅ |
| ✅ 157 | jest | `src/integrations/supabase/__tests__/client.test.ts` | ✅ Passed | `npx jest --runInBand src/integrations/supabase/__tests__/client.test.ts` ✅ |
| ✅ 158 | jest | `src/lib/__tests__/organizationSettingsCache.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/__tests__/organizationSettingsCache.test.ts` ✅ |
| ✅ 159 | jest | `src/lib/accounting/__tests__/vat.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/accounting/__tests__/vat.test.ts` ✅ |
| ✅ 160 | jest | `src/lib/dateFormatUtils.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/dateFormatUtils.test.ts` ✅ |
| ✅ 161 | jest | `src/lib/dateUtils.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/dateUtils.test.ts` ✅ |
| ✅ 162 | jest | `src/lib/inputUtils.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/inputUtils.test.ts` ✅ |
| ✅ 163 | jest | `src/lib/leadFieldValidation.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/leadFieldValidation.test.ts` ✅ |
| ✅ 164 | jest | `src/lib/organizationUtils.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/organizationUtils.test.ts` ✅ |
| ✅ 165 | jest | `src/lib/paymentColors.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/paymentColors.test.ts` ✅ |
| ✅ 166 | jest | `src/lib/projects/buildProjectSummaryItems.test.tsx` | ✅ Passed | `npx jest --runInBand src/lib/projects/buildProjectSummaryItems.test.tsx` ✅ |
| ✅ 167 | jest | `src/lib/sessionSorting.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/sessionSorting.test.ts` ✅ |
| ✅ 168 | jest | `src/lib/sessionUtils.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/sessionUtils.test.ts` ✅ |
| ✅ 169 | jest | `src/lib/sessions/buildSessionSummaryItems.test.tsx` | ✅ Passed | `npx jest --runInBand src/lib/sessions/buildSessionSummaryItems.test.tsx` ✅ |
| ✅ 170 | jest | `src/lib/templateUtils.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/templateUtils.test.ts` ✅ |
| ✅ 171 | jest | `src/lib/utils.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/utils.test.ts` ✅ |
| ✅ 172 | jest | `src/lib/validation.test.ts` | ✅ Passed | `npx jest --runInBand src/lib/validation.test.ts` ✅ |
| ✅ 173 | jest | `src/pages/__tests__/AllLeads.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/AllLeads.test.tsx` ✅ |
| ✅ 174 | jest | `src/pages/__tests__/AllProjects.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/AllProjects.test.tsx` ✅ |
| ✅ 175 | jest | `src/pages/__tests__/Analytics.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/Analytics.test.tsx` ✅ |
| ✅ 176 | jest | `src/pages/__tests__/Auth.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/Auth.test.tsx` ✅ |
| ✅ 177 | jest | `src/pages/__tests__/Calendar.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/Calendar.test.tsx` ✅ |
| ✅ 178 | jest | `src/pages/__tests__/GettingStarted.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/GettingStarted.test.tsx` ✅ |
| ✅ 179 | jest | `src/pages/__tests__/Index.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/Index.test.tsx` ✅ |
| ✅ 180 | jest | `src/pages/__tests__/LeadDetail.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/LeadDetail.test.tsx` ✅ |
| ✅ 181 | jest | `src/pages/__tests__/NotFound.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/NotFound.test.tsx` ✅ |
| ✅ 182 | jest | `src/pages/__tests__/Payments.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/Payments.test.tsx` ✅ (React act() warning logs when toggling export state) |
| ✅ 183 | jest | `src/pages/__tests__/ProjectDetail.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/ProjectDetail.test.tsx` ✅ |
| ✅ 184 | jest | `src/pages/__tests__/ReminderDetails.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/ReminderDetails.test.tsx` ✅ |
| ✅ 185 | jest | `src/pages/__tests__/SessionDetail.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/SessionDetail.test.tsx` ✅ (console logs noisy fetch lifecycle + expected failure toast) |
| ✅ 186 | jest | `src/pages/__tests__/TemplateBuilder.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/TemplateBuilder.test.tsx` ✅ |
| ✅ 187 | jest | `src/pages/__tests__/Templates.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/Templates.test.tsx` ✅ |
| ✅ 188 | jest | `src/pages/__tests__/UpcomingSessions.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/UpcomingSessions.test.tsx` ✅ |
| ✅ 189 | jest | `src/pages/__tests__/Workflows.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/__tests__/Workflows.test.tsx` ✅ |
| ✅ 190 | jest | `src/pages/admin/__tests__/Localization.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/admin/__tests__/Localization.test.tsx` ✅ |
| ✅ 191 | jest | `src/pages/admin/__tests__/System.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/admin/__tests__/System.test.tsx` ✅ |
| ✅ 192 | jest | `src/pages/admin/__tests__/Users.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/admin/__tests__/Users.test.tsx` ✅ |
| ✅ 193 | jest | `src/pages/leads/hooks/__tests__/useLeadsFilters.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/leads/hooks/__tests__/useLeadsFilters.test.tsx` ✅ (React logs DOM property warning when rendering config node wrapper) |
| ✅ 194 | jest | `src/pages/payments/components/__tests__/PaymentsDateControls.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/payments/components/__tests__/PaymentsDateControls.test.tsx` ✅ |
| ✅ 195 | jest | `src/pages/payments/components/__tests__/PaymentsMetricsSummary.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/payments/components/__tests__/PaymentsMetricsSummary.test.tsx` ✅ |
| ✅ 196 | jest | `src/pages/payments/components/__tests__/PaymentsTableSection.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/payments/components/__tests__/PaymentsTableSection.test.tsx` ✅ |
| ✅ 197 | jest | `src/pages/payments/components/__tests__/PaymentsTrendChart.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/payments/components/__tests__/PaymentsTrendChart.test.tsx` ✅ |
| ✅ 198 | jest | `src/pages/payments/hooks/__tests__/usePaymentsData.test.ts` | ✅ Passed | `npx jest --runInBand src/pages/payments/hooks/__tests__/usePaymentsData.test.ts` ✅ |
| ✅ 199 | jest | `src/pages/payments/hooks/__tests__/usePaymentsFilters.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/payments/hooks/__tests__/usePaymentsFilters.test.tsx` ✅ |
| ✅ 200 | jest | `src/pages/payments/hooks/__tests__/usePaymentsTableColumns.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/payments/hooks/__tests__/usePaymentsTableColumns.test.tsx` ✅ |
| ✅ 201 | jest | `src/pages/projects/hooks/__tests__/useProjectsFilters.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/projects/hooks/__tests__/useProjectsFilters.test.tsx` ✅ |
| ✅ 202 | jest | `src/pages/settings/__tests__/Account_old.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/settings/__tests__/Account_old.test.tsx` ✅ (logs working hours mock data while updating toggle) |
| ⏳ 203 | jest | `src/pages/settings/__tests__/Billing.test.tsx` | ⏳ Stalled | `npx jest --runInBand src/pages/settings/__tests__/Billing.test.tsx` ⏳ (run hangs indefinitely even with --detectOpenHandles; aborted manually) |
| ✅ 204 | jest | `src/pages/settings/__tests__/Contracts.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/settings/__tests__/Contracts.test.tsx` ✅ |
| ✅ 205 | jest | `src/pages/settings/__tests__/DangerZone.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/settings/__tests__/DangerZone.test.tsx` ✅ |
| ✅ 206 | jest | `src/pages/settings/__tests__/General.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/settings/__tests__/General.test.tsx` ✅ |
| ✅ 207 | jest | `src/pages/settings/__tests__/Leads.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/settings/__tests__/Leads.test.tsx` ✅ |
| ✅ 208 | jest | `src/pages/settings/__tests__/Notifications.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/settings/__tests__/Notifications.test.tsx` ✅ |
| ✅ 209 | jest | `src/pages/settings/__tests__/Profile.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/settings/__tests__/Profile.test.tsx` ✅ |
| ✅ 210 | jest | `src/pages/settings/__tests__/Projects.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/settings/__tests__/Projects.test.tsx` ✅ |
| ✅ 211 | jest | `src/pages/settings/__tests__/Services.test.tsx` | ✅ Passed | `npx jest --runInBand src/pages/settings/__tests__/Services.test.tsx` ✅ (console logs tutorial navigation from component) |
| ✅ 212 | jest | `src/services/__tests__/BaseEntityService.test.ts` | ✅ Passed | `npx jest --runInBand src/services/__tests__/BaseEntityService.test.ts` ✅ |
| ✅ 213 | jest | `src/services/__tests__/LeadDetailService.test.ts` | ✅ Passed | `npx jest --runInBand src/services/__tests__/LeadDetailService.test.ts` ✅ |
| ✅ 214 | jest | `src/services/__tests__/LeadService.test.ts` | ✅ Passed | `npx jest --runInBand src/services/__tests__/LeadService.test.ts` ✅ |
| ✅ 215 | jest | `src/services/__tests__/ProjectService.test.ts` | ✅ Passed | `npx jest --runInBand src/services/__tests__/ProjectService.test.ts` ✅ |
| ✅ 216 | jest | `src/services/__tests__/SessionService.test.ts` | ✅ Passed | `npx jest --runInBand src/services/__tests__/SessionService.test.ts` ✅ |
| ✅ 217 | jest | `src/utils/authUtils.test.ts` | ✅ Passed | `npx jest --runInBand src/utils/authUtils.test.ts` ✅ |
| ✅ 218 | jest | `src/utils/entityUtils.test.ts` | ✅ Passed | `npx jest --runInBand src/utils/entityUtils.test.ts` ✅ |
| ✅ 219 | jest | `src/utils/onboardingCleanup.test.ts` | ✅ Passed | `npx jest --runInBand src/utils/onboardingCleanup.test.ts` ✅ |
| ✅ 220 | jest | `src/utils/onboardingValidation.test.ts` | ✅ Passed | `npx jest --runInBand src/utils/onboardingValidation.test.ts` ✅ |
| ✅ 221 | jest | `src/utils/performance.test.tsx` | ✅ Passed | `npx jest --runInBand src/utils/performance.test.tsx` ✅ |
| ⚠️ 222 | deno | `supabase/functions/tests/email-i18n.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/email-i18n.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 223 | deno | `supabase/functions/tests/get-users-email.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/get-users-email.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 224 | deno | `supabase/functions/tests/harness_smoke.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/harness_smoke.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 225 | deno | `supabase/functions/tests/notification-processor.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/notification-processor.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 226 | deno | `supabase/functions/tests/process-session-reminders.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/process-session-reminders.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 227 | deno | `supabase/functions/tests/schedule-daily-notifications.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/schedule-daily-notifications.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 228 | deno | `supabase/functions/tests/send-reminder-notifications.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/send-reminder-notifications.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 229 | deno | `supabase/functions/tests/send-template-email.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/send-template-email.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 230 | deno | `supabase/functions/tests/session-types-delete.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/session-types-delete.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 231 | deno | `supabase/functions/tests/simple-daily-notifications.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/simple-daily-notifications.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 232 | deno | `supabase/functions/tests/test-callback.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/test-callback.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |
| ⚠️ 233 | deno | `supabase/functions/tests/workflow-executor.test.ts` | ⚠️ Blocked | `deno test supabase/functions/tests/workflow-executor.test.ts` ⚠️ (Deno CLI not available in environment; install Deno to execute) |

## Next Actions
- Kick off execution with row 1 and continue sequentially to maintain a clear audit trail.
- Update the `Status` and `Notes` columns immediately after each run to capture pass/fail/stall outcomes.
- Log any remediation ideas or blockers in the `Notes` column for quick follow-up fixes.
