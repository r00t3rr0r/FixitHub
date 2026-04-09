import { useTranslation } from 'react-i18next';
import { Check, Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' }
];

export function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (languageCode: string) => {
    console.log(`LanguageSelector: Changing language to ${languageCode}`);
    i18n.changeLanguage(languageCode);
    localStorage.setItem('i18nextLng', languageCode);
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={t('header.languageSelector')}
          className="h-9 w-9 rounded-lg border border-border/60 bg-background/70 text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Languages className="h-[18px] w-[18px]" />
          <span className="sr-only">{t('header.languageSelector')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[170px] rounded-xl border border-border bg-card p-1.5 shadow-xl"
      >
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className={`group cursor-pointer rounded-lg px-3 py-2.5 transition-colors ${
              currentLanguage.code === language.code
                ? 'bg-accent font-semibold text-accent-foreground'
                : 'text-foreground hover:bg-accent/80'
            }`}
          >
            <div className="flex w-full items-center justify-between gap-3">
              <span className="font-medium">{language.nativeName}</span>
              <span className="text-xs text-muted-foreground">{language.code.toUpperCase()}</span>
            </div>
            {currentLanguage.code === language.code && (
              <Check className="ml-2 h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
