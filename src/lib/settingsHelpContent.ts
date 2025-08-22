export interface SettingsHelpContent {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
}

export const settingsHelpContent: Record<string, SettingsHelpContent> = {
  profile: {
    title: "Profile Settings Help",
    description: "Manage your personal profile information and preferences to customize your experience.",
    sections: [
      {
        title: "Profile Information",
        content: "Update your display name, bio, and profile picture to help your team members identify and connect with you. Your profile information is visible to all members of your organization."
      },
      {
        title: "Personal Preferences",
        content: "Customize your personal settings like timezone, language preferences, and notification settings to match your working style and location."
      },
      {
        title: "Account Security",
        content: "Keep your account secure by updating your password regularly and enabling two-factor authentication when available. Monitor your account activity to ensure security."
      }
    ]
  },

  general: {
    title: "General Settings Help",
    description: "Configure your organization's core settings, branding, and basic information.",
    sections: [
      {
        title: "Organization Information",
        content: "Set up your organization's basic details including name, description, and contact information. This information helps identify your organization and appears in various parts of the application."
      },
      {
        title: "Branding & Appearance",
        content: "Customize your organization's visual identity by uploading logos, setting brand colors, and choosing themes. Your branding will be reflected throughout the application and in client-facing materials."
      },
      {
        title: "Regional Settings",
        content: "Configure timezone, currency, date formats, and other regional preferences that affect how data is displayed and processed throughout your organization."
      },
      {
        title: "Future Enhancements",
        content: "We're continuously working on new features including advanced branding options, custom domains, and integration capabilities to enhance your organization's presence."
      }
    ]
  },

  team: {
    title: "Team Management Help",
    description: "Manage your team members, roles, and permissions to ensure smooth collaboration.",
    sections: [
      {
        title: "Adding Team Members",
        content: "Invite new team members by sending email invitations. Set their initial roles and permissions before sending the invitation to ensure they have the right access level from day one."
      },
      {
        title: "Roles & Permissions",
        content: "Define different roles with specific permissions to control what team members can access and modify. Create custom roles that match your organization's workflow and hierarchy."
      },
      {
        title: "Team Collaboration",
        content: "Enable effective collaboration by setting up proper access controls, shared resources, and communication preferences for your team members."
      },
      {
        title: "Coming Soon",
        content: "We're developing advanced team features including team analytics, performance tracking, and enhanced collaboration tools to boost your team's productivity."
      }
    ]
  },

  billing: {
    title: "Billing & Subscription Help",
    description: "Manage your subscription, payment methods, and billing preferences.",
    sections: [
      {
        title: "Subscription Management",
        content: "View your current plan details, usage metrics, and subscription status. Upgrade or downgrade your plan based on your organization's needs and growth."
      },
      {
        title: "Payment Methods",
        content: "Add, update, or remove payment methods. Set up automatic billing to ensure uninterrupted service and manage payment preferences for your organization."
      },
      {
        title: "Billing History",
        content: "Access your complete billing history, download invoices, and track your spending patterns. Export billing data for accounting and expense management purposes."
      },
      {
        title: "Usage Insights",
        content: "Monitor your usage across different features and understand how your team uses the platform to make informed decisions about your subscription plan."
      }
    ]
  },

  services: {
    title: "Services Management Help",
    description: "Configure and manage the services you offer to your clients.",
    sections: [
      {
        title: "Service Categories",
        content: "Organize your services into logical categories to make them easier to find and manage. Create categories that match your business structure and client expectations."
      },
      {
        title: "Pricing & Packages",
        content: "Set up flexible pricing structures, create service packages, and define special offers. Configure different pricing tiers to accommodate various client needs and budgets."
      },
      {
        title: "Service Descriptions",
        content: "Create compelling service descriptions that clearly communicate value to your clients. Include details about deliverables, timelines, and what clients can expect."
      },
      {
        title: "Advanced Features",
        content: "We're developing advanced service management features including automated scheduling, service templates, and integration with external booking systems."
      }
    ]
  },

  projects: {
    title: "Project Settings Help",
    description: "Configure project workflows, statuses, and management preferences.",
    sections: [
      {
        title: "Project Workflows",
        content: "Set up custom project stages and workflows that match your business processes. Define clear progression paths from initial inquiry to project completion."
      },
      {
        title: "Project Templates",
        content: "Create reusable project templates to standardize your project setup process. Templates help ensure consistency and save time when starting new projects."
      },
      {
        title: "Status Management",
        content: "Configure project statuses and transitions to track progress effectively. Set up automated notifications and reminders based on project status changes."
      },
      {
        title: "Enhanced Tracking",
        content: "Future updates will include advanced project analytics, time tracking integration, and enhanced reporting capabilities to give you deeper insights into your project performance."
      }
    ]
  },

  leads: {
    title: "Lead Management Help",
    description: "Configure your lead capture, qualification, and conversion processes.",
    sections: [
      {
        title: "Lead Sources",
        content: "Set up and track different lead sources to understand where your best prospects come from. Configure automated lead scoring based on source quality and conversion rates."
      },
      {
        title: "Lead Qualification",
        content: "Create qualification criteria and workflows to identify high-quality leads. Set up automated qualification processes to prioritize your sales efforts effectively."
      },
      {
        title: "Conversion Tracking",
        content: "Monitor your lead-to-client conversion rates and identify bottlenecks in your sales process. Use conversion data to optimize your lead management strategy."
      },
      {
        title: "Advanced CRM Features",
        content: "We're developing advanced CRM capabilities including lead scoring algorithms, automated follow-up sequences, and integration with marketing automation tools."
      }
    ]
  },

  notifications: {
    title: "Notification Settings Help",
    description: "Control when and how you receive notifications to stay informed without being overwhelmed.",
    sections: [
      {
        title: "Notification Types",
        content: "Choose which types of events trigger notifications including project updates, team mentions, deadline reminders, and system alerts. Customize notification preferences for different scenarios."
      },
      {
        title: "Delivery Methods",
        content: "Select how you want to receive notifications - via email, in-app notifications, or mobile push notifications. Set different delivery preferences for urgent vs. non-urgent notifications."
      },
      {
        title: "Quiet Hours",
        content: "Set up quiet hours during which non-urgent notifications will be suppressed. Configure different quiet hour schedules for weekdays and weekends to maintain work-life balance."
      },
      {
        title: "Smart Notifications",
        content: "Future enhancements will include AI-powered notification prioritization, smart bundling of related notifications, and contextual notification timing based on your activity patterns."
      }
    ]
  },

  integrations: {
    title: "Integrations Help",
    description: "Connect your favorite tools and services to streamline your workflow.",
    sections: [
      {
        title: "Available Integrations",
        content: "Explore our growing library of integrations with popular business tools including calendar applications, communication platforms, and productivity suites."
      },
      {
        title: "Setup & Configuration",
        content: "Each integration comes with step-by-step setup instructions and configuration options to ensure seamless data flow between your tools and our platform."
      },
      {
        title: "Data Synchronization",
        content: "Understand how data syncs between integrated services, including sync frequency, conflict resolution, and data mapping options to maintain consistency across platforms."
      },
      {
        title: "Expanding Ecosystem",
        content: "We're constantly adding new integrations based on user feedback. Request specific integrations and stay tuned for announcements about new partnership integrations."
      }
    ]
  },

  clientMessaging: {
    title: "Client Messaging Help",
    description: "Configure client communication preferences and messaging templates.",
    sections: [
      {
        title: "Message Templates",
        content: "Create and customize message templates for common client communications including project updates, appointment confirmations, and follow-up messages. Templates ensure consistent, professional communication."
      },
      {
        title: "Automated Messaging",
        content: "Set up automated message sequences for different client journey stages. Configure triggers based on project milestones, booking confirmations, or time-based schedules."
      },
      {
        title: "Communication Preferences",
        content: "Allow clients to set their preferred communication methods and frequency. Respect client preferences while ensuring important information reaches them effectively."
      },
      {
        title: "Advanced Features (Coming Soon)",
        content: "Future updates will include multimedia message support, client portal integration, and advanced personalization options to enhance client communication experience."
      }
    ]
  },

  contracts: {
    title: "Contract Management Help",
    description: "Manage contract templates, terms, and client agreements efficiently.",
    sections: [
      {
        title: "Contract Templates",
        content: "Create standardized contract templates that protect your business while being clear and fair to clients. Include standard terms, pricing structures, and project specifications."
      },
      {
        title: "Digital Signatures",
        content: "Streamline the contract signing process with digital signature capabilities. Track signature status and maintain secure records of all signed agreements."
      },
      {
        title: "Terms & Conditions",
        content: "Set up standard terms and conditions that can be automatically included in contracts. Keep your legal language up-to-date and compliant with local regulations."
      },
      {
        title: "Enhanced Contract Features (Coming Soon)",
        content: "We're developing advanced contract features including version control, approval workflows, and integration with legal document services for enhanced contract management."
      }
    ]
  },

  roles: {
    title: "Role Management Help",
    description: "Define and manage user roles and permissions across your organization.",
    sections: [
      {
        title: "Permission System",
        content: "Understand our granular permission system that allows you to control access to different features and data. Create roles that align with your organizational structure and security requirements."
      },
      {
        title: "Custom Roles",
        content: "Create custom roles tailored to your specific needs beyond the standard Admin, Manager, and Member roles. Define exactly what each role can and cannot access or modify."
      },
      {
        title: "Role Assignment",
        content: "Assign roles to team members and understand how role changes affect existing permissions and access. Plan role transitions carefully to maintain security and workflow continuity."
      },
      {
        title: "Advanced Security (Coming Soon)",
        content: "Future enhancements will include role-based automation, temporary role assignments, and advanced audit logging for comprehensive security management."
      }
    ]
  },

  dangerZone: {
    title: "Danger Zone Help",
    description: "Critical account operations that require careful consideration and cannot be undone.",
    sections: [
      {
        title: "Data Export",
        content: "Before making any destructive changes, ensure you have exported all important data. Use our export features to download your projects, client information, and other critical business data."
      },
      {
        title: "Account Deletion",
        content: "Account deletion is permanent and cannot be undone. All your data, projects, team members, and settings will be permanently removed. Consider downgrading your subscription instead if cost is a concern."
      },
      {
        title: "Data Retention",
        content: "Understand our data retention policies and what happens to your data after account deletion. Some data may be retained for legal compliance purposes as outlined in our privacy policy."
      },
      {
        title: "Alternative Options",
        content: "Before taking destructive actions, consider alternatives like account suspension, data archiving, or transferring ownership to another team member. Contact support to discuss options."
      }
    ]
  }
};