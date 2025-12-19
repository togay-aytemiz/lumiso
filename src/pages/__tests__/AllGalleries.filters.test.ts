import { filterGalleriesByView } from "../AllGalleries";

type GalleryListItem = Parameters<typeof filterGalleriesByView>[0][number];

const createGallery = (overrides: Partial<GalleryListItem> = {}): GalleryListItem => ({
  id: "gallery-1",
  title: "Test Gallery",
  status: "published",
  type: "proof",
  updatedAt: "2025-01-01T00:00:00Z",
  eventDate: null,
  session: {
    id: "session-1",
    session_name: "Test Session",
    session_date: "2025-01-01",
    lead: {
      id: "lead-1",
      name: "Ayse Yilmaz",
      email: null,
      phone: null,
    },
  },
  project: null,
  selectionNote: null,
  isLocked: false,
  lockedAt: null,
  selectionCount: 0,
  requiredCount: 0,
  coverUrl: "",
  exportPhotos: [],
  exportRules: [],
  ...overrides,
});

describe("filterGalleriesByView", () => {
  it("filters pending selection galleries", () => {
    const galleries = [
      createGallery({ id: "selection-pending", type: "proof", status: "published", isLocked: false }),
      createGallery({ id: "selection-approved", type: "proof", status: "approved", isLocked: true }),
      createGallery({ id: "final-active", type: "final", status: "published" }),
    ];

    const result = filterGalleriesByView(galleries, {
      typeFilter: "selection",
      statusFilter: "pending",
      searchTerm: "",
    });

    expect(result.map((gallery) => gallery.id)).toEqual(["selection-pending"]);
  });

  it("filters active final galleries", () => {
    const galleries = [
      createGallery({ id: "final-active", type: "final", status: "published" }),
      createGallery({ id: "final-archived", type: "final", status: "archived" }),
      createGallery({ id: "selection-active", type: "proof", status: "published" }),
    ];

    const result = filterGalleriesByView(galleries, {
      typeFilter: "final",
      statusFilter: "active",
      searchTerm: "",
    });

    expect(result.map((gallery) => gallery.id)).toEqual(["final-active"]);
  });

  it("matches search terms against titles and lead names", () => {
    const galleries = [
      createGallery({ id: "match-title", title: "Dugun Secimleri" }),
      createGallery({
        id: "match-lead",
        session: {
          id: "session-2",
          session_name: "Second Session",
          session_date: "2025-02-01",
          lead: {
            id: "lead-2",
            name: "Mehmet Demir",
            email: null,
            phone: null,
          },
        },
      }),
    ];

    const result = filterGalleriesByView(galleries, {
      typeFilter: "all",
      statusFilter: "active",
      searchTerm: "meHmet",
    });

    expect(result.map((gallery) => gallery.id)).toEqual(["match-lead"]);
  });
});
