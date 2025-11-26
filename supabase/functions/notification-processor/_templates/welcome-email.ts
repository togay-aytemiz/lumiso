import { createEmailTemplate, type EmailTemplateData } from './enhanced-email-base.ts';
import { createEmailLocalization } from '../../_shared/email-i18n.ts';

interface WelcomeEmailOptions {
  baseUrl?: string;
  assetBaseUrl?: string;
}

function adjustBrightness(hex: string, percent: number): string {
  hex = hex.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, (num >> 8 & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function generateWelcomeEmail(
  templateData: EmailTemplateData,
  options: WelcomeEmailOptions = {},
): string {
  const localization =
    templateData.localization ||
    (templateData.localization = createEmailLocalization(templateData.language));
  const t = localization.t;
  const brandColor = templateData.brandColor || '#1EB29F';
  const lighterBrandColor = adjustBrightness(brandColor, 16);
  const baseUrl = (options.baseUrl || templateData.baseUrl || 'https://app.lumiso.com').replace(/\/$/, '');
  const assetBaseUrl = options.assetBaseUrl || templateData.assetBaseUrl || baseUrl;
  const firstName =
    templateData.userFullName?.split(' ')[0] ||
    templateData.userFullName ||
    'there';

  const preheader = t('welcome.preheader', { businessName: templateData.businessName });
  const heroTitle = t('welcome.heroTitle');
  const heroSubtitle = t('welcome.heroSubtitle', { businessName: templateData.businessName });
  const greeting = t('welcome.greeting', { name: firstName });
  const intro = t('welcome.intro');
  const checklistTitle = t('welcome.checklistTitle');
  const shortcutsTitle = t('welcome.shortcutsTitle');
  const closing = t('welcome.closing');
  const signature = t('welcome.signature');

  const checklistConfig = [
    { key: 'lead', href: `${baseUrl}/leads`, icon: '📇' },
    { key: 'project', href: `${baseUrl}/projects`, icon: '🗂️' },
    { key: 'session', href: `${baseUrl}/sessions`, icon: '📅' },
  ];

  const checklistMarkup = checklistConfig
    .map((item, index) => {
      const copy = localization.raw(`welcome.checklist.${item.key}`) as
        | { title?: string; description?: string }
        | undefined;
      const title = copy?.title || item.key;
      const description = copy?.description || '';

      return `
        <div style="
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px 18px 18px 16px;
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 12px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        ">
          <div style="
            width: 42px;
            height: 42px;
            border-radius: 12px;
            background: ${brandColor}15;
            color: ${brandColor};
            font-weight: 700;
            font-size: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
          ">${index + 1}</div>
          <div style="flex: 1 1 auto;">
            <div style="
              font-size: 16px;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 6px 0;
              display: flex;
              align-items: center;
              gap: 10px;
            ">
              <span style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 12px;
                background: ${brandColor}12;
                font-size: 18px;
              ">${item.icon}</span>
              <span>${title}</span>
            </div>
            <p style="
              margin: 0 0 10px 0;
              color: #475569;
              font-size: 14px;
              line-height: 1.6;
            ">${description}</p>
            <a href="${item.href}" style="
              color: ${brandColor};
              font-weight: 600;
              text-decoration: none;
              font-size: 13px;
            ">${t('common.actions.view')} →</a>
          </div>
        </div>
      `;
    })
    .join('');

  const shortcutConfig = [
    { key: 'profile', href: `${baseUrl}/settings/general`, icon: '🎨' },
    { key: 'services', href: `${baseUrl}/settings/services`, icon: '🧰' },
  ];

  const shortcutsMarkup = shortcutConfig
    .map((item) => {
      const copy = localization.raw(`welcome.shortcuts.${item.key}`) as
        | { title?: string; description?: string }
        | undefined;
      const title = copy?.title || item.key;
      const description = copy?.description || '';

      return `
        <div style="
          display: flex;
          gap: 14px;
          align-items: center;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          margin-bottom: 10px;
        ">
          <div style="
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: ${brandColor}12;
            color: ${brandColor};
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
          ">${item.icon}</div>
          <div style="flex: 1 1 auto;">
            <div style="
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 4px 0;
            ">${title}</div>
            <p style="
              margin: 0 0 6px 0;
              color: #475569;
              font-size: 13px;
              line-height: 1.5;
            ">${description}</p>
            <a href="${item.href}" style="
              color: ${brandColor};
              text-decoration: none;
              font-weight: 600;
              font-size: 12px;
            ">${t('common.actions.view')} →</a>
          </div>
        </div>
      `;
    })
    .join('');

  const primaryCta = {
    label: t('welcome.ctaPrimary'),
    href: baseUrl,
  };
  const secondaryCta = {
    label: t('welcome.ctaSecondary'),
    href: `${baseUrl}/getting-started`,
  };

  const content = `
    <div style="
      display: none;
      visibility: hidden;
      opacity: 0;
      height: 0;
      overflow: hidden;
      mso-hide: all;
    ">${preheader}</div>
    <div style="
      background: linear-gradient(135deg, ${brandColor}18, ${lighterBrandColor}12);
      border-radius: 18px;
      padding: 28px 24px;
      margin: 0 auto 28px;
      max-width: 640px;
      border: 1px solid ${brandColor}26;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
    ">
      <div style="text-align: center;">
        <div style="font-size: 46px; margin-bottom: 10px; line-height: 1;">✨</div>
        <h2 style="
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.25;
        ">${heroTitle}</h2>
        <p style="
          margin: 0;
          color: #475569;
          font-size: 15px;
          line-height: 1.6;
        ">${heroSubtitle}</p>
      </div>
      <div style="
        background: #ffffff;
        border-radius: 14px;
        padding: 16px;
        border: 1px solid #e2e8f0;
        margin-top: 18px;
      ">
        <p style="
          margin: 0 0 8px 0;
          color: #0f172a;
          font-size: 15px;
          font-weight: 700;
        ">${greeting}</p>
        <p style="
          margin: 0;
          color: #475569;
          font-size: 14px;
          line-height: 1.6;
        ">${intro}</p>
      </div>
      <div style="
        margin-top: 20px;
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
      ">
        <a href="${primaryCta.href}" style="
          background: ${brandColor};
          color: #ffffff;
          padding: 12px 18px;
          border-radius: 10px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 10px 20px rgba(31, 41, 55, 0.18);
        ">${primaryCta.label}</a>
        <a href="${secondaryCta.href}" style="
          color: ${brandColor};
          padding: 11px 16px;
          border-radius: 10px;
          font-weight: 700;
          text-decoration: none;
          border: 1px solid ${brandColor}33;
          background: #ffffff;
        ">${secondaryCta.label}</a>
      </div>
    </div>

    <div style="margin: 0 auto 26px; max-width: 640px;">
      <h3 style="
        margin: 0 0 14px 0;
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
      ">${checklistTitle}</h3>
      ${checklistMarkup}
    </div>

    <div style="margin: 0 auto 26px; max-width: 640px;">
      <h3 style="
        margin: 0 0 12px 0;
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
      ">${shortcutsTitle}</h3>
      ${shortcutsMarkup}
    </div>

    <div style="
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      max-width: 640px;
      margin: 0 auto;
    ">
      <p style="
        margin: 0 0 8px 0;
        color: #334155;
        font-size: 14px;
        line-height: 1.6;
      ">${closing}</p>
      <p style="
        margin: 0;
        color: #0f172a;
        font-size: 14px;
        font-weight: 700;
      ">${signature}</p>
    </div>
  `;

  return createEmailTemplate(
    t('welcome.subject', { name: firstName, businessName: templateData.businessName }),
    content,
    {
      ...templateData,
      baseUrl,
      assetBaseUrl,
    },
  );
}
