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
      className="relative py-24 overflow-hidden"
      style={{
        backgroundImage: 'url(https://www.mcrepair.de/bilder/home/banner/fakten_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay with gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/60 to-black/70"></div>

      {/* Animated particles background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fadeIn">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {t('home.features.title')}
          </h2>
          <div className="w-20 h-0.5 bg-gradient-to-r from-yellow-400 to-yellow-500 mx-auto rounded-full mb-3"></div>
          <p className="text-base text-gray-200 max-w-2xl mx-auto">
            {t('home.features.qualityDesc')} • {t('home.features.fastDesc')} • {t('home.features.certifiedDesc')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group animate-fadeIn"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="relative">
                {/* Card background with glassmorphism effect */}
                <div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 group-hover:bg-white/15 transition-all duration-300"></div>

                {/* Content */}
                <div className="relative p-6 text-center">
                  {/* Icon container with animation */}
                  <div className="mb-4 flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-lg group-hover:bg-yellow-400/40 transition-all duration-300"></div>
                      <div className="relative w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
                        <feature.icon className="w-7 h-7 text-gray-900" />
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-yellow-300 transition-colors duration-300">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-200 text-xs leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Bottom accent line animation */}
                  <div className="mt-3 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </section>
  );
}
