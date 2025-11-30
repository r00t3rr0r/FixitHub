import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Smartphone, Package, Wrench, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ServiceStep {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

interface ServicesOverviewProps {
  title?: string;
  steps?: ServiceStep[];
}

export function ServicesOverview({ title, steps }: ServicesOverviewProps) {
  const { t } = useTranslation();

  const defaultTitle = t('home.services.hoSoEinfachGehts');

  const defaultSteps: ServiceStep[] = [
    {
      icon: <Smartphone className="w-16 h-16 text-yellow-400 mx-auto mb-4" />,
      title: t('home.services.step1Title'),
      description: t('home.services.step1Desc')
    },
    {
      icon: <Package className="w-16 h-16 text-yellow-400 mx-auto mb-4" />,
      title: t('home.services.step2Title'),
      description: t('home.services.step2Desc')
    },
    {
      icon: <Wrench className="w-16 h-16 text-yellow-400 mx-auto mb-4" />,
      title: t('home.services.step3Title'),
      description: t('home.services.step3Desc')
    },
    {
      icon: <RotateCcw className="w-16 h-16 text-yellow-400 mx-auto mb-4" />,
      title: t('home.services.step4Title'),
      description: t('home.services.step4Desc')
    }
  ];

  const displaySteps = steps || defaultSteps;

  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {title || defaultTitle}
          </h2>
          <div className="w-24 h-1 bg-yellow-400 mx-auto rounded-full"></div>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {displaySteps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connecting Line */}
              {index < displaySteps.length - 1 && (
                <div className="hidden lg:block absolute top-20 left-[60%] right-[-40%] h-1 bg-yellow-400 z-0" />
              )}

              {/* Step Card */}
              <Card className="relative z-10 h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-0">
                  {/* Step Number Badge */}
                  <div className="w-12 h-12 bg-yellow-400 text-gray-900 rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div className="flex justify-center mb-4">
                    {step.icon}
                  </div>
                </CardHeader>

                <CardContent className="text-center">
                  {/* Title */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Mobile Step Indicators */}
        <div className="flex justify-center gap-2 mt-12 lg:hidden">
          {displaySteps.map((_, index) => (
            <div
              key={index}
              className="w-3 h-3 rounded-full bg-yellow-400 transition-all duration-300"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
