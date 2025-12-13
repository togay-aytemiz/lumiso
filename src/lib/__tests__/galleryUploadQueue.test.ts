import { shouldKeepLocalUploadItem } from "@/lib/galleryUploadQueue";

describe("galleryUploadQueue", () => {
  it("keeps local items with a file", () => {
    expect(shouldKeepLocalUploadItem({ status: "done", file: new File(["x"], "a.jpg") })).toBe(true);
  });

  it.each(["queued", "uploading", "processing"])("keeps in-progress items (%s)", (status) => {
    expect(shouldKeepLocalUploadItem({ status })).toBe(true);
  });

  it("keeps items that were enqueued locally", () => {
    expect(shouldKeepLocalUploadItem({ status: "done", enqueuedAt: Date.now() })).toBe(true);
  });

  it("drops persisted items that no longer exist server-side", () => {
    expect(shouldKeepLocalUploadItem({ status: "done" })).toBe(false);
  });
});

