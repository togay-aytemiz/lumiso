import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { Languages, Check } from "lucide-react";

interface LanguageSwitcherProps {
  variant?: "button" | "compact";
  className?: string;
}

export function LanguageSwitcher({ variant = "button", className }: LanguageSwitcherProps) {
  const { currentLanguage, availableLanguages, changeLanguage, isLoading } = useLanguage();
  const [isChanging, setIsChanging] = useState(false);

  const currentLang = availableLanguages.find(lang => lang.code === currentLanguage);

  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage) return;
    
    setIsChanging(true);
    try {
      await changeLanguage(languageCode);
    } finally {
      setIsChanging(false);
    }
  };

  if (variant === "compact") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={className} disabled={isLoading || isChanging}>
            <Badge variant="outline" className="text-xs">
              {currentLanguage.toUpperCase()}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableLanguages.map((language) => (
            <DropdownMenuItem
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className="flex items-center justify-between"
            >
              <span>{language.native_name}</span>
              {language.code === currentLanguage && (
                <Check className="w-4 h-4 ml-2" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className} disabled={isLoading || isChanging}>
          <Languages className="w-4 h-4 mr-2" />
          {currentLang?.native_name || currentLanguage.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {availableLanguages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="font-medium">{language.native_name}</span>
              <span className="text-xs text-muted-foreground">{language.name}</span>
            </div>
            {language.code === currentLanguage && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}