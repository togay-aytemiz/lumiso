import { TemplateBlock, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";
import { useTranslation } from 'react-i18next';

interface SMSPreviewProps {
  blocks: TemplateBlock[];
  mockData: Record<string, string>;
}

export function SMSPreview({ blocks, mockData }: SMSPreviewProps) {
  const { t } = useTranslation('pages');
  const replacePlaceholders = (text: string) => {
    return text.replace(/\{(\w+)\}/g, (match, key) => mockData[key] || match);
  };

  // Convert all blocks to plain text
  const generateSMSText = () => {
    let smsContent = "";

    blocks.forEach((block, index) => {
      if (index > 0) smsContent += "\n\n";

      switch (block.type) {
        case "text":
          const textData = block.data as TextBlockData;
          smsContent += replacePlaceholders(textData.content);
          break;

        case "session-details":
          const sessionData = block.data as SessionDetailsBlockData;
          smsContent += sessionData.customLabel || "Session Details";
          smsContent += "\n";
          if (sessionData.showDate) smsContent += `Date: ${mockData.session_date}\n`;
          if (sessionData.showTime) smsContent += `Time: ${mockData.session_time}\n`;
          if (sessionData.showLocation) smsContent += `Location: ${mockData.session_location}\n`;
          if (sessionData.showNotes) smsContent += "Please arrive 10 minutes early!";
          break;

        case "cta":
          const ctaData = block.data as CTABlockData;
          smsContent += replacePlaceholders(ctaData.text);
          if (ctaData.link) {
            smsContent += `\n${ctaData.link}`;
          }
          break;

        case "image":
          const imageData = block.data as ImageBlockData;
          smsContent += "[Image]";
          if (imageData.caption) {
            smsContent += ` ${replacePlaceholders(imageData.caption)}`;
          }
          if (imageData.link) {
            smsContent += `\n${imageData.link}`;
          }
          break;

        case "footer":
          const footerData = block.data as FooterBlockData;
          if (footerData.showStudioName) {
            smsContent += mockData.business_name;
          }
          if (footerData.showContactInfo) {
            if (footerData.showStudioName) smsContent += "\n";
            smsContent += mockData.business_phone;
          }
          if (footerData.customText) {
            if (footerData.showStudioName || footerData.showContactInfo) smsContent += "\n";
            smsContent += footerData.customText;
          }
          break;
      }
    });

    return smsContent.trim();
  };

  const smsText = generateSMSText();
  const characterCount = smsText.length;
  const messageCount = Math.ceil(characterCount / 160);

  return (
    <div className="bg-slate-100 p-4 rounded-lg max-w-sm">
      {/* SMS Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
            📱
          </div>
          <div>
            <div className="font-medium text-sm">{mockData.business_name}</div>
            <div className="text-xs text-gray-600">{t('templateBuilder.preview.sms.label')}</div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {t('templateBuilder.preview.sms.now')}
        </div>
      </div>

      {/* SMS Content */}
      <div className="bg-blue-500 text-white p-3 rounded-2xl rounded-bl-sm mb-3 max-w-[85%] ml-auto">
        {smsText ? (
          <div className="text-sm whitespace-pre-wrap">
            {smsText}
          </div>
        ) : (
          <div className="text-sm">
            {t('templateBuilder.preview.helloCustomer', { name: mockData.customer_name })} {t('templateBuilder.preview.excitedMessage')}.
            
            {t('templateBuilder.preview.addBlocks')}.
          </div>
        )}
      </div>

      {/* Character Counter */}
      <div className="text-xs text-gray-500 text-right space-y-1">
        <div>{characterCount} {t('templateBuilder.preview.sms.characters')}</div>
        <div className={characterCount > 160 ? "text-orange-600" : ""}>
          {messageCount} {messageCount !== 1 ? t('templateBuilder.preview.sms.messages') : t('templateBuilder.preview.sms.message')}
        </div>
        {characterCount > 160 && (
          <div className="text-orange-600 text-[10px]">
            {t('templateBuilder.preview.sms.longMessageWarning')}
          </div>
        )}
      </div>
    </div>
  );
}