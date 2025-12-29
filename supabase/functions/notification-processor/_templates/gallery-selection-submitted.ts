import { createEmailTemplate, type EmailTemplateData } from './enhanced-email-base.ts';
import { createEmailLocalization } from '../../_shared/email-i18n.ts';

export type GallerySelectionSubmittedEmailParams = {
  galleryTitle: string;
  leadName?: string | null;
  coverImageUrl?: string | null;
  selectionCount?: number | null;
  note?: string | null;
  galleryUrl: string;
  allGalleriesUrl: string;
};

export type GallerySelectionSubmittedEmailRender = {
  subject: string;
  html: string;
};

type TranslateFn = (key: string, variables?: Record<string, unknown>) => string;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const sanitizePlainText = (value: string) => value.replaceAll(/\s+/g, ' ').trim();

const sanitizeSubjectValue = (value: string) =>
  value.replaceAll(/[\r\n]+/g, ' ').trim();

function adjustBrightness(hex: string, percent: number): string {
  const cleaned = hex.replace('#', '');
  const num = Number.parseInt(cleaned, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function buildSubject(
  t: TranslateFn,
  params: { galleryTitle: string; leadName?: string | null },
) {
  const galleryTitle = sanitizeSubjectValue(params.galleryTitle);
  const leadName = params.leadName ? sanitizeSubjectValue(params.leadName) : '';

  if (leadName) {
    return t('gallerySelectionSubmitted.subject.withLead', { galleryTitle, leadName });
  }

  return t('gallerySelectionSubmitted.subject.withoutLead', { galleryTitle });
}

export function renderGallerySelectionSubmittedEmail(
  params: GallerySelectionSubmittedEmailParams,
  templateData: EmailTemplateData,
): GallerySelectionSubmittedEmailRender {
  const localization =
    templateData.localization ||
    (templateData.localization = createEmailLocalization(templateData.language));
  const t = localization.t;

  const brandColor = templateData.brandColor || '#1EB29F';
  const lighterBrandColor = adjustBrightness(brandColor, 20);

  const galleryTitleText = sanitizePlainText(params.galleryTitle);
  const leadNameText = params.leadName ? sanitizePlainText(params.leadName) : '';
  const htmlGalleryTitle = escapeHtml(galleryTitleText);
  const htmlLeadName = leadNameText ? escapeHtml(leadNameText) : '';

  const heroSubtitle = leadNameText
    ? t('gallerySelectionSubmitted.hero.subtitleWithLead', {
      leadName: htmlLeadName,
      galleryTitle: htmlGalleryTitle,
    })
    : t('gallerySelectionSubmitted.hero.subtitleWithoutLead', {
      galleryTitle: htmlGalleryTitle,
    });

  const subject = buildSubject(t, {
    galleryTitle: galleryTitleText,
    leadName: leadNameText || null,
  });

  const coverAlt = t('gallerySelectionSubmitted.alt.cover');
  const coverImageUrl = params.coverImageUrl ? sanitizePlainText(params.coverImageUrl) : '';
  const coverBlock = coverImageUrl
    ? `
      <div style="
        margin: 24px auto 0;
        border-radius: 18px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.10);
      ">
        <img
          src="${escapeHtml(coverImageUrl)}"
          alt="${escapeHtml(coverAlt)}"
          style="
            display: block;
            width: 100%;
            max-height: 360px;
            height: auto;
            object-fit: cover;
          "
        />
      </div>
    `
    : '';

  const selectionCount =
    typeof params.selectionCount === 'number' && Number.isFinite(params.selectionCount)
      ? Math.max(0, Math.floor(params.selectionCount))
      : null;

  const selectionCountBlock = selectionCount !== null
    ? `
      <div style="
        margin: 24px auto 0;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 18px 20px;
        background: #ffffff;
      ">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.4px; color: #64748b; text-transform: uppercase;">
          ${escapeHtml(t('gallerySelectionSubmitted.summary.selectedCountLabel'))}
        </div>
        <div style="margin-top: 6px; font-size: 22px; font-weight: 800; color: #0f172a;">
          ${selectionCount}
        </div>
      </div>
    `
    : '';

  const noteText = params.note ? sanitizePlainText(params.note) : '';
  const noteBlock = noteText
    ? `
      <div style="
        margin: 16px auto 0;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 18px 20px;
        background: #ffffff;
      ">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.4px; color: #64748b; text-transform: uppercase;">
          ${escapeHtml(t('gallerySelectionSubmitted.summary.noteLabel'))}
        </div>
        <div style="margin-top: 8px; font-size: 15px; color: #111827; line-height: 1.6; white-space: pre-wrap;">
          ${escapeHtml(noteText)}
        </div>
      </div>
    `
    : '';

  const galleryUrl = sanitizePlainText(params.galleryUrl);
  const allGalleriesUrl = sanitizePlainText(params.allGalleriesUrl);

  const ctaBlock = `
    <table role="presentation" width="100%" style="margin: 28px auto 0; border-collapse: separate; border-spacing: 0;">
      <tr>
        <td align="center" style="padding: 0 6px 12px;">
          <a href="${escapeHtml(galleryUrl)}" style="
            display: inline-block;
            background: ${brandColor};
            color: #ffffff;
            padding: 12px 18px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 700;
            font-size: 14px;
          ">${escapeHtml(t('gallerySelectionSubmitted.actions.viewGallery'))}</a>
        </td>
        <td align="center" style="padding: 0 6px 12px;">
          <a href="${escapeHtml(allGalleriesUrl)}" style="
            display: inline-block;
            background: #ffffff;
            color: ${brandColor};
            padding: 12px 18px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 700;
            font-size: 14px;
            border: 1px solid ${brandColor}55;
          ">${escapeHtml(t('gallerySelectionSubmitted.actions.viewAllGalleries'))}</a>
        </td>
      </tr>
    </table>
  `;

  const content = `
    <div style="
      background: linear-gradient(135deg, ${brandColor}1a, ${lighterBrandColor}0f);
      border-radius: 20px;
      padding: 40px 32px 32px;
      margin: 24px auto;
      max-width: 560px;
      border: 1px solid ${brandColor}26;
      box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
      text-align: center;
    ">
      <div style="font-size: 44px; margin-bottom: 12px; line-height: 1;">✅</div>
      <h1 style="
        margin: 0 0 10px 0;
        font-size: 26px;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.2;
      ">${escapeHtml(t('gallerySelectionSubmitted.hero.title'))}</h1>
      <p style="
        margin: 0;
        color: #64748b;
        font-size: 16px;
        line-height: 1.6;
      ">${heroSubtitle}</p>
      ${coverBlock}
      ${selectionCountBlock}
      ${noteBlock}
      ${ctaBlock}
    </div>
  `;

  return {
    subject,
    html: createEmailTemplate(subject, content, templateData),
  };
}

