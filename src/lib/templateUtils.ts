// Template utility functions for variable replacement, validation, etc.

export function replacePlaceholders(text: string, data: Record<string, string>, allowFallbacks = true): string {
  if (!allowFallbacks) {
    return text.replace(/\{(\w+)\}/g, (match, key) => data[key] || match);
  }
  
  // Support fallback syntax: {variable|fallback}
  return text.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (match, key, fallback) => {
    return data[key] || fallback || match;
  });
}

export function getCharacterCount(text: string): number {
  return text.length;
}

export function checkSpamWords(text: string): string[] {
  const spamWords = [
    'free', 'urgent', 'limited time', 'act now', 'click here', 
    'guaranteed', 'make money', 'no cost', 'risk free', 'winner'
  ];
  
  const foundWords: string[] = [];
  const lowerText = text.toLowerCase();
  
  spamWords.forEach(word => {
    if (lowerText.includes(word)) {
      foundWords.push(word);
    }
  });
  
  return foundWords;
}

export function generatePlainText(blocks: any[], mockData: Record<string, string>): string {
  let plainText = '';
  
  blocks.forEach(block => {
    if (!block.visible) return;
    
    switch (block.type) {
      case 'text':
        plainText += replacePlaceholders(block.data.content, mockData) + '\n\n';
        break;
      case 'session-details':
        plainText += (block.data.customLabel || 'Session Details') + '\n';
        if (block.data.showDate) plainText += `Date: ${mockData.session_date}\n`;
        if (block.data.showTime) plainText += `Time: ${mockData.session_time}\n`;
        if (block.data.showLocation) plainText += `Location: ${mockData.session_location}\n`;
        if (block.data.showNotes) plainText += `Notes: Please arrive 10 minutes early\n`;
        plainText += '\n';
        break;
      case 'cta':
        plainText += `${block.data.text}\n`;
        if (block.data.link) plainText += `Link: ${block.data.link}\n`;
        plainText += '\n';
        break;
      case 'footer':
        if (block.data.showStudioName) plainText += `${mockData.business_name}\n`;
        if (block.data.showContactInfo) {
          plainText += `${mockData.business_phone}\n`;
          plainText += `hello@${mockData.business_name.toLowerCase().replace(/\s+/g, '')}.com\n`;
        }
        if (block.data.customText) plainText += `${block.data.customText}\n`;
        break;
    }
  });
  
  return plainText.trim();
}

export const previewDataSets = [
  {
    name: "Complete Data",
    data: {
      customer_name: "Sarah Johnson",
      session_date: "March 15, 2024",
      session_time: "2:00 PM",
      session_location: "Studio Downtown",
      business_name: "Radiant Photography",
      business_phone: "(555) 123-4567",
      customer_email: "sarah@example.com",
      business_email: "hello@radiantphotography.com"
    }
  },
  {
    name: "Missing Fields",
    data: {
      customer_name: "John Doe",
      session_date: "March 20, 2024",
      business_name: "Radiant Photography",
      business_phone: "(555) 123-4567"
      // Missing time, location, emails
    }
  },
  {
    name: "Long Names",
    data: {
      customer_name: "Alexandra Thompson-Williams",
      session_date: "March 25, 2024", 
      session_time: "10:30 AM",
      session_location: "Central Park Photography Studio & Event Space",
      business_name: "Professional Wedding & Portrait Photography Studio",
      business_phone: "(555) 987-6543",
      customer_email: "alexandra.thompson.williams@example.com",
      business_email: "contact@professionalweddingportraitstudio.com"
    }
  }
];

export const emojis = [
  '📸', '💝', '✨', '🎉', '💕', '👋', '📅', '⏰', '📍', '💫',
  '🌟', '💎', '🎊', '💖', '📧', '💬', '📱', '🔥', '💯', '⭐'
];