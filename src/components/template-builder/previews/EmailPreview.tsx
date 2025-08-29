import { TemplateBlock, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";
import { cn } from "@/lib/utils";

interface EmailPreviewProps {
  blocks: TemplateBlock[];
  mockData: Record<string, string>;
  device: "desktop" | "mobile";
  emailSubject?: string;
}

export function EmailPreview({ blocks, mockData, device, emailSubject }: EmailPreviewProps) {
  const replacePlaceholders = (text: string) => {
    return text.replace(/\{(\w+)\}/g, (match, key) => mockData[key] || match);
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
        <div><strong>From:</strong> {mockData.business_name} &lt;hello@{mockData.business_name.toLowerCase().replace(/\s+/g, '')}.com&gt;</div>
        <div><strong>To:</strong> {mockData.customer_name} &lt;{mockData.customer_name.toLowerCase().replace(/\s+/g, '')}@email.com&gt;</div>
        <div><strong>Subject:</strong> {emailSubject ? replacePlaceholders(emailSubject) : "📸 Your photography session is confirmed!"}</div>
      </div>

      {/* Email Body */}
      <div className={cn("p-6 space-y-6", device === "mobile" && "p-4 space-y-4")}>
        {blocks.map((block) => (
          <div key={block.id}>
            {block.type === "text" && (
              <TextBlockPreview data={block.data as TextBlockData} replacePlaceholders={replacePlaceholders} />
            )}
            {block.type === "session-details" && (
              <SessionDetailsPreview data={block.data as SessionDetailsBlockData} mockData={mockData} />
            )}
            {block.type === "cta" && (
              <CTABlockPreview data={block.data as CTABlockData} replacePlaceholders={replacePlaceholders} />
            )}
            {block.type === "image" && (
              <ImageBlockPreview data={block.data as ImageBlockData} replacePlaceholders={replacePlaceholders} />
            )}
            {block.type === "footer" && (
              <FooterBlockPreview data={block.data as FooterBlockData} mockData={mockData} />
            )}
          </div>
        ))}

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
    const styles: React.CSSProperties = {
      fontFamily: data.formatting.fontFamily,
      fontWeight: data.formatting.bold ? 'bold' : 'normal',
      fontStyle: data.formatting.italic ? 'italic' : 'normal',
      textAlign: data.formatting.alignment as any || 'left',
    };
    return styles;
  };

  const content = replacePlaceholders(data.content);
  const Tag = data.formatting.fontSize as keyof JSX.IntrinsicElements;

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
            <span className="text-sm">Please arrive 10 minutes early. Bring comfortable outfits!</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CTABlockPreview({ data, replacePlaceholders }: { data: CTABlockData; replacePlaceholders: (text: string) => string }) {
  const getButtonStyles = () => {
    switch (data.variant) {
      case "primary":
        return "bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors";
      case "secondary":
        return "bg-gray-200 text-gray-800 px-6 py-3 rounded-md font-medium hover:bg-gray-300 transition-colors";
      case "text":
        return "text-blue-600 underline font-medium";
      default:
        return "bg-blue-600 text-white px-6 py-3 rounded-md font-medium";
    }
  };

  return (
    <div className="text-center">
      <button className={getButtonStyles()}>
        {replacePlaceholders(data.text)}
      </button>
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
          className="w-full max-w-md mx-auto rounded-lg"
        />
      )}
      {data.caption && (
        <p className="text-sm text-gray-600 mt-2">{replacePlaceholders(data.caption)}</p>
      )}
    </div>
  );
}

function FooterBlockPreview({ data, mockData }: { data: FooterBlockData; mockData: Record<string, string> }) {
  return (
    <div className="border-t pt-6 mt-8 text-center text-sm text-gray-600">
      {data.showLogo && (
        <div className="mb-3">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mx-auto flex items-center justify-center text-white font-bold text-xl">
            {mockData.business_name.charAt(0)}
          </div>
        </div>
      )}
      
      {data.showStudioName && (
        <div className="font-semibold text-gray-800 mb-2">
          {mockData.business_name}
        </div>
      )}
      
      {data.showContactInfo && (
        <div className="space-y-1">
          <div>{mockData.business_phone}</div>
          <div>hello@{mockData.business_name.toLowerCase().replace(/\s+/g, '')}.com</div>
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