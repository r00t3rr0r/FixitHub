import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Award, Clock, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AboutUsSectionProps {
  title?: string;
  content?: string;
}

export function AboutUsSection({ title, content }: AboutUsSectionProps) {
  const { t } = useTranslation();

  const stats = [
    {
      icon: <Users className="w-12 h-12 text-yellow-400" />,
      value: '350+',
      label: t('home.about.partnerLocations')
    },
    {
      icon: <Award className="w-12 h-12 text-yellow-400" />,
      value: '10K+',
      label: t('home.about.devicesRepaired')
    },
    {
      icon: <Clock className="w-12 h-12 text-yellow-400" />,
      value: '24h',
      label: t('home.about.avgTurnaround')
    },
    {
      icon: <Zap className="w-12 h-12 text-yellow-400" />,
      value: '99%',
      label: t('home.about.satisfaction')
    }
  ];

  return (
    <section id="about" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-6">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                {title || t('home.about.title')}
              </h2>
              <div className="w-16 h-1 bg-yellow-400 rounded-full"></div>
            </div>

            <p className="text-lg text-gray-700 leading-relaxed">
              {content || t('home.about.content')}
            </p>

            <p className="text-lg text-gray-700 leading-relaxed">
              {t('home.about.contentPart2')}
            </p>

            {/* Key Points */}
            <ul className="space-y-3 mt-6">
              {[
                t('home.about.keyPoint1'),
                t('home.about.keyPoint2'),
                t('home.about.keyPoint3'),
                t('home.about.keyPoint4')
              ].map((point, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-yellow-400 text-gray-900 flex items-center justify-center font-bold flex-shrink-0 mt-1">
                    ✓
                  </div>
                  <span className="text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-6">
            {stats.map((stat, index) => (
              <Card
                key={index}
                className="text-center shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
              >
                <CardContent className="pt-6">
                  <div className="flex justify-center mb-4">{stat.icon}</div>
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {stat.value}
                  </div>
                  <p className="text-gray-600 font-semibold">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
