export interface TemplateVariable {
  key: string;
  label: string;
  category: "lead" | "session" | "business" | "custom";
}

export interface TextBlockData {
  content: string;
  formatting: {
    bold?: boolean;
    italic?: boolean;
    fontSize: "h1" | "h2" | "h3" | "p";
    fontFamily?: string;
    bullets?: boolean;
    alignment?: "left" | "center" | "right" | "justify";
  };
}

export interface DividerBlockData {
  style: "line" | "space";
  height?: number;
  color?: string;
}

export interface ColumnsBlockData {
  columns: number;
  content: string[];
}

export interface SocialLinksBlockData {
  links: Array<{
    platform: "facebook" | "instagram" | "twitter" | "website";
    url: string;
    show: boolean;
  }>;
}

export interface HeaderBlockData {
  showLogo: boolean;
  logoAlignment?: "left" | "center" | "right";
  tagline?: string;
  taglineColor?: string;
  backgroundColor?: string;
}

export interface RawHTMLBlockData {
  html: string;
  sanitized: boolean;
}

export interface SessionDetailsBlockData {
  showDate: boolean;
  showTime: boolean;
  showLocation: boolean;
  showNotes: boolean;
  customLabel?: string;
  customNotes?: string;
}

export interface CTABlockData {
  text: string;
  variant: "primary" | "secondary" | "text";
  link?: string;
}

export interface ImageBlockData {
  src?: string;
  alt?: string;
  caption?: string;
  link?: string;
  placeholder: boolean;
}

export interface FooterBlockData {
  showLogo: boolean;
  showStudioName: boolean;
  showContactInfo: boolean;
  customText?: string;
  showUnsubscribe?: boolean;
  showMailingAddress?: boolean;
  showLegalText?: boolean;
}

export type BlockData = 
  | TextBlockData
  | SessionDetailsBlockData
  | CTABlockData
  | ImageBlockData
  | FooterBlockData
  | DividerBlockData
  | ColumnsBlockData
  | SocialLinksBlockData
  | HeaderBlockData
  | RawHTMLBlockData;

export interface TemplateBlock {
  id: string;
  type: "text" | "session-details" | "cta" | "image" | "footer" | "divider" | "columns" | "social-links" | "header" | "raw-html";
  data: BlockData;
  visible: boolean;
  order: number;
}

export interface TemplateBuilderState {
  blocks: TemplateBlock[];
  activeBlock: string | null;
  previewChannel: "email" | "whatsapp" | "sms";
  previewDevice: "desktop" | "mobile";
  emailSubject?: string;
  preheader?: string;
}

export interface PreviewDataSet {
  name: string;
  data: Record<string, string>;
}