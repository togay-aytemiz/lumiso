import { TemplateBlock, TextBlockData, SessionDetailsBlockData, CTABlockData, FooterBlockData } from "@/types/templateBuilder";
import { useTranslation } from 'react-i18next';

interface WhatsAppPreviewProps {
  blocks: TemplateBlock[];
  mockData: Record<string, string>;
}

export function WhatsAppPreview({ blocks, mockData }: WhatsAppPreviewProps) {
  const { t } = useTranslation('pages');
  const previewRecipientName = mockData.lead_name || mockData.customer_name || t('templateBuilder.preview.mockData.customerName');
  
  const replacePlaceholders = (text: string) => {
    return text.replace(/\{(\w+)\}/g, (match, key) => mockData[key] || match);
  };

  const formatWhatsAppText = (
    text: string,
    formatting?: TextBlockData["formatting"]
  ) => {
    let formatted = text;
    if (formatting?.bold) formatted = `*${formatted}*`;
    if (formatting?.italic) formatted = `_${formatted}_`;
    return formatted;
  };

  const renderAllBlocks = () => {
    if (blocks.length === 0) {
      return (
        <div className="text-sm">
          <div className="mb-2">{t('templateBuilder.preview.helloCustomer', { name: previewRecipientName })}</div>
          <div>{t('templateBuilder.preview.excitedMessage')} ✨📸</div>
          <div className="mt-2">{t('templateBuilder.preview.lookingForward')}</div>
          <div className="mt-3 text-gray-500 text-xs">{t('templateBuilder.preview.addBlocks')}</div>
        </div>
      );
    }

    return (
      <div className="text-sm space-y-2">
        {blocks.filter(block => block.visible).map((block, index) => (
          <div key={block.id}>
            {block.type === "text" && (
              <WhatsAppTextBlock data={block.data as TextBlockData} replacePlaceholders={replacePlaceholders} formatText={formatWhatsAppText} />
            )}
            {block.type === "session-details" && (
              <WhatsAppSessionDetails
                data={block.data as SessionDetailsBlockData}
                mockData={mockData}
                replacePlaceholders={replacePlaceholders}
              />
            )}
            {block.type === "cta" && (
              <WhatsAppCTA data={block.data as CTABlockData} replacePlaceholders={replacePlaceholders} />
            )}
            {block.type === "footer" && (
              <WhatsAppFooter data={block.data as FooterBlockData} mockData={mockData} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-[#e5ddd5] p-4 rounded-lg max-w-sm">
      {/* WhatsApp Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-300">
        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
          {mockData.business_name.charAt(0)}
        </div>
        <div>
          <div className="font-semibold text-sm">{mockData.business_name}</div>
          <div className="text-xs text-gray-600">{t('templateBuilder.preview.whatsapp.online')}</div>
        </div>
      </div>

      {/* Single Message Bubble */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        {renderAllBlocks()}
      </div>

      <div className="text-xs text-gray-500 text-right mt-2">
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
      </div>
    </div>
  );
}

function WhatsAppTextBlock({
  data,
  replacePlaceholders,
  formatText,
}: {
  data: TextBlockData;
  replacePlaceholders: (text: string) => string;
  formatText: (
    text: string,
    formatting?: TextBlockData["formatting"]
  ) => string;
}) {
  const content = replacePlaceholders(data.content);
  const formatted = formatText(content, data.formatting);
  
  // Add emojis to enhance WhatsApp feel
  const enhanceWithEmojis = (text: string) => {
    return text
      .replace(/\b(hello|hi|hey)\b/gi, '$& 👋')
      .replace(/\b(thank you|thanks)\b/gi, '$& 🙏')
      .replace(/\b(excited|amazing|wonderful)\b/gi, '$& ✨')
      .replace(/\b(perfect|great|awesome)\b/gi, '$& 🎉')
      .replace(/\b(photography|photo|session)\b/gi, '$& 📸')
      .replace(/\b(beautiful|stunning)\b/gi, '$& 💫');
  };
  
  return (
    <div className="text-sm whitespace-pre-wrap">
      {enhanceWithEmojis(formatted).split('\n').map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  );
}

function WhatsAppSessionDetails({
  data,
  mockData,
  replacePlaceholders,
}: {
  data: SessionDetailsBlockData;
  mockData: Record<string, string>;
  replacePlaceholders: (text: string) => string;
}) {
  const { t } = useTranslation('pages');
  const fallback = '—';
  const heading = data.customLabel ? replacePlaceholders(data.customLabel) : t('templateBuilder.preview.sessionDetails.defaultLabel');
  const meetingLabel = data.meetingLabel ? replacePlaceholders(data.meetingLabel) : t('templateBuilder.preview.sessionDetails.meetingLink');
  const projectLabel = data.projectLabel ? replacePlaceholders(data.projectLabel) : t('templateBuilder.preview.sessionDetails.project');
  const packageLabel = data.packageLabel ? replacePlaceholders(data.packageLabel) : t('templateBuilder.preview.sessionDetails.package');
  const notesFromMock = (mockData.session_notes || '').trim();
  const resolvedNotes = data.customNotes?.trim()
    ? replacePlaceholders(data.customNotes)
    : notesFromMock || t('templateBuilder.preview.sessionDetails.defaultNote');

  const lines: string[] = [];
  if (data.showName) lines.push(`🎯 ${t('templateBuilder.preview.sessionDetails.session')} ${mockData.session_name || fallback}`);
  if (data.showType) lines.push(`🧩 ${t('templateBuilder.preview.sessionDetails.type')} ${mockData.session_type || fallback}`);
  if (data.showDuration) lines.push(`⏱️ ${t('templateBuilder.preview.sessionDetails.duration')} ${mockData.session_duration || fallback}`);
  if (data.showStatus) lines.push(`📌 ${t('templateBuilder.preview.sessionDetails.status')} ${mockData.session_status || fallback}`);
  if (data.showDate) lines.push(`📅 ${t('templateBuilder.preview.sessionDetails.date')} ${mockData.session_date || fallback}`);
  if (data.showTime) lines.push(`🕐 ${t('templateBuilder.preview.sessionDetails.time')} ${mockData.session_time || fallback}`);
  if (data.showLocation) lines.push(`📍 ${t('templateBuilder.preview.sessionDetails.location')} ${mockData.session_location || fallback}`);
  if (data.showMeetingLink)
    lines.push(`🔗 ${meetingLabel} ${mockData.session_meeting_url || fallback}`);
  if (data.showProject) lines.push(`🗂️ ${projectLabel} ${mockData.project_name || fallback}`);
  if (data.showPackage) lines.push(`🎁 ${packageLabel} ${mockData.project_package_name || fallback}`);
  if (data.showNotes) lines.push(`📝 ${t('templateBuilder.preview.sessionDetails.notes')} ${resolvedNotes}`);

  return (
    <div className="text-sm">
      <div className="font-medium mb-2">📅 {heading}</div>
      <div className="space-y-1">
        {lines.map((line, idx) => (
          <div key={`${line}-${idx}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function WhatsAppCTA({ data, replacePlaceholders }: { data: CTABlockData; replacePlaceholders: (text: string) => string }) {
  return (
    <div className="mt-2">
      <div className="text-sm font-medium">
        👆 {replacePlaceholders(data.text)}
      </div>
      {data.link && (
        <div className="text-xs mt-1 text-blue-600 underline">
          🔗 {data.link}
        </div>
      )}
    </div>
  );
}

function WhatsAppFooter({ data, mockData }: { data: FooterBlockData; mockData: Record<string, string> }) {
  return (
    <div className="text-xs text-gray-600 border-t pt-2 mt-2">
      {data.showStudioName && (
        <div className="font-medium text-gray-800 mb-1">
          📸 {mockData.business_name}
        </div>
      )}
      
      {data.showContactInfo && (
        <div className="space-y-1">
          <div>📞 {mockData.business_phone}</div>
          <div>💌 Professional Photography Services</div>
        </div>
      )}
      
      {data.customText && (
        <div className="mt-2 italic">
          ✨ {data.customText}
        </div>
      )}
    </div>
  );
}
