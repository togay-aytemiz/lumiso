import { useTranslation, UseTranslationResponse } from 'react-i18next';

// Type-safe translation keys based on our JSON structure
type TranslationKeys = {
  common: {
    buttons: {
      save: string;
      cancel: string;
      delete: string;
      edit: string;
      add: string;
      create: string;
      update: string;
      close: string;
      confirm: string;
      back: string;
      next: string;
      previous: string;
      submit: string;
      reset: string;
      clear: string;
      search: string;
      filter: string;
      export: string;
      import: string;
    };
    labels: {
      name: string;
      email: string;
      phone: string;
      address: string;
      date: string;
      time: string;
      status: string;
      description: string;
      notes: string;
      type: string;
      category: string;
      price: string;
      amount: string;
      total: string;
      subtotal: string;
      tax: string;
      discount: string;
    };
    status: {
      active: string;
      inactive: string;
      pending: string;
      completed: string;
      cancelled: string;
      draft: string;
      published: string;
    };
    actions: {
      loading: string;
      saving: string;
      deleting: string;
      processing: string;
      uploading: string;
      downloading: string;
    };
  };
  dashboard: {
    title: string;
    welcome: string;
    stats: {
      totalProjects: string;
      activeLeads: string;
      upcomingSessions: string;
      revenue: string;
    };
    quickActions: {
      newProject: string;
      addLead: string;
      scheduleSession: string;
      viewCalendar: string;
    };
    recentActivity: string;
    upcomingTasks: string;
  };
  forms: {
    validation: {
      required: string;
      email: string;
      phone: string;
      minLength: string;
      maxLength: string;
      numeric: string;
      date: string;
      time: string;
    };
    placeholders: {
      enterName: string;
      enterEmail: string;
      enterPhone: string;
      selectDate: string;
      selectTime: string;
      selectStatus: string;
      enterNotes: string;
      search: string;
    };
    labels: {
      firstName: string;
      lastName: string;
      fullName: string;
      emailAddress: string;
      phoneNumber: string;
      dateOfBirth: string;
      address: string;
      city: string;
      country: string;
      postalCode: string;
    };
  };
  navigation: {
    menu: {
      dashboard: string;
      projects: string;
      leads: string;
      sessions: string;
      calendar: string;
      payments: string;
      analytics: string;
      templates: string;
      workflows: string;
      settings: string;
      help: string;
      administration: string;
    };
    sections: {
      main: string;
      management: string;
      tools: string;
      system: string;
    };
    settings: {
      profile: string;
      general: string;
      notifications: string;
      billing: string;
      integrations: string;
      services: string;
      projects: string;
      leads: string;
      clientMessaging: string;
      contracts: string;
      dangerZone: string;
    };
    admin: {
      localization: string;
      users: string;
      system: string;
    };
  };
  messages: {
    success: {
      saved: string;
      created: string;
      updated: string;
      deleted: string;
      uploaded: string;
      sent: string;
      imported: string;
      exported: string;
    };
    error: {
      generic: string;
      network: string;
      unauthorized: string;
      notFound: string;
      validation: string;
      upload: string;
      delete: string;
      save: string;
    };
    confirm: {
      delete: string;
      cancel: string;
      unsavedChanges: string;
      permanent: string;
    };
    info: {
      noData: string;
      empty: string;
      loading: string;
      processing: string;
      selectItem: string;
      allFieldsOptional: string;
    };
  };
};

// Type for nested key paths
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)];

type TranslationNamespace = keyof TranslationKeys;
type TranslationKey<T extends TranslationNamespace> = NestedKeyOf<TranslationKeys[T]>;

// Enhanced useTranslation hook with type safety
export function useTypedTranslation<T extends TranslationNamespace>(
  namespace?: T
) {
  return useTranslation(namespace);
}

// Convenience hooks for each namespace
export const useCommonTranslation = () => useTypedTranslation('common');
export const useDashboardTranslation = () => useTypedTranslation('dashboard');
export const useFormsTranslation = () => useTypedTranslation('forms');
export const useNavigationTranslation = () => useTypedTranslation('navigation');
export const useMessagesTranslation = () => useTypedTranslation('messages');

// Generic translation hook
export const useT = () => {
  const { t } = useTranslation();
  return t;
};