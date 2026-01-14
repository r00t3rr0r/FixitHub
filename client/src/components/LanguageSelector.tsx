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
          className="relative group"
        >
          <Languages className="h-5 w-5 text-gray-700 group-hover:text-yellow-600 transition-all duration-200 group-hover:scale-110" />

          {/* Subtle hover effect ring */}
          <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ring-2 ring-yellow-400 ring-offset-2" />

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
                ? 'bg-yellow-50 hover:bg-yellow-100'
                : 'hover:bg-gray-50'
            }`}
          >
            <span className="font-medium">{language.nativeName}</span>
            {currentLanguage.code === language.code && (
              <span className="ml-2 text-xs text-yellow-600 font-bold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
