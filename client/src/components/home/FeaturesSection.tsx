import React from 'react';
import { CheckCircle, Clock, Shield, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function FeaturesSection() {
  const { t } = useTranslation();

  const features = [
    {
      icon: CheckCircle,
      title: t('home.features.qualityGuarantee'),
      description: t('home.features.qualityDesc')
    },
    {
      icon: Clock,
      title: t('home.features.fastTurnaround'),
      description: t('home.features.fastDesc')
    },
    {
      icon: Shield,
      title: t('home.features.certifiedTechs'),
      description: t('home.features.certifiedDesc')
    },
    {
      icon: Users,
      title: t('home.features.support247'),
      description: t('home.features.supportDesc')
    }
  ];

  return (
    <section
      className="section bg-mcrepair-blue"
      style={{
        backgroundImage: 'url(https://www.mcrepair.de/bilder/home/banner/fakten_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header">
          <h2 className="section-title text-white">
            {t('home.features.title')}
          </h2>
          <p className="section-subtitle text-gray-200">
            {t('home.features.qualityDesc')} • {t('home.features.fastDesc')} • {t('home.features.certifiedDesc')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="offers-grid">
          {features.map((feature, index) => (
            <div key={index} className="offer-card">
              <div className="offer-icon">
                <feature.icon className="w-8 h-8" />
              </div>
              <h3 className="offer-title text-white">
                {feature.title}
              </h3>
              <p className="offer-description text-gray-200">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
