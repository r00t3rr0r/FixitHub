import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Award, Clock, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AboutUsSectionProps {
  title?: string;
  content?: string;
}

export function AboutUsSection({ title, content }: AboutUsSectionProps) {
  const { t } = useTranslation();
  const [visibleLogos, setVisibleLogos] = useState<boolean[]>([]);

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

  const partnerLogos = [
    {
      url: 'https://www.mcrepair.de/bilder/home/carousel/partner/servicepartner.jpg',
      alt: 'Service Partner'
    },
    {
      url: 'https://www.mcrepair.de/bilder/home/carousel/partner/bmw.png',
      alt: 'BMW'
    },
    {
      url: 'https://www.mcrepair.de/bilder/home/carousel/partner/ep.png',
      alt: 'EP'
    },
    {
      url: 'https://www.mcrepair.de/bilder/home/carousel/partner/friedrichstadtpalast.png',
      alt: 'Friedrichstadtpalast'
    },
    {
      url: 'https://www.mcrepair.de/bilder/home/carousel/partner/groupon.png',
      alt: 'Groupon'
    },
    {
      url: 'https://www.mcrepair.de/bilder/home/carousel/partner/tsg.png',
      alt: 'TSG'
    }
  ];

  // Initialize logo visibility array
  useEffect(() => {
    setVisibleLogos(partnerLogos.map(() => false));
  }, []);

  // Animate logos with staggered timing
  useEffect(() => {
    const timers = partnerLogos.map((_, index) => {
      return setTimeout(() => {
        setVisibleLogos((prev) => {
          const updated = [...prev];
          updated[index] = true;
          return updated;
        });
      }, index * 200);
    });

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <section id="about" className="relative py-24 bg-white overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-400 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-400 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
          {/* Content */}
          <div className="space-y-6 animate-fadeInLeft">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 animate-slideDown">
                {title || t('home.about.title')}
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full animate-expandWidth"></div>
            </div>

            <p className="text-lg text-gray-700 leading-relaxed animate-fadeInUp">
              {content || t('home.about.content')}
            </p>

            <p className="text-lg text-gray-700 leading-relaxed animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              {t('home.about.contentPart2')}
            </p>

            {/* Key Points */}
            <ul className="space-y-3 mt-6 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
              {[
                t('home.about.keyPoint1'),
                t('home.about.keyPoint2'),
                t('home.about.keyPoint3'),
                t('home.about.keyPoint4')
              ].map((point, index) => (
                <li key={index} className="flex items-start gap-3 transform transition-all duration-300 hover:translate-x-2" style={{ animationDelay: `${0.5 + index * 0.1}s` }}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 flex items-center justify-center font-bold flex-shrink-0 mt-1 shadow-md">
                    ✓
                  </div>
                  <span className="text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-6 animate-fadeInRight">
            {stats.map((stat, index) => (
              <Card
                key={index}
                className="text-center shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-white border border-gray-100 hover:border-yellow-400/50 group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="pt-6">
                  <div className="flex justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                    {stat.icon}
                  </div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2 transition-all duration-300 group-hover:from-yellow-600 group-hover:to-yellow-400">
                    {stat.value}
                  </div>
                  <p className="text-gray-600 font-semibold group-hover:text-gray-900 transition-colors">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Customer Logos Section */}
        <div className="border-t border-gray-200 pt-20">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-12 animate-slideDown">
            {t('home.about.trustedBy') || 'Zufriedene Kunden'}
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
            {partnerLogos.map((logo, index) => (
              <div
                key={index}
                className={`flex items-center justify-center h-24 bg-gray-50 rounded-lg border border-gray-200 hover:border-yellow-400/50 hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer transform hover:scale-105 ${
                  visibleLogos[index] ? 'opacity-100 animate-fadeInScale' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <img
                  src={logo.url}
                  alt={logo.alt}
                  className="max-h-16 max-w-full px-4 object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3E{logo.alt}%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
            ))}
          </div>

          {/* Trust Statement */}
          <div className="text-center mt-16 animate-fadeInUp" style={{ animationDelay: '2s' }}>
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">
              {t('home.about.trustStatement') || 'Trusted by leading companies and thousands of satisfied customers worldwide'}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes expandWidth {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: 96px;
            opacity: 1;
          }
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fadeInLeft {
          animation: fadeInLeft 0.8s ease-out;
        }

        .animate-fadeInRight {
          animation: fadeInRight 0.8s ease-out;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-slideDown {
          animation: slideDown 0.6s ease-out;
        }

        .animate-expandWidth {
          animation: expandWidth 0.8s ease-out;
        }

        .animate-fadeInScale {
          animation: fadeInScale 0.5s ease-out forwards;
        }
      `}</style>
    </section>
  );
}
