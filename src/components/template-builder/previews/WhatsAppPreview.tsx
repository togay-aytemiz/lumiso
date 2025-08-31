import { TemplateBlock, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppPreviewProps {
  blocks: TemplateBlock[];
  mockData: Record<string, string>;
}

export function WhatsAppPreview({ blocks, mockData }: WhatsAppPreviewProps) {
  const replacePlaceholders = (text: string) => {
    return text.replace(/\{(\w+)\}/g, (match, key) => mockData[key] || match);
  };

  const formatWhatsAppText = (text: string, formatting: any) => {
    let formatted = text;
    if (formatting.bold) formatted = `*${formatted}*`;
    if (formatting.italic) formatted = `_${formatted}_`;
    return formatted;
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
          <div className="text-xs text-gray-600">online</div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-2">
        {blocks.map((block) => (
          <div key={block.id} className="bg-white p-3 rounded-lg shadow-sm">
            {block.type === "text" && (
              <WhatsAppTextBlock data={block.data as TextBlockData} replacePlaceholders={replacePlaceholders} formatText={formatWhatsAppText} />
            )}
            {block.type === "session-details" && (
              <WhatsAppSessionDetails data={block.data as SessionDetailsBlockData} mockData={mockData} />
            )}
            {block.type === "cta" && (
              <WhatsAppCTA data={block.data as CTABlockData} replacePlaceholders={replacePlaceholders} />
            )}
            {block.type === "image" && (
              <WhatsAppImage data={block.data as ImageBlockData} replacePlaceholders={replacePlaceholders} />
            )}
            {block.type === "footer" && (
              <WhatsAppFooter data={block.data as FooterBlockData} mockData={mockData} />
            )}
          </div>
        ))}

        {blocks.length === 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-sm">
              <div className="mb-2">Hello {mockData.customer_name}! 👋</div>
              <div>We're excited to capture your special moments ✨📸</div>
              <div className="mt-2">Looking forward to our session! 🎉</div>
              <div className="mt-3 text-gray-500 text-xs">Add blocks to build your template</div>
            </div>
          </div>
        )}
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
  formatText 
}: { 
  data: TextBlockData; 
  replacePlaceholders: (text: string) => string;
  formatText: (text: string, formatting: any) => string;
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

function WhatsAppSessionDetails({ data, mockData }: { data: SessionDetailsBlockData; mockData: Record<string, string> }) {
  return (
    <div className="text-sm">
      <div className="font-medium mb-2">
        📅 {data.customLabel || "Session Details"}
      </div>
      <div className="space-y-1">
        {data.showDate && <div>📅 Date: {mockData.session_date}</div>}
        {data.showTime && <div>🕐 Time: {mockData.session_time}</div>}
        {data.showLocation && <div>📍 Location: {mockData.session_location}</div>}
        {data.showNotes && <div>📝 Please arrive 10 minutes early!</div>}
      </div>
    </div>
  );
}

function WhatsAppCTA({ data, replacePlaceholders }: { data: CTABlockData; replacePlaceholders: (text: string) => string }) {
  const { activeOrganization } = useOrganization();
  const [organizationSettings, setOrganizationSettings] = useState<any>(null);

  useEffect(() => {
    const fetchOrganizationSettings = async () => {
      if (activeOrganization?.id) {
        const { data: settings } = await supabase
          .from("organization_settings")
          .select("primary_brand_color")
          .eq("organization_id", activeOrganization.id)
          .single();
        setOrganizationSettings(settings);
      }
    };

    fetchOrganizationSettings();
  }, [activeOrganization?.id]);

  const brandColor = organizationSettings?.primary_brand_color || "#1EB29F";

  const getButtonStyle = () => {
    switch (data.variant) {
      case "text":
        return { color: brandColor };
      case "secondary":
        return {};
      default:
        return { backgroundColor: brandColor };
    }
  };

  const getButtonClass = () => {
    switch (data.variant) {
      case "text":
        return "text-sm font-medium underline";
      case "secondary":
        return "bg-gray-100 text-gray-800 px-4 py-2 rounded-full inline-block text-sm font-medium";
      default:
        return "text-white px-4 py-2 rounded-full inline-block text-sm font-medium";
    }
  };

  return (
    <div className="text-center">
      <div className={getButtonClass()} style={getButtonStyle()}>
        {replacePlaceholders(data.text)} ✨
      </div>
      {data.link && (
        <div className="text-xs mt-1 underline" style={{ color: brandColor }}>
          {data.link}
        </div>
      )}
    </div>
  );
}

function WhatsAppImage({ data, replacePlaceholders }: { data: ImageBlockData; replacePlaceholders: (text: string) => string }) {
  return (
    <div>
      {data.placeholder || !data.src ? (
        <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-2xl mb-1">🖼️</div>
            <div className="text-xs">Image</div>
          </div>
        </div>
      ) : (
        <img
          src={data.src}
          alt={data.alt}
          className="w-full rounded-lg"
        />
      )}
      {data.caption && (
        <div className="text-sm text-gray-600 mt-2">
          {replacePlaceholders(data.caption)}
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