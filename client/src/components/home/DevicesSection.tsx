import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Smartphone, Tablet, Laptop, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function DevicesSection() {
  const { t } = useTranslation();

  const deviceTypes = [
    {
      icon: Smartphone,
      name: t('home.devices.smartphones'),
      description: t('home.devices.smartphonesDesc')
    },
    {
      icon: Tablet,
      name: t('home.devices.tablets'),
      description: t('home.devices.tabletsDesc')
    },
    {
      icon: Laptop,
      name: t('home.devices.laptops'),
      description: t('home.devices.laptopsDesc')
    },
    {
      icon: Monitor,
      name: t('home.devices.desktops'),
      description: t('home.devices.desktopsDesc')
    }
  ];

  return (
    <section
      className="relative py-24 overflow-hidden"
      style={{
        backgroundImage: 'url(https://www.mcrepair.de/bilder/home/banner/counter_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay with gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60"></div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16 animate-slideIn">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t('home.devices.title')}
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-yellow-500 mx-auto rounded-full mb-4"></div>
          <p className="text-xl text-gray-200 max-w-2xl mx-auto">
            Professional repair services for all your devices
          </p>
        </div>

        {/* Devices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {deviceTypes.map((device, index) => (
            <div
              key={index}
              className="animate-scaleIn group"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="relative h-full perspective">
                {/* Gradient border effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/30 to-yellow-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                {/* Main card with glassmorphism */}
                <Card className="relative h-full bg-white/10 backdrop-blur-xl border border-white/20 hover:border-yellow-400/50 transition-all duration-300 overflow-hidden">
                  {/* Animated background shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                    animation: 'shimmer 3s infinite'
                  }}></div>

                  <CardHeader className="relative z-10 text-center pb-2">
                    {/* Icon container */}
                    <div className="mb-6 flex justify-center">
                      <div className="relative">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-yellow-400 rounded-full blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>

                        {/* Icon with rotation animation on hover */}
                        <div className="relative w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                          <device.icon className="w-8 h-8 text-gray-900" />
                        </div>
                      </div>
                    </div>

                    <CardTitle className="text-white text-xl mb-2 group-hover:text-yellow-300 transition-colors duration-300">
                      {device.name}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="relative z-10 text-center">
                    <CardDescription className="text-gray-200">
                      {device.description}
                    </CardDescription>

                    {/* Animated bottom border */}
                    <div className="mt-4 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>

        {/* Additional info banner */}
        <div className="mt-16 p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-center animate-fadeInUp" style={{ animationDelay: '0.6s' }}>
          <p className="text-lg text-gray-100">
            <span className="text-yellow-400 font-bold">Expert technicians</span> ready to repair any device
            <span className="text-yellow-400 font-bold ml-2">•</span>
            <span className="text-yellow-400 font-bold ml-2">Same-day service available</span>
            <span className="text-yellow-400 font-bold ml-2">•</span>
            <span className="text-yellow-400 font-bold ml-2">1-year warranty</span>
          </p>
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

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-30px);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-slideIn {
          animation: slideIn 0.6s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out forwards;
          opacity: 0;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .perspective {
          perspective: 1000px;
        }
      `}</style>
    </section>
  );
}
