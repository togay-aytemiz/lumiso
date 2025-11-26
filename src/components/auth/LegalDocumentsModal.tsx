import React, { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LegalDocumentId } from "@/lib/legalVersions";
import { cn } from "@/lib/utils";

type LegalDocumentsModalProps = {
  open: boolean;
  activeDocument?: LegalDocumentId;
  onOpenChange: (open: boolean) => void;
  onDocumentChange?: (id: LegalDocumentId) => void;
};

const DOCUMENT_TABS: Array<{ id: LegalDocumentId; label: string; url: string }> = [
  { id: "terms", label: "Hizmet Şartları", url: "https://www.lumiso.app/terms" },
  { id: "privacy", label: "Gizlilik Politikası", url: "https://www.lumiso.app/privacy" },
  { id: "kvkk", label: "KVKK Aydınlatma Metni", url: "https://www.lumiso.app/kvkk" },
  {
    id: "communication-consent",
    label: "Ticari Elektronik İleti Bilgilendirme Metni",
    url: "https://www.lumiso.app/communication-consent",
  },
];

const defaultDocument = DOCUMENT_TABS[0].id;

export const LegalDocumentsModal: React.FC<LegalDocumentsModalProps> = ({
  open,
  activeDocument,
  onOpenChange,
  onDocumentChange,
}) => {
  const currentDoc = activeDocument ?? defaultDocument;
  const [docHtml, setDocHtml] = useState<Record<LegalDocumentId, string>>({});
  const [loadingDoc, setLoadingDoc] = useState<Record<LegalDocumentId, boolean>>({});
  const [docError, setDocError] = useState<Record<LegalDocumentId, string | null>>({});
  const [useIframeFallback, setUseIframeFallback] = useState<Record<LegalDocumentId, boolean>>({});

  const sanitizeHtml = useMemo(() => {
    return (html: string) => {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(html, "text/html");
      parsed.querySelectorAll("header, footer, nav").forEach((el) => el.remove());
      parsed.querySelectorAll("script, style").forEach((el) => el.remove());
      const bodyHtml = parsed.body?.innerHTML || html;
      return DOMPurify.sanitize(bodyHtml, { USE_PROFILES: { html: true } });
    };
  }, []);

  const fetchDoc = (docId: LegalDocumentId) => {
    const tab = DOCUMENT_TABS.find((d) => d.id === docId);
    if (!tab) return;
    if (docHtml[docId] || loadingDoc[docId]) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    setLoadingDoc((prev) => ({ ...prev, [docId]: true }));
    setDocError((prev) => ({ ...prev, [docId]: null }));

    fetch(tab.url, {
      signal: controller.signal,
      mode: "cors",
      referrerPolicy: "no-referrer",
      headers: { Accept: "text/html" },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load ${tab.url}`);
        return res.text();
      })
      .then((html) => {
        setDocHtml((prev) => ({ ...prev, [docId]: sanitizeHtml(html) }));
        setDocError((prev) => ({ ...prev, [docId]: null }));
        setUseIframeFallback((prev) => ({ ...prev, [docId]: false }));
      })
      .catch((error) => {
        console.error("Failed to load legal document", error);
        const message = error.name === "AbortError" ? "Bağlantı zaman aşımına uğradı" : "Belge yüklenemedi";
        setDocError((prev) => ({ ...prev, [docId]: message }));
        setUseIframeFallback((prev) => ({ ...prev, [docId]: true }));
      })
      .finally(() => {
        window.clearTimeout(timeout);
        setLoadingDoc((prev) => ({ ...prev, [docId]: false }));
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  };

  useEffect(() => {
    if (!open) return;
    fetchDoc(currentDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentDoc]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[min(96vw,1120px)] max-w-5xl p-0 sm:rounded-2xl",
          "overflow-hidden border-0 bg-white shadow-2xl"
        )}
      >
        <div className="flex h-[80vh] flex-col bg-white sm:h-[70vh]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary/80">
                Hukuki Belgeler
              </p>
              <p className="text-sm text-slate-500">
                Belgeleri incelemek için sekmeler arasında geçiş yapın.
              </p>
            </div>
          </div>

          <Tabs
            value={currentDoc}
            onValueChange={(value) => onDocumentChange?.(value as LegalDocumentId)}
            className="flex h-full flex-col"
          >
            <div className="border-b border-slate-200 bg-slate-50/70 px-2">
              <TabsList className="flex w-full justify-start gap-2 overflow-x-auto bg-transparent p-2 text-slate-600">
                {DOCUMENT_TABS.map((doc) => (
                  <TabsTrigger
                    key={doc.id}
                    value={doc.id}
                    className={cn(
                      "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                      "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm",
                      "hover:bg-white hover:text-primary"
                    )}
                  >
                    {doc.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {DOCUMENT_TABS.map((doc) => (
              <TabsContent
                key={doc.id}
                value={doc.id}
                className="flex flex-1 flex-col overflow-hidden"
              >
                <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6">
                  <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
                    {useIframeFallback[doc.id] ? (
                      <iframe
                        title={doc.label}
                        src={`${doc.url}?embedded=1`}
                        className="h-full w-full border-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full overflow-y-auto px-4 py-4">
                        {loadingDoc[doc.id] && (
                          <p className="text-sm text-slate-500">Yükleniyor...</p>
                        )}
                        {docError[doc.id] && !loadingDoc[doc.id] && (
                          <div className="space-y-2">
                            <p className="text-sm text-red-600">{docError[doc.id]}</p>
                            <button
                              type="button"
                              className="text-sm font-semibold underline underline-offset-2 text-primary"
                              onClick={() => fetchDoc(doc.id)}
                            >
                              Tekrar dene
                            </button>
                            <a
                              className="block text-sm underline underline-offset-2 text-slate-600"
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Yeni sekmede aç
                            </a>
                          </div>
                        )}
                        {docHtml[doc.id] && !loadingDoc[doc.id] && (
                          <div
                            className="prose max-w-none prose-slate"
                            dangerouslySetInnerHTML={{ __html: docHtml[doc.id] }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LegalDocumentsModal;
