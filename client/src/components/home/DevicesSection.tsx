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
      className="offers-section"
      style={{
        backgroundImage: 'url(https://www.mcrepair.de/bilder/home/banner/counter_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header">
          <h2 className="section-title text-white">
            {t('home.devices.title')}
          </h2>
          <p className="section-subtitle text-gray-200">
            Professional repair services for all your devices
          </p>
        </div>

        {/* Devices Grid */}
        <div className="offers-grid">
          {deviceTypes.map((device, index) => (
            <div key={index} className="offer-card">
              <div className="offer-icon">
                <device.icon className="w-8 h-8" />
              </div>
              <h3 className="offer-title text-white">
                {device.name}
              </h3>
              <p className="offer-description text-gray-200">
                {device.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
