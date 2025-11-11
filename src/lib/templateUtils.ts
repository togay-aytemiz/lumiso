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
          session_name: "Nişan Çekimi",
          session_date: "15 Mart 2024",
          session_time: "14:00",
          session_location: "Merkez Stüdyo",
          session_type: "Nişan",
          session_duration: "90 dakika",
          session_status: "Planlandı",
          session_meeting_url: "https://meet.example.com/elif-mert",
          business_name: "Parlak Fotoğrafçılık",
          business_phone: "(555) 123-4567",
          customer_email: "elif.mert@example.com",
          business_email: "merhaba@parlakfotografcilik.com",
          project_name: "Yaz Düğünü",
          project_package_name: "Lüks Düğün Paketi"
        }
      },
      {
        name: "Eksik Alanlar",
        data: {
          customer_name: "Ayşe Yılmaz",
          session_date: "20 Mart 2024",
          business_name: "Parlak Fotoğrafçılık",
          business_phone: "(555) 123-4567",
          session_status: "Beklemede",
          project_name: "Portre Çalışması"
          // Missing time, location, emails
        }
      },
      {
        name: "Uzun İsimler",
        data: {
          customer_name: "Zeynep Nur Kaya-Demir",
          session_name: "Şehir Dışı Çift Çekimi",
          session_date: "25 Mart 2024", 
          session_time: "10:30",
          session_location: "Merkez Park Fotoğraf Stüdyosu ve Etkinlik Alanı",
          session_type: "Özel",
          session_duration: "120 dakika",
          session_status: "Hazırlık",
          session_meeting_url: "https://meet.example.com/zeynep",
          business_name: "Profesyonel Düğün ve Portre Fotoğraf Stüdyosu",
          business_phone: "(555) 987-6543",
          customer_email: "zeynep.nur.kaya.demir@example.com",
          business_email: "iletisim@profesyoneldugünportre.com",
          project_name: "Kıyı Düğünü",
          project_package_name: "Premium Paket"
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
        session_name: "Downtown Portrait Session",
        session_date: "March 15, 2024",
        session_time: "2:00 PM",
        session_location: "Studio Downtown",
        session_type: "Engagement",
        session_duration: "90 minutes",
        session_status: "Confirmed",
        session_meeting_url: "https://meet.example.com/sarah",
        business_name: "Radiant Photography",
        business_phone: "(555) 123-4567",
        customer_email: "sarah@example.com",
        business_email: "hello@radiantphotography.com",
        project_name: "Spring Wedding",
        project_package_name: "Signature Wedding Collection"
      }
    },
    {
      name: "Missing Fields",
      data: {
        customer_name: "John Doe",
        session_date: "March 20, 2024",
        business_name: "Radiant Photography",
        business_phone: "(555) 123-4567",
        session_status: "Pending"
        // Missing time, location, emails
      }
    },
    {
      name: "Long Names",
      data: {
        customer_name: "Alexandra Thompson-Williams",
        session_name: "Destination Sunset Session",
        session_date: "March 25, 2024", 
        session_time: "10:30 AM",
        session_location: "Central Park Photography Studio & Event Space",
        session_type: "Editorial",
        session_duration: "2 hours",
        session_status: "In Planning",
        session_meeting_url: "https://meet.example.com/alexandra",
        business_name: "Professional Wedding & Portrait Photography Studio",
        business_phone: "(555) 987-6543",
        customer_email: "alexandra.thompson.williams@example.com",
        business_email: "contact@professionalweddingportraitstudio.com",
        project_name: "City Hall Ceremony",
        project_package_name: "Elite Collection"
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
