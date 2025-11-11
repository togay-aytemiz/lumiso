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

function buildPreviewData(
  base: Record<string, string>,
  lead: {
    name: string;
    email: string;
    phone: string;
    status: string;
    dueDate: string;
    createdDate: string;
    updatedDate: string;
  }
): Record<string, string> {
  return {
    ...base,
    customer_name: lead.name,
    lead_name: lead.name,
    customer_email: lead.email,
    lead_email: lead.email,
    customer_phone: lead.phone,
    lead_phone: lead.phone,
    lead_status: lead.status,
    lead_due_date: lead.dueDate,
    lead_created_date: lead.createdDate,
    lead_updated_date: lead.updatedDate,
  };
}

// Get preview data sets based on language
export function getPreviewDataSets(language: string = 'en') {
  if (language === 'tr') {
    return [
      {
        name: "Tam Veri",
        data: buildPreviewData({
          session_name: "Nişan Çekimi",
          session_date: "15 Mart 2024",
          session_time: "14:00",
          session_location: "Merkez Stüdyo",
          session_type: "Nişan",
          session_duration: "90 dakika",
          session_status: "Planlandı",
          session_meeting_url: "https://meet.example.com/elif-mert",
          session_notes: "Hazırlıklarınızı paylaşmayı unutmayın.",
          business_name: "Parlak Fotoğrafçılık",
          business_phone: "(555) 123-4567",
          business_email: "merhaba@parlakfotografcilik.com",
          project_name: "Yaz Düğünü",
          project_package_name: "Lüks Düğün Paketi"
        }, {
          name: "Elif & Mert",
          email: "elif.mert@example.com",
          phone: "+90 555 123 4567",
          status: "Planlandı",
          dueDate: "20 Mart 2024",
          createdDate: "1 Mart 2024",
          updatedDate: "10 Mart 2024"
        })
      },
      {
        name: "Eksik Alanlar",
        data: buildPreviewData({
          session_date: "20 Mart 2024",
          session_notes: "Ekipman listesi mailde.",
          business_name: "Parlak Fotoğrafçılık",
          business_phone: "(555) 123-4567",
          session_status: "Beklemede",
          project_name: "Portre Çalışması"
        }, {
          name: "Ayşe Yılmaz",
          email: "ayse@example.com",
          phone: "+90 555 987 6543",
          status: "Beklemede",
          dueDate: "25 Mart 2024",
          createdDate: "5 Mart 2024",
          updatedDate: "12 Mart 2024"
        })
      },
      {
        name: "Uzun İsimler",
        data: buildPreviewData({
          session_name: "Şehir Dışı Çift Çekimi",
          session_date: "25 Mart 2024", 
          session_time: "10:30",
          session_location: "Merkez Park Fotoğraf Stüdyosu ve Etkinlik Alanı",
          session_type: "Özel",
          session_duration: "120 dakika",
          session_status: "Hazırlık",
          session_meeting_url: "https://meet.example.com/zeynep",
          session_notes: "Şehir dışı seyahati planlayalım.",
          business_name: "Profesyonel Düğün ve Portre Fotoğraf Stüdyosu",
          business_phone: "(555) 987-6543",
          customer_email: "zeynep.nur.kaya.demir@example.com",
          business_email: "iletisim@profesyoneldugünportre.com",
          project_name: "Kıyı Düğünü",
          project_package_name: "Premium Paket"
        }, {
          name: "Zeynep Nur Kaya-Demir",
          email: "zeynep.nur.kaya.demir@example.com",
          phone: "+90 555 222 3344",
          status: "Hazırlık",
          dueDate: "30 Mart 2024",
          createdDate: "3 Mart 2024",
          updatedDate: "14 Mart 2024"
        })
      }
    ];
  }
  
  // Default English data
  return [
    {
      name: "Complete Data",
      data: buildPreviewData({
        session_name: "Downtown Portrait Session",
        session_date: "March 15, 2024",
        session_time: "2:00 PM",
        session_location: "Studio Downtown",
        session_type: "Engagement",
        session_duration: "90 minutes",
        session_status: "Confirmed",
        session_meeting_url: "https://meet.example.com/sarah",
        session_notes: "Please bring your favorite outfit options.",
        business_name: "Radiant Photography",
        business_phone: "(555) 123-4567",
        business_email: "hello@radiantphotography.com",
        project_name: "Spring Wedding",
        project_package_name: "Signature Wedding Collection"
      }, {
        name: "Sarah Johnson",
        email: "sarah@example.com",
        phone: "(555) 987-6543",
        status: "Confirmed",
        dueDate: "March 28, 2024",
        createdDate: "March 1, 2024",
        updatedDate: "March 10, 2024"
      })
    },
    {
      name: "Missing Fields",
      data: buildPreviewData({
        session_date: "March 20, 2024",
        session_notes: "We'll confirm wardrobe soon.",
        business_name: "Radiant Photography",
        business_phone: "(555) 123-4567",
        session_status: "Pending"
      }, {
        name: "John Doe",
        email: "john@example.com",
        phone: "(555) 222-1111",
        status: "Pending",
        dueDate: "April 2, 2024",
        createdDate: "March 5, 2024",
        updatedDate: "March 9, 2024"
      })
    },
    {
      name: "Long Names",
      data: buildPreviewData({
        session_name: "Destination Sunset Session",
        session_date: "March 25, 2024", 
        session_time: "10:30 AM",
        session_location: "Central Park Photography Studio & Event Space",
        session_type: "Editorial",
        session_duration: "2 hours",
        session_status: "In Planning",
        session_meeting_url: "https://meet.example.com/alexandra",
        session_notes: "Prep call scheduled for next week.",
        business_name: "Professional Wedding & Portrait Photography Studio",
        business_phone: "(555) 987-6543",
        business_email: "contact@professionalweddingportraitstudio.com",
        project_name: "City Hall Ceremony",
        project_package_name: "Elite Collection"
      }, {
        name: "Alexandra Thompson-Williams",
        email: "alexandra.thompson.williams@example.com",
        phone: "(555) 444-7777",
        status: "In Planning",
        dueDate: "April 10, 2024",
        createdDate: "March 3, 2024",
        updatedDate: "March 14, 2024"
      })
    }
  ];
}

// Backward compatibility
export const previewDataSets = getPreviewDataSets('en');

export const emojis = [
  '📸', '💝', '✨', '🎉', '💕', '👋', '📅', '⏰', '📍', '💫',
  '🌟', '💎', '🎊', '💖', '📧', '💬', '📱', '🔥', '💯', '⭐'
];
