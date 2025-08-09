import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientDetailsListProps {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  clickableNameHref?: string; // if provided, name becomes a link
  showQuickActions?: boolean; // default true
}

const isValidEmail = (email?: string | null) => !!email && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);

function normalizeTRPhone(phone?: string | null): null | { e164: string; e164NoPlus: string } {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  let e164 = "";
  if (phone.trim().startsWith("+")) {
    if (digits.startsWith("90") && digits.length === 12) {
      e164 = "+" + digits;
    } else {
      return null;
    }
  } else if (digits.startsWith("90") && digits.length === 12) {
    e164 = "+" + digits;
  } else if (digits.startsWith("0") && digits.length === 11) {
    e164 = "+90" + digits.slice(1);
  } else if (digits.length === 10) {
    e164 = "+90" + digits;
  } else {
    return null;
  }
  return { e164, e164NoPlus: e164.slice(1) };
}

export function ClientDetailsList({ name, email, phone, notes, clickableNameHref, showQuickActions = true }: ClientDetailsListProps) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [isNotesTruncatable, setIsNotesTruncatable] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notesRef.current || !notes) { setIsNotesTruncatable(false); return; }
    const el = notesRef.current;
    requestAnimationFrame(() => {
      if (!el) return;
      setIsNotesTruncatable(el.scrollHeight > el.clientHeight + 1);
    });
  }, [notes, notesExpanded]);

  const normalized = useMemo(() => normalizeTRPhone(phone), [phone]);

  return (
    <div>
      {/* Rows */}
      <div className="space-y-1">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-baseline overflow-hidden">
            <span className="text-xs text-muted-foreground">Name:</span>
            {(() => { const v = (name && name.trim()) ? name : null; return v ? (
              clickableNameHref ? (
                <Button
                  asChild
                  variant="link"
                  className="ml-1 p-0 h-auto text-left justify-start font-medium text-sm"
                >
                  <a href={clickableNameHref}>{v}</a>
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 text-sm font-medium truncate inline-block max-w-full">{v}</span>
                  </TooltipTrigger>
                  <TooltipContent>{v}</TooltipContent>
                </Tooltip>
              )
            ) : (
              <span className="ml-1 text-sm font-medium">—</span>
            ); })()}
          </div>

          <div className="flex items-baseline overflow-hidden">
            <span className="text-xs text-muted-foreground">Email:</span>
            {(() => { const v = (email && email.trim()) ? email : null; return v ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-1 text-sm font-medium truncate inline-block max-w-full">{v}</span>
                </TooltipTrigger>
                <TooltipContent>{v}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="ml-1 text-sm font-medium">—</span>
            ); })()}
          </div>

          <div className="flex items-baseline overflow-hidden">
            <span className="text-xs text-muted-foreground">Phone:</span>
            {(() => { const v = normalized ? normalized.e164 : ((phone && phone.trim()) ? phone : null); return v ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-1 text-sm font-medium truncate inline-block max-w-full">{v}</span>
                </TooltipTrigger>
                <TooltipContent>{v}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="ml-1 text-sm font-medium">—</span>
            ); })()}
          </div>

          <div className="flex items-start overflow-hidden">
            <span className="text-xs text-muted-foreground mt-[2px]">Notes:</span>
            {notes ? (
              <div className="ml-1 flex-1">
                <div className="relative">
                  <div
                    ref={notesRef}
                    className={cn(
                      "text-sm transition-all whitespace-pre-wrap",
                      !notesExpanded && "max-h-12 overflow-hidden"
                    )}
                    style={!notesExpanded ? { WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)", maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)" } : undefined}
                  >
                    {notes}
                  </div>
                </div>
                {(isNotesTruncatable || notesExpanded) && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-4 mt-1"
                    onClick={() => setNotesExpanded((v) => !v)}
                  >
                    {notesExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            ) : (
              <span className="ml-1 text-sm font-medium">—</span>
            )}
          </div>
        </TooltipProvider>
      </div>

      {showQuickActions && (
        <div className="border-t mt-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {normalized && (
              <Button asChild variant="secondary" size="sm">
                <a
                  href={`https://wa.me/${normalized.e164NoPlus}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                >
                  <MessageSquare className="mr-2" /> WhatsApp
                </a>
              </Button>
            )}
            {normalized && (
              <Button asChild variant="secondary" size="sm">
                <a href={`tel:${normalized.e164}`} aria-label="Call">
                  <Phone className="mr-2" /> Call
                </a>
              </Button>
            )}
            {isValidEmail(email) && (
              <Button asChild variant="secondary" size="sm">
                <a href={`mailto:${email || ""}`} aria-label="Email">
                  <Mail className="mr-2" /> Email
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientDetailsList;
