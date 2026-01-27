import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

interface HeroSectionProps {
  backgroundImage?: string;
  title?: string;
  subtitle?: string;
  ctaButtons?: Array<{
    label: string;
    link: string;
    variant?: 'default' | 'outline';
  }>;
}

export function HeroSection({
  backgroundImage = 'https://www.mcrepair.de/bilder/home/banner/home_banner.jpg',
  title,
  subtitle,
  ctaButtons
}: HeroSectionProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const defaultTitle = t('home.hero.title');
  const defaultSubtitle = t('home.hero.subtitle');
  const defaultButtons = [
    {
      label: t('home.hero.mobileRepair'),
      link: '/new-order',
      variant: 'default' as const
    },
    {
      label: t('home.hero.tabletRepair'),
      link: '/new-order',
      variant: 'default' as const
    },
    {
      label: t('home.hero.notebookRepair'),
      link: '/new-order',
      variant: 'default' as const
    }
  ];

  return (
    <section
      className="relative py-24 px-4 text-center text-white overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${backgroundImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="container mx-auto max-w-4xl">
        {/* Main Headline */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight drop-shadow-lg">
          {title || defaultTitle}
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg lg:text-xl mb-8 text-gray-100 drop-shadow-md leading-relaxed max-w-2xl mx-auto">
          {subtitle || defaultSubtitle}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          {(ctaButtons || defaultButtons).map((button, index) => (
            <Button
              key={index}
              size="sm"
              className={`
                px-6 py-2 font-semibold text-base
                transition-all duration-300 transform hover:scale-105
                ${
                  button.variant === 'outline'
                    ? 'bg-white text-primary hover:bg-gray-100'
                    : 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                }
              `}
              asChild
            >
              <Link to={button.link}>{button.label}</Link>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
