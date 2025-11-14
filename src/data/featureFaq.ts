import faqJson from "../../docs/lumiso-feature-faq.json";

export interface FeatureFaqEntry {
  id: string;
  question: string;
  answer: string;
  related_features?: string[];
  related_docs?: string[];
}

export interface FeatureFaqCategory {
  category: string;
  entries: FeatureFaqEntry[];
}

export interface FeatureFaqData {
  faq_categories: FeatureFaqCategory[];
}

const featureFaqData = faqJson as FeatureFaqData;

export const featureFaqCategories: FeatureFaqCategory[] = featureFaqData.faq_categories;

export interface FeatureFaqEntryWithCategory extends FeatureFaqEntry {
  category: string;
}

export const featureFaqEntriesFlat: FeatureFaqEntryWithCategory[] = featureFaqCategories.flatMap(
  (category) =>
    category.entries.map((entry) => ({
      ...entry,
      category: category.category,
    }))
);

export function searchFeatureFaq(query: string): FeatureFaqEntryWithCategory[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return featureFaqEntriesFlat.filter(
    (entry) =>
      entry.question.toLowerCase().includes(normalized) || entry.answer.toLowerCase().includes(normalized)
  );
}
