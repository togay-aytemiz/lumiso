import { TemplateBlock, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SocialChannel } from "@/hooks/useOrganizationSettings";

interface EmailPreviewProps {
  blocks: TemplateBlock[];
  mockData: Record<string, string>;
  device: "desktop" | "mobile";
  emailSubject?: string;
  preheader?: string;
}

export function EmailPreview({ blocks, mockData, device, emailSubject, preheader }: EmailPreviewProps) {
  const { activeOrganization } = useOrganization();
  const [organizationSettings, setOrganizationSettings] = useState<any>(null);

  useEffect(() => {
    const fetchOrganizationSettings = async () => {
      if (activeOrganization?.id) {
        const { data } = await supabase
          .from("organization_settings")
          .select("photography_business_name, logo_url, primary_brand_color, phone, email, social_channels")
          .eq("organization_id", activeOrganization.id)
          .single();
        setOrganizationSettings(data);
      }
    };

    fetchOrganizationSettings();
  }, [activeOrganization?.id]);

  const replacePlaceholders = (text: string) => {
    return text.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (match, key, fallback) => {
      return mockData[key] || fallback || match;
    });
  };

  return (
    <div className="bg-white rounded-lg border shadow-lg">
      {/* Email Header */}
      <div className="bg-slate-600 text-white p-3 rounded-t-lg flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-red-400 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
        </div>
        <span className="text-sm font-medium">Email Preview</span>
      </div>

      {/* Email Meta */}
      <div className="p-4 border-b bg-gray-50 text-sm">
        <div><strong>Subject:</strong> {emailSubject ? replacePlaceholders(emailSubject) : "📸 Your photography session is confirmed!"}</div>
        {preheader && (
          <div><strong>Preview:</strong> <span className="text-muted-foreground">{replacePlaceholders(preheader)}</span></div>
        )}
      </div>

      {/* Email Body */}
      <div className={cn("p-6 space-y-6", device === "mobile" && "p-4 space-y-4")}>
        {/* Render all blocks */}
        {blocks.map((block) => {
          switch (block.type) {
            case "text":
              return <TextBlockPreview key={block.id} data={block.data as TextBlockData} replacePlaceholders={replacePlaceholders} />;
            case "session-details":
              return <SessionDetailsPreview key={block.id} data={block.data as SessionDetailsBlockData} mockData={mockData} />;
            case "cta":
              return <CTABlockPreview key={block.id} data={block.data as CTABlockData} replacePlaceholders={replacePlaceholders} />;
            case "image":
              return <ImageBlockPreview key={block.id} data={block.data as ImageBlockData} replacePlaceholders={replacePlaceholders} />;
            case "divider":
              return <DividerBlockPreview key={block.id} data={block.data} />;
            case "social-links":
              return <SocialLinksBlockPreview key={block.id} data={block.data} />;
            case "header":
              return <HeaderBlockPreview key={block.id} data={block.data} replacePlaceholders={replacePlaceholders} organizationSettings={organizationSettings} />;
            case "raw-html":
              return <RawHTMLBlockPreview key={block.id} data={block.data} />;
            case "footer":
              return <FooterBlockPreview key={block.id} data={block.data as FooterBlockData} mockData={mockData} organizationSettings={organizationSettings} />;
            default:
              return null;
          }
        })}

        {blocks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <h3 className="font-semibold mb-2">Hello {mockData.customer_name}! 👋</h3>
            <p>We're excited to capture your special moments</p>
            <p className="mt-8 text-sm">Add blocks to build your template</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TextBlockPreview({ data, replacePlaceholders }: { data: TextBlockData; replacePlaceholders: (text: string) => string }) {
  const getTextStyles = () => {
    const baseStyles: React.CSSProperties = {
      fontFamily: data.formatting.fontFamily || 'Arial',
      fontWeight: data.formatting.bold ? 'bold' : 'normal',
      fontStyle: data.formatting.italic ? 'italic' : 'normal',
      textAlign: data.formatting.alignment as any || 'left',
    };

    // Add font size based on semantic type
    switch (data.formatting.fontSize) {
      case 'h1':
        return { ...baseStyles, fontSize: '32px', fontWeight: 'bold', lineHeight: '1.2' };
      case 'h2':
        return { ...baseStyles, fontSize: '24px', fontWeight: 'bold', lineHeight: '1.3' };
      case 'h3':
        return { ...baseStyles, fontSize: '20px', fontWeight: 'bold', lineHeight: '1.4' };
      case 'p':
      default:
        return { ...baseStyles, fontSize: '16px', lineHeight: '1.6' };
    }
  };

  const content = replacePlaceholders(data.content);
  
  // Map fontSize to actual HTML elements for proper semantic rendering
  const getElementTag = () => {
    switch (data.formatting.fontSize) {
      case 'h1': return 'h1';
      case 'h2': return 'h2'; 
      case 'h3': return 'h3';
      case 'p':
      default: return 'p';
    }
  };

  const Tag = getElementTag() as keyof JSX.IntrinsicElements;

  return (
    <div>
      <Tag style={getTextStyles()}>
        {data.formatting.bullets ? (
          <ul className="list-disc ml-6">
            {content.split('\n').filter(line => line.trim()).map((line, index) => (
              <li key={index}>{line.trim()}</li>
            ))}
          </ul>
        ) : (
          content.split('\n').map((line, index) => (
            <div key={index}>{line}</div>
          ))
        )}
      </Tag>
    </div>
  );
}

function SessionDetailsPreview({ data, mockData }: { data: SessionDetailsBlockData; mockData: Record<string, string> }) {
  return (
    <div className="bg-slate-50 p-4 rounded-lg border">
      <h3 className="font-semibold mb-3 text-slate-900">
        {data.customLabel || "Session Details"}
      </h3>
      <div className="space-y-2">
        {data.showDate && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600 w-16">Date:</span>
            <span className="text-sm">{mockData.session_date}</span>
          </div>
        )}
        {data.showTime && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600 w-16">Time:</span>
            <span className="text-sm">{mockData.session_time}</span>
          </div>
        )}
        {data.showLocation && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600 w-16">Location:</span>
            <span className="text-sm">{mockData.session_location}</span>
          </div>
        )}
        {data.showNotes && (
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-slate-600 w-16">Notes:</span>
            <span className="text-sm">{data.customNotes || "Please arrive 10 minutes early. Bring comfortable outfits!"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CTABlockPreview({ data, replacePlaceholders }: { data: CTABlockData; replacePlaceholders: (text: string) => string }) {
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

  const getButtonStyles = () => {
    const brandColor = organizationSettings?.primary_brand_color || "#1EB29F";
    
    switch (data.variant) {
      case "secondary":
        return `bg-gray-100 text-gray-800 px-6 py-3 rounded-md font-medium inline-block no-underline border border-gray-300`;
      case "text":
        return `font-medium underline inline-block no-underline`;
      default:
        return `text-white px-6 py-3 rounded-md font-medium inline-block no-underline`;
    }
  };

  const getButtonStyle = () => {
    const brandColor = organizationSettings?.primary_brand_color || "#1EB29F";
    
    switch (data.variant) {
      case "text":
        return { color: brandColor };
      case "secondary":
        return {};
      default:
        return { backgroundColor: brandColor };
    }
  };

  const buttonContent = replacePlaceholders(data.text);

  return (
    <div className="text-center">
      {data.link ? (
        <a href={data.link} className={getButtonStyles()} style={getButtonStyle()}>
          {buttonContent}
        </a>
      ) : (
        <button className={getButtonStyles()} style={getButtonStyle()}>
          {buttonContent}
        </button>
      )}
    </div>
  );
}

function ImageBlockPreview({ data, replacePlaceholders }: { data: ImageBlockData; replacePlaceholders: (text: string) => string }) {
  return (
    <div className="text-center">
      {data.placeholder || !data.src ? (
        <div className="w-full h-48 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-400 mb-2">🖼️</div>
            <p className="text-sm text-gray-500">Image Placeholder</p>
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
        <p className="text-sm text-gray-600 mt-2">{replacePlaceholders(data.caption)}</p>
      )}
    </div>
  );
}

function FooterBlockPreview({ data, mockData, organizationSettings }: { data: FooterBlockData; mockData: Record<string, string>; organizationSettings: any }) {
  const businessName = organizationSettings?.photography_business_name || mockData.business_name || 'Your Business';
  const businessPhone = organizationSettings?.phone || mockData.business_phone || '+1 (555) 123-4567';
  const businessEmail = organizationSettings?.email || mockData.business_email || `hello@${businessName.toLowerCase().replace(/\s+/g, '')}.com`;
  const logoUrl = organizationSettings?.logo_url;
  const socialChannels = (organizationSettings?.social_channels as Record<string, SocialChannel>) || {};

  // Filter and prepare social links
  const validSocialLinks = Object.entries(socialChannels)
    .filter(([key, channel]) => channel.enabled && channel.url)
    .map(([key, channel]) => ({
      platform: channel.platform,
      name: channel.customPlatformName || channel.name,
      url: channel.url
    }));

  return (
    <div className="border-t pt-6 mt-8 text-center text-sm text-gray-600">
      {data.showLogo && (
        <div className="mb-3 flex justify-center">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={`${businessName} Logo`} 
              className="max-w-[80px] max-h-[80px] object-contain"
            />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              {businessName.charAt(0)}
            </div>
          )}
        </div>
      )}
      
      {data.showStudioName && (
        <div className="font-semibold text-gray-800 mb-2">
          {businessName}
        </div>
      )}
      
      {data.showContactInfo && (
        <div className="space-y-1 mb-3">
          <div>{businessPhone}</div>
          <div>{businessEmail}</div>
        </div>
      )}

      {data.showSocialLinks && validSocialLinks.length > 0 && (
        <div className="mb-3">
          <div className="flex justify-center gap-4 flex-wrap">
            {validSocialLinks.map((link, index) => (
              <a 
                key={index} 
                href={link.url} 
                className="text-blue-600 hover:text-blue-800 text-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.name}
              </a>
            ))}
          </div>
        </div>
      )}
      
      {data.customText && (
        <div className="mt-3 italic">
          {data.customText}
        </div>
      )}
    </div>
  );
}

// New block preview components
function DividerBlockPreview({ data }: { data: any }) {
  if (data.style === "line") {
    return <hr style={{ borderColor: data.color || "#e5e5e5", margin: "20px 0" }} />;
  } else {
    return <div style={{ height: data.height || 20 }}></div>;
  }
}

function SocialLinksBlockPreview({ data }: { data: any }) {
  return (
    <div className="text-center py-4">
      <div className="flex justify-center gap-4">
        {data.links.filter((link: any) => link.show && link.url).map((link: any) => (
          <a key={link.platform} href={link.url} className="text-blue-600 capitalize underline">
            {link.platform}
          </a>
        ))}
      </div>
    </div>
  );
}

function HeaderBlockPreview({ data, replacePlaceholders, organizationSettings }: { data: any; replacePlaceholders: (text: string) => string; organizationSettings?: any }) {
  const { activeOrganization } = useOrganization();
  const [orgSettings, setOrgSettings] = useState<any>(organizationSettings);

  useEffect(() => {
    if (!orgSettings && activeOrganization?.id) {
      const fetchSettings = async () => {
        const { data } = await supabase
          .from("organization_settings")
          .select("photography_business_name, logo_url")
          .eq("organization_id", activeOrganization.id)
          .single();
        setOrgSettings(data);
      };
      fetchSettings();
    }
  }, [activeOrganization?.id, orgSettings]);

  const businessName = orgSettings?.photography_business_name || 'Your Business';
  const logoUrl = orgSettings?.logo_url;
  const alignment = data.logoAlignment || "center";
  const hasBackground = data.backgroundColor && data.backgroundColor !== "#ffffff";

  const getAlignmentStyle = () => {
    switch (alignment) {
      case "left": return "text-left";
      case "right": return "text-right";
      case "center":
      default: return "text-center";
    }
  };

  const getJustifyStyle = () => {
    switch (alignment) {
      case "left": return "justify-start";
      case "right": return "justify-end";
      case "center":
      default: return "justify-center";
    }
  };

  const getPaddingClass = () => {
    if (hasBackground && alignment === "left") {
      return "px-6 py-6"; // Add horizontal padding when background and left aligned
    }
    return "py-6";
  };

  return (
    <div 
      className={`rounded-lg ${getAlignmentStyle()} ${getPaddingClass()}`}
      style={{ backgroundColor: data.backgroundColor || "#ffffff" }}
    >
      {data.showLogo && (
        <div className={`mb-3 flex ${getJustifyStyle()}`}>
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={`${businessName} Logo`} 
              className="max-w-[120px] max-h-[60px] object-contain"
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              {businessName.charAt(0)}
            </div>
          )}
        </div>
      )}
      {data.tagline && (
        <p 
          className="text-lg font-medium"
          style={{ color: data.taglineColor || "#000000" }}
        >
          {replacePlaceholders(data.tagline)}
        </p>
      )}
    </div>
  );
}

function RawHTMLBlockPreview({ data }: { data: any }) {
  return (
    <div className="border-2 border-dashed border-amber-300 bg-amber-50 p-4">
      <div className="text-sm text-amber-700 mb-2">⚠️ Raw HTML Block (sanitized in production)</div>
      <div dangerouslySetInnerHTML={{ __html: data.html || '<p>No HTML content</p>' }} />
    </div>
  );
}