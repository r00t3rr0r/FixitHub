import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
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
          className="h-9 w-9 rounded-lg transition-colors"
        >
          <Languages className="h-[18px] w-[18px]" />
          <span className="sr-only">{t('header.languageSelector')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className={`cursor-pointer transition-colors ${
              currentLanguage.code === language.code
                ? 'bg-accent font-semibold'
                : ''
            }`}
          >
            <span className="font-medium">{language.nativeName}</span>
            {currentLanguage.code === language.code && (
              <span className="ml-2 text-xs text-primary font-bold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
