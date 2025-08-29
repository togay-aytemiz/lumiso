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

export interface SessionDetailsBlockData {
  showDate: boolean;
  showTime: boolean;
  showLocation: boolean;
  showNotes: boolean;
  customLabel?: string;
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
}

export type BlockData = 
  | TextBlockData
  | SessionDetailsBlockData
  | CTABlockData
  | ImageBlockData
  | FooterBlockData;

export interface TemplateBlock {
  id: string;
  type: "text" | "session-details" | "cta" | "image" | "footer";
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
}