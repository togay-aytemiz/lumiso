// Template utility functions for variable replacement, validation, etc.

import type { TemplateBlock } from "@/types/templateBuilder";
import { blocksToPlainText } from "./templateBlockUtils";
import { replacePlaceholders } from "./templatePlaceholders";

export { replacePlaceholders };

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

// Plain text generation - use blocks if available, fallback to simple text processing
export function generatePlainText(
  blocksOrText: TemplateBlock[] | string,
  mockData: Record<string, string> = {}
): string {
  // If it's an array of blocks, use the new block-to-plaintext converter
  if (Array.isArray(blocksOrText)) {
    return blocksToPlainText(blocksOrText, mockData);
  }
  
  // Legacy fallback for simple text processing
  if (typeof blocksOrText === 'string') {
    return replacePlaceholders(blocksOrText, mockData);
  }
  
  return 'No content available';
}

// Get preview data sets based on language
export function getPreviewDataSets(language: string = 'en') {
  if (language === 'tr') {
    return [
      {
        name: "Tam Veri",
        data: {
          customer_name: "Elif & Mert",
          session_date: "15 Mart 2024",
          session_time: "14:00",
          session_location: "Merkez Stüdyo",
          business_name: "Parlak Fotoğrafçılık",
          business_phone: "(555) 123-4567",
          customer_email: "elif.mert@example.com",
          business_email: "merhaba@parlakfotografcilik.com"
        }
      },
      {
        name: "Eksik Alanlar",
        data: {
          customer_name: "Ayşe Yılmaz",
          session_date: "20 Mart 2024",
          business_name: "Parlak Fotoğrafçılık",
          business_phone: "(555) 123-4567"
          // Missing time, location, emails
        }
      },
      {
        name: "Uzun İsimler",
        data: {
          customer_name: "Zeynep Nur Kaya-Demir",
          session_date: "25 Mart 2024", 
          session_time: "10:30",
          session_location: "Merkez Park Fotoğraf Stüdyosu ve Etkinlik Alanı",
          business_name: "Profesyonel Düğün ve Portre Fotoğraf Stüdyosu",
          business_phone: "(555) 987-6543",
          customer_email: "zeynep.nur.kaya.demir@example.com",
          business_email: "iletisim@profesyoneldugünportre.com"
        }
      }
    ];
  }
  
  // Default English data
  return [
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
}

// Backward compatibility
export const previewDataSets = getPreviewDataSets('en');

export const emojis = [
  '📸', '💝', '✨', '🎉', '💕', '👋', '📅', '⏰', '📍', '💫',
  '🌟', '💎', '🎊', '💖', '📧', '💬', '📱', '🔥', '💯', '⭐'
];
