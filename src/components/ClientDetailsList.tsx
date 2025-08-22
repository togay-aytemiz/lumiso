import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageCircle, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface ClientDetailsListProps {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  clickableNameHref?: string; // if provided, name becomes a link
  clickableNameClasses?: string; // custom classes for clickable name (e.g., blue link)
  showQuickActions?: boolean; // default true
  clampNotes?: boolean; // if false, never truncate notes
  onNameClick?: () => void; // callback for name clicks
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

export function ClientDetailsList({ name, email, phone, notes, clickableNameHref, clickableNameClasses, showQuickActions = true, clampNotes = true, onNameClick }: ClientDetailsListProps) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [isNotesTruncatable, setIsNotesTruncatable] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clampNotes) { setIsNotesTruncatable(false); return; }
    if (!notesRef.current || !notes) { setIsNotesTruncatable(false); return; }
    const el = notesRef.current;
    requestAnimationFrame(() => {
      if (!el) return;
      setIsNotesTruncatable(el.scrollHeight > el.clientHeight + 1);
    });
  }, [notes, notesExpanded, clampNotes]);

  const normalized = useMemo(() => normalizeTRPhone(phone), [phone]);

  return (
    <div>
      {/* Rows */}
      <div className="space-y-1">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-baseline min-w-0">
            <span className="text-xs text-muted-foreground flex-shrink-0">Name:</span>
            {(() => { const v = (name && name.trim()) ? name : null; return v ? (
              clickableNameHref ? (
                <Button
                  asChild
                  variant="link"
                  className="ml-1 p-0 h-auto text-left justify-start font-medium text-xs min-w-0"
                >
                  <Link to={clickableNameHref} className={cn(clickableNameClasses, "truncate")}>{v}</Link>
                </Button>
              ) : onNameClick ? (
                <button
                  onClick={onNameClick}
                  className={cn("ml-1 text-xs font-medium truncate min-w-0 flex-1 text-left hover:underline", clickableNameClasses)}
                >
                  {v}
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 text-xs font-medium truncate min-w-0 flex-1">{v}</span>
                  </TooltipTrigger>
                  <TooltipContent>{v}</TooltipContent>
                </Tooltip>
              )
            ) : (
              <span className="ml-1 text-xs font-medium">—</span>
            ); })()}
          </div>

          <div className="flex items-baseline min-w-0">
            <span className="text-xs text-muted-foreground flex-shrink-0">Email:</span>
            {(() => { const v = (email && email.trim()) ? email : null; return v ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-1 text-xs font-medium truncate min-w-0 flex-1">{v}</span>
                </TooltipTrigger>
                <TooltipContent>{v}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="ml-1 text-xs font-medium">—</span>
            ); })()}
          </div>

          <div className="flex items-baseline min-w-0">
            <span className="text-xs text-muted-foreground flex-shrink-0">Phone:</span>
            {(() => { const v = normalized ? normalized.e164 : ((phone && phone.trim()) ? phone : null); return v ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-1 text-xs font-medium truncate min-w-0 flex-1">{v}</span>
                </TooltipTrigger>
                <TooltipContent>{v}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="ml-1 text-xs font-medium">—</span>
            ); })()}
          </div>

          <div className="flex items-start min-w-0">
            <span className="text-xs text-muted-foreground mt-[2px] flex-shrink-0">Notes:</span>
            {notes ? (
              <div className="ml-1 flex-1 min-w-0">
                <div className="relative">
                  <div
                    ref={notesRef}
                    className={cn(
                      "text-xs transition-all whitespace-pre-wrap break-words",
                      clampNotes && !notesExpanded && "max-h-12 overflow-hidden"
                    )}
                  >
                    {notes}
                  </div>
                </div>
                {clampNotes && (isNotesTruncatable || notesExpanded) && (
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
              <span className="ml-1 text-xs font-medium">—</span>
            )}
          </div>
        </TooltipProvider>
      </div>

      {showQuickActions && (
        <div className="border-t mt-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {normalized && (
              <Button asChild variant="secondary" size="sm" className="rounded-xl gap-2">
                <a
                  href={`https://wa.me/${normalized.e164NoPlus}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  WhatsApp
                </a>
              </Button>
            )}
            {normalized && (
              <Button asChild variant="secondary" size="sm" className="rounded-xl gap-2">
                <a href={`tel:${normalized.e164}`} aria-label="Call">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                    <Phone className="h-4 w-4" />
                  </span>
                  Call
                </a>
              </Button>
            )}
            {isValidEmail(email) && (
              <Button asChild variant="secondary" size="sm" className="rounded-xl gap-2">
                <a href={`mailto:${email || ""}`} aria-label="Email">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                    <Mail className="h-4 w-4" />
                  </span>
                  Email
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
