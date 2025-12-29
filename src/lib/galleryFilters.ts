import type { GalleryStatus } from "@/components/galleries/GalleryStatusChip";
import type {
  SelectionExportPhoto,
  SelectionExportRule,
} from "@/components/galleries/SelectionExportSheet";

export type GalleryTypeFilter = "all" | "selection" | "final";
export type StatusFilter = "active" | "pending" | "approved" | "archived";
export type GalleryFilterOptions = {
  typeFilter: GalleryTypeFilter;
  statusFilter: StatusFilter;
  searchTerm: string;
};

type GalleryLeadSummary = { name: string | null } | null;
type GallerySessionSummary = {
  session_name: string | null;
  lead?: GalleryLeadSummary;
} | null;
type GalleryProjectSummary = { name: string } | null;

export interface GalleryListItem {
  id: string;
  title: string;
  status: GalleryStatus;
  type: string;
  updatedAt: string;
  eventDate: string | null;
  expiresAt: string | null;
  session: GallerySessionSummary;
  project: GalleryProjectSummary;
  selectionNote: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  selectionCount: number;
  requiredCount: number;
  sizeBytes?: number | null;
  downloadedAt: string | null;
  coverUrl: string;
  exportPhotos: SelectionExportPhoto[];
  exportRules: SelectionExportRule[];
  previousStatus: GalleryStatus | null;
  totalAssetCount: number;
}

export const isSelectionGalleryType = (value: string) => value === "proof";
export const isFinalGalleryType = (value: string) => value === "final";

export const filterGalleriesByView = (
  galleries: GalleryListItem[],
  { typeFilter, statusFilter, searchTerm }: GalleryFilterOptions
) => {
  const matchesType = (gallery: GalleryListItem) => {
    if (typeFilter === "selection") return isSelectionGalleryType(gallery.type);
    if (typeFilter === "final") return isFinalGalleryType(gallery.type);
    return true;
  };

  const matchesStatus = (gallery: GalleryListItem) => {
    switch (statusFilter) {
      case "archived":
        return gallery.status === "archived";
      case "approved":
        return (
          typeFilter === "selection" &&
          gallery.status !== "archived" &&
          (gallery.isLocked || gallery.status === "approved")
        );
      case "pending":
        return (
          typeFilter === "selection" &&
          gallery.status !== "archived" &&
          gallery.status === "published" &&
          !gallery.isLocked
        );
      case "active":
      default:
        return gallery.status !== "archived";
    }
  };

  const matchesSearch = (gallery: GalleryListItem) => {
    if (!searchTerm.trim()) return true;
    const needle = searchTerm.toLowerCase();
    return (
      gallery.title.toLowerCase().includes(needle) ||
      (gallery.session?.session_name?.toLowerCase().includes(needle) ?? false) ||
      (gallery.project?.name?.toLowerCase().includes(needle) ?? false) ||
      (gallery.session?.lead?.name?.toLowerCase().includes(needle) ?? false)
    );
  };

  return galleries.filter((gallery) => matchesType(gallery) && matchesStatus(gallery) && matchesSearch(gallery));
};
