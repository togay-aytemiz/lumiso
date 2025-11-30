import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import GlobalSearch from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";

const SearchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation("common");
  const fromPath = (location.state as { from?: string } | undefined)?.from;
  const initialQuery = searchParams.get("q") ?? "";

  const handleBack = useCallback(() => {
    if (fromPath) {
      navigate(fromPath, { replace: true });
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  }, [fromPath, navigate]);

  const handleQueryChange = useCallback(
    (value: string) => {
      const next = value.trim();
      if (next) {
        setSearchParams({ q: value }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    },
    [setSearchParams]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b border-border/60 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="px-4 pt-3 pb-3 sm:px-6 sm:pt-4 sm:pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-11 w-11 aspect-square rounded-full border border-border/70 bg-white/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">{t("buttons.back")}</span>
            </Button>
          </div>
          <div className="mx-auto w-full max-w-3xl">
            <GlobalSearch
              variant="page"
              autoFocus
              initialQuery={initialQuery}
              onQueryChange={handleQueryChange}
            />
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 pt-2 sm:px-6 sm:pt-3 sm:pb-8">
        <div className="mx-auto max-w-3xl">
          {/* Results render inline within the search component; spacer keeps scroll smooth */}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
