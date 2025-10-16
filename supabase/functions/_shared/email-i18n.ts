type EmailLanguage = 'en' | 'tr';

type EmailTranslationNode =
  | string
  | string[]
  | { [key: string]: EmailTranslationNode };

interface EmailLocalization {
  language: EmailLanguage;
  t: (key: string, variables?: Record<string, unknown>) => string;
  list: (key: string, variables?: Record<string, unknown>) => string[];
  raw: (key: string) => EmailTranslationNode | undefined;
}

const DEFAULT_LANGUAGE: EmailLanguage = 'en';

const EMAIL_TRANSLATIONS: Record<EmailLanguage, EmailTranslationNode> = {
  en: {
    common: {
      labels: {
        client: 'Client',
        project: 'Project',
        status: 'Status',
        projectNotes: 'Project Notes',
        leadNotes: 'Lead Notes',
        type: 'Type',
        notes: 'Notes',
      },
      actions: {
        view: 'View',
        viewOverdueItems: 'View overdue items',
        viewPastSessions: 'View past sessions',
        viewProjectDetails: 'View Project Details',
        viewLeadDetails: 'View Lead Details',
      },
      cta: {
        dashboard: 'Dashboard',
        leads: 'Leads',
        projects: 'Projects',
        sessions: 'Sessions',
      },
      badges: {
        today: 'Today',
      },
      prepositions: {
        at: 'at',
      },
      footer: {
        notice: 'This is an automated notification from {{businessName}}.',
        reason:
          "You're receiving this because you have notifications enabled in your account settings.",
      },
      alt: {
        logo: '{{businessName}} logo',
      },
      motivational: {
        emptyDay: [
          'Every quiet day is a chance to build the future. Use this time wisely! 🌟',
          "No sessions today? Perfect opportunity to nurture your business growth! 💪",
          "Great photographers use downtime to create opportunities. Today's your day! ✨",
          "Success isn't just about busy days - it's about making every day count! 🎯",
          "Today's focus time: grow your business, connect with leads, plan your success! 🚀",
        ],
      },
    },
    dailySummary: {
      subject: {
        defaultWithData: 'Your Daily Summary',
        defaultEmpty: 'Daily Summary - Nothing scheduled today',
        brandedWithData: '📅 Daily Summary - {{date}}',
        brandedEmpty: '🌅 Fresh Start Today - {{date}}',
      },
      modern: {
        pageTitle: '📊 Daily Summary - {{date}}',
        headerTitle: 'Daily Summary',
        headerSubtitle:
          "Here's your daily summary for <strong>{{date}}</strong>",
        stats: {
          sessions: "Today's Sessions",
          reminders: 'Reminders',
          overdue: 'Overdue',
          past: 'Past',
        },
        sections: {
          sessionsTitle: "Today's Sessions ({{count}})",
          remindersTitle: "Today's Reminders ({{count}})",
          defaultSessionName: 'Photography Session',
        },
        messages: {
          overdueOne: 'You have <strong>1</strong> overdue item that needs attention.',
          overdueOther:
            'You have <strong>{{count}}</strong> overdue items that need attention.',
          pastOne: 'You have <strong>1</strong> past session that needs action.',
          pastOther:
            'You have <strong>{{count}}</strong> past sessions that need action.',
        },
        links: {
          overdue: 'View overdue items',
          pastSessions: 'View past sessions',
        },
        quickActionsTitle: 'Quick Actions',
      },
      empty: {
        pageTitle: '🌅 Fresh Start Today - {{date}}',
        headerTitle: 'Fresh Start Today!',
        headerSubtitle:
          "Today's a perfect opportunity to grow your photography business - <strong>{{date}}</strong>",
        stats: {
          sessions: "Today's Sessions",
          reminders: "Today's Reminders",
          overdue: 'Overdue Items',
          past: 'Past Sessions',
        },
        tipsTitle: '💡 Make Today Count - Business Growth Tips',
        tips: [
          {
            title: '📞 Follow Up with Leads',
            description:
              "Review your lead pipeline and reach out to prospects who haven't responded. A friendly follow-up can convert interest into bookings.",
          },
          {
            title: '📋 Organize Your Projects',
            description:
              'Update project statuses, organize upcoming sessions, and ensure all client deliverables are on track.',
          },
          {
            title: '💰 Review Packages & Pricing',
            description:
              'Perfect time to evaluate your service packages, adjust pricing for the season, and create new offerings that attract clients.',
          },
          {
            title: '📸 Plan Your Marketing',
            description:
              'Create content for social media, reach out to past clients for referrals, or plan your next promotional campaign.',
          },
        ],
        messages: {
          overdueOne:
            "Don't forget: You have <strong>1</strong> overdue item that needs attention.",
          overdueOther:
            "Don't forget: You have <strong>{{count}}</strong> overdue items that need attention.",
          pastOne:
            'Follow up needed: You have <strong>1</strong> past session that needs action.',
          pastOther:
            'Follow up needed: You have <strong>{{count}}</strong> past sessions that need action.',
        },
        motivationalKey: 'common.motivational.emptyDay',
      },
    },
    immediate: {
      header: {
        projectAssignment: {
          title: 'New Project Assignment',
          subtitle: '{{name}} assigned you to a project',
        },
        leadAssignment: {
          title: 'New Lead Assignment',
          subtitle: '{{name}} assigned you to a lead',
        },
        projectMilestone: {
          title: 'Project Milestone Reached',
          subtitleCompleted:
            "{{name}} completed a project you're assigned to",
          subtitleCancelled:
            "{{name}} cancelled a project you're assigned to",
        },
      },
      sections: {
        projectDetails: 'Project Details',
        leadDetails: 'Lead Details',
        projectUpdate: 'Project Update',
        statusUpdate: 'Status Update',
      },
      cards: {
        projectNotes: 'Project Notes',
        leadNotes: 'Lead Notes',
        status: 'Status',
        client: 'Client',
        project: 'Project',
        lead: 'Lead',
      },
      callToAction: {
        project: 'View Project Details',
        lead: 'View Lead Details',
      },
      footer: {
        projectAssignment:
          '📋 You have been assigned to this project. Check the details and get started!',
        leadAssignment:
          '👤 You have been assigned to this lead. Time to make contact and move forward!',
        projectMilestoneCompleted:
          '🎊 Congratulations on reaching this milestone! Great work by the team.',
        projectMilestoneCancelled:
          '📋 This project status has been updated. Check the project details for more information.',
      },
      subject: {
        projectAssignment: '📋 New Assignment: {{name}}',
        leadAssignment: '👤 New Assignment: {{name}}',
        projectMilestoneCompleted: '🎉 Project Completed: {{name}}',
        projectMilestoneCancelled: '⚠️ Project Cancelled: {{name}}',
      },
    },
    samples: {
      dailySummary: {
        projectType: 'Wedding',
        projectName: 'Sunset Wedding',
        sessionNotes: 'Prepare warm-toned presets before the shoot.',
        sessionLocation: 'Downtown studio',
        clientName: 'Emily Carter',
        reminderContent: 'Send the mood board to the couple.',
        overdueContent: 'Deliver the gallery to the Rivera family.',
        pastSessionProjectName: 'Rivera Family Session',
        pastSessionClientName: 'Rivera Family',
      },
      immediate: {
        triggeredByName: 'Aylin Korkmaz',
        projectName: 'Spring Garden Wedding',
        projectType: 'Wedding',
        projectNotes: 'Plan golden hour portraits on the venue terrace.',
        leadName: 'Elif Kaya',
        oldStatus: 'Editing',
        newStatusCompleted: 'Completed',
        newStatusCancelled: 'Cancelled',
        leadNotes: 'Prefers email communication.',
      },
    },
  },
  tr: {
    common: {
      labels: {
        client: 'Müşteri',
        project: 'Proje',
        status: 'Durum',
        projectNotes: 'Proje Notları',
        leadNotes: 'Aday Notları',
        type: 'Tür',
        notes: 'Notlar',
      },
      actions: {
        view: 'Görüntüle',
        viewOverdueItems: 'Geciken öğeleri görüntüle',
        viewPastSessions: 'Geçmiş seansları görüntüle',
        viewProjectDetails: 'Proje detaylarını gör',
        viewLeadDetails: 'Aday detaylarını gör',
      },
      cta: {
        dashboard: 'Panel',
        leads: 'Adaylar',
        projects: 'Projeler',
        sessions: 'Seanslar',
      },
      badges: {
        today: 'Bugün',
      },
      prepositions: {
        at: 'saat',
      },
      footer: {
        notice:
          'Bu, {{businessName}} tarafından gönderilen otomatik bir bildiridir.',
        reason:
          'Hesap ayarlarınızda bildirimleri etkinleştirdiğiniz için bu e-postayı alıyorsunuz.',
      },
      alt: {
        logo: '{{businessName}} logosu',
      },
      motivational: {
        emptyDay: [
          'Sessiz geçen her gün geleceği inşa etmek için bir fırsattır. Bu zamanı iyi kullanın! 🌟',
          'Bugün seans yok mu? İşinizi büyütmek için harika bir fırsat! 💪',
          'Harika fotoğrafçılar boş zamanı fırsata çevirir. Bugün sizin gününüz! ✨',
          'Başarı yalnızca yoğun günlerle değil, her günü değerli kılmakla gelir! 🎯',
          'Bugün odak gününüz: işinizi büyütün, adaylarla iletişime geçin, başarınızı planlayın! 🚀',
        ],
      },
    },
    dailySummary: {
      subject: {
        defaultWithData: 'Günlük Özetiniz',
        defaultEmpty: 'Günlük Özet - Bugün planlanan bir şey yok',
        brandedWithData: '📅 Günlük Özet - {{date}}',
        brandedEmpty: '🌅 Bugün Taze Bir Başlangıç - {{date}}',
      },
      modern: {
        pageTitle: '📊 Günlük Özet - {{date}}',
        headerTitle: 'Günlük Özet',
        headerSubtitle:
          'Bugünün özetini sizin için hazırladık: <strong>{{date}}</strong>',
        stats: {
          sessions: 'Bugünkü Seanslar',
          reminders: 'Hatırlatmalar',
          overdue: 'Gecikenler',
          past: 'Geçmiş',
        },
        sections: {
          sessionsTitle: 'Bugünkü Seanslar ({{count}})',
          remindersTitle: 'Bugünkü Hatırlatmalar ({{count}})',
          defaultSessionName: 'Fotoğraf Çekimi',
        },
        messages: {
          overdueOne:
            'Dikkat edilmesi gereken <strong>1</strong> gecikmiş öğeniz var.',
          overdueOther:
            'Dikkat edilmesi gereken <strong>{{count}}</strong> gecikmiş öğeniz var.',
          pastOne:
            'Aksiyon almanız gereken <strong>1</strong> geçmiş seansınız var.',
          pastOther:
            'Aksiyon almanız gereken <strong>{{count}}</strong> geçmiş seansınız var.',
        },
        links: {
          overdue: 'Geciken öğeleri görüntüle',
          pastSessions: 'Geçmiş seansları görüntüle',
        },
        quickActionsTitle: 'Hızlı İşlemler',
      },
      empty: {
        pageTitle: '🌅 Bugün Taze Bir Başlangıç - {{date}}',
        headerTitle: 'Güne Taze Bir Başlangıç!',
        headerSubtitle:
          'Fotoğraf işinizi büyütmek için harika bir gün - <strong>{{date}}</strong>',
        stats: {
          sessions: 'Bugünkü Seanslar',
          reminders: 'Bugünkü Hatırlatmalar',
          overdue: 'Geciken Öğeler',
          past: 'Geçmiş Seanslar',
        },
        tipsTitle: '💡 Bugünü Verimli Kullanın - İşinizi Büyütecek İpuçları',
        tips: [
          {
            title: '📞 Adaylarla Yeniden İletişime Geçin',
            description:
              "Aday listenizi gözden geçirin ve henüz dönüş yapmayan kişilerle iletişime geçin. Samimi bir takip dönüşü rezervasyona çevirebilir.",
          },
          {
            title: '📋 Projelerinizi Düzenleyin',
            description:
              'Proje durumlarını güncelleyin, yaklaşan seansları organize edin ve tüm teslimlerin yolunda olduğundan emin olun.',
          },
          {
            title: '💰 Paket ve Fiyatlarınızı Gözden Geçirin',
            description:
              'Hizmet paketlerinizi değerlendirmek, sezonluk fiyat düzenlemeleri yapmak ve yeni teklifler oluşturmak için harika bir zaman.',
          },
          {
            title: '📸 Pazarlama Planınızı Hazırlayın',
            description:
              'Sosyal medya için içerik oluşturun, eski müşterilerden referans isteyin veya bir sonraki kampanyanızı planlayın.',
          },
        ],
        messages: {
          overdueOne:
            'Unutmayın: Dikkat edilmesi gereken <strong>1</strong> gecikmiş öğeniz var.',
          overdueOther:
            'Unutmayın: Dikkat edilmesi gereken <strong>{{count}}</strong> gecikmiş öğeniz var.',
          pastOne:
            'Takip gerekli: Aksiyon almanız gereken <strong>1</strong> geçmiş seansınız var.',
          pastOther:
            'Takip gerekli: Aksiyon almanız gereken <strong>{{count}}</strong> geçmiş seansınız var.',
        },
        motivationalKey: 'common.motivational.emptyDay',
      },
    },
    immediate: {
      header: {
        projectAssignment: {
          title: 'Yeni Proje Ataması',
          subtitle: '{{name}} sizi bir projeye atadı',
        },
        leadAssignment: {
          title: 'Yeni Aday Ataması',
          subtitle: '{{name}} sizi bir adaya atadı',
        },
        projectMilestone: {
          title: 'Proje Kilometre Taşı Tamamlandı',
          subtitleCompleted:
            '{{name}} sorumlu olduğunuz bir projeyi tamamladı',
          subtitleCancelled:
            '{{name}} sorumlu olduğunuz bir projeyi iptal etti',
        },
      },
      sections: {
        projectDetails: 'Proje Detayları',
        leadDetails: 'Aday Detayları',
        projectUpdate: 'Proje Güncellemesi',
        statusUpdate: 'Durum Güncellemesi',
      },
      cards: {
        projectNotes: 'Proje Notları',
        leadNotes: 'Aday Notları',
        status: 'Durum',
        client: 'Müşteri',
        project: 'Proje',
        lead: 'Aday',
      },
      callToAction: {
        project: 'Proje detaylarını gör',
        lead: 'Aday detaylarını gör',
      },
      footer: {
        projectAssignment:
          '📋 Bu projeye atandınız. Detaylara göz atıp hemen başlayın!',
        leadAssignment:
          '👤 Bu adaya atandınız. İletişime geçip süreci ilerletme zamanı!',
        projectMilestoneCompleted:
          '🎊 Bu kilometre taşına ulaştığınız için tebrikler! Harika bir iş çıkardınız.',
        projectMilestoneCancelled:
          '📋 Bu projenin durumu güncellendi. Detaylar için projeyi kontrol edin.',
      },
      subject: {
        projectAssignment: '📋 Yeni Atama: {{name}}',
        leadAssignment: '👤 Yeni Atama: {{name}}',
        projectMilestoneCompleted: '🎉 Proje Tamamlandı: {{name}}',
        projectMilestoneCancelled: '⚠️ Proje İptal Edildi: {{name}}',
      },
    },
    samples: {
      dailySummary: {
        projectType: 'Düğün',
        projectName: 'Günbatımı Düğünü',
        sessionNotes: 'Çekimden önce sıcak tonlu presetleri hazırlayın.',
        sessionLocation: 'Şehir merkezi stüdyosu',
        clientName: 'Elif Yılmaz',
        reminderContent: 'Çifte ilham panosunu gönderin.',
        overdueContent: 'Rivera ailesine galeriyi teslim edin.',
        pastSessionProjectName: 'Rivera Aile Seansı',
        pastSessionClientName: 'Rivera Ailesi',
      },
      immediate: {
        triggeredByName: 'Mehmet Aksoy',
        projectName: 'Bahar Bahçesi Düğünü',
        projectType: 'Düğün',
        projectNotes: 'Mekan terasında gün batımı portrelerini planlayın.',
        leadName: 'Elif Kaya',
        oldStatus: 'Düzenleniyor',
        newStatusCompleted: 'Tamamlandı',
        newStatusCancelled: 'İptal Edildi',
        leadNotes: 'E-posta ile iletişimi tercih ediyor.',
      },
    },
  },
};

function normalizeLanguage(language?: string): EmailLanguage {
  if (!language) return DEFAULT_LANGUAGE;
  const normalized = language.toLowerCase();
  const primary = normalized.split('-')[0] as EmailLanguage;
  if (primary in EMAIL_TRANSLATIONS) {
    return primary;
  }
  if ((normalized as EmailLanguage) in EMAIL_TRANSLATIONS) {
    return normalized as EmailLanguage;
  }
  return DEFAULT_LANGUAGE;
}

function formatTemplate(
  template: string,
  variables?: Record<string, unknown>,
): string {
  if (!variables) return template;
  return template.replace(
    /{{\s*([\w.]+)\s*}}/g,
    (match, key) => {
      const value = variables[key];
      return value === undefined || value === null ? match : String(value);
    },
  );
}

function getValue(
  tree: EmailTranslationNode,
  path: string[],
): EmailTranslationNode | undefined {
  let current: EmailTranslationNode | undefined = tree;
  for (const segment of path) {
    if (
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      segment in current
    ) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

export function createEmailLocalization(language?: string): EmailLocalization {
  const resolvedLanguage = normalizeLanguage(language);

  const translate = (
    key: string,
    variables?: Record<string, unknown>,
  ): string => {
    const path = key.split('.');
    let value = getValue(EMAIL_TRANSLATIONS[resolvedLanguage], path);

    if (value === undefined) {
      value = getValue(EMAIL_TRANSLATIONS[DEFAULT_LANGUAGE], path);
    }

    if (typeof value === 'string') {
      return formatTemplate(value, variables);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => formatTemplate(item, variables))
        .join(', ');
    }

    return key;
  };

  const list = (
    key: string,
    variables?: Record<string, unknown>,
  ): string[] => {
    const path = key.split('.');
    let value = getValue(EMAIL_TRANSLATIONS[resolvedLanguage], path);

    if (!Array.isArray(value)) {
      value = getValue(EMAIL_TRANSLATIONS[DEFAULT_LANGUAGE], path);
    }

    if (Array.isArray(value)) {
      return value.map((item) => formatTemplate(item, variables));
    }

    if (typeof value === 'object' && value !== null) {
      // When the node is an object with { title, description }
      return Object.values(value).map((item) =>
        typeof item === 'string' ? formatTemplate(item, variables) : '',
      );
    }

    return [];
  };

  const raw = (key: string): EmailTranslationNode | undefined => {
    const path = key.split('.');
    let value = getValue(EMAIL_TRANSLATIONS[resolvedLanguage], path);
    if (value === undefined) {
      value = getValue(EMAIL_TRANSLATIONS[DEFAULT_LANGUAGE], path);
    }
    return value;
  };

  return {
    language: resolvedLanguage,
    t: translate,
    list,
    raw,
  };
}

export type { EmailLocalization, EmailLanguage };
