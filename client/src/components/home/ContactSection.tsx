import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';

interface ContactSectionProps {
  title?: string;
  showMap?: boolean;
}

export function ContactSection({ title, showMap = true }: ContactSectionProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast: showToast } = useToast();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate submission
    setTimeout(() => {
      showToast({
        title: t('home.contact.subscribeSuccess'),
        description: `${t('home.contact.subscribeSuccessDesc')} ${email}`
      });
      setEmail('');
      setSubmitting(false);
    }, 1000);
  };

  const contactInfo = [
    {
      icon: <MapPin className="w-8 h-8 text-yellow-400" />,
      label: t('home.contact.address'),
      value: 'Berlin, Germany'
    },
    {
      icon: <Phone className="w-8 h-8 text-yellow-400" />,
      label: t('home.contact.phone'),
      value: '+49 (30) 123-4567'
    },
    {
      icon: <Mail className="w-8 h-8 text-yellow-400" />,
      label: t('home.contact.email'),
      value: 'info@mcrepair.de'
    },
    {
      icon: <Clock className="w-8 h-8 text-yellow-400" />,
      label: t('home.contact.hours'),
      value: '09:00 - 19:00 Mon-Sat'
    }
  ];

  return (
    <section id="contact" className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {title || t('home.contact.title')}
          </h2>
          <p className="text-gray-600 text-base max-w-2xl mx-auto">
            {t('home.contact.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Contact Information Cards */}
          <div className="space-y-4">
            {contactInfo.map((info, index) => (
              <Card
                key={index}
                className="shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 w-6 h-6 text-yellow-400">{info.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900">{info.label}</h3>
                      <p className="text-gray-600 text-xs break-words">{info.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Map or Quick Contact */}
          <div className="lg:col-span-2">
            {showMap ? (
              <div className="bg-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 h-80 relative">
                <iframe
                  title="Location Map"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2428.5046346221535!2d13.404953!3d52.520008!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47a851e90e62cc59%3A0x3b4e70f30a01a0fb!2sRecycling%20Lab!5e0!3m2!1sde!2sde!4v1234567890"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            ) : (
              <Card className="shadow-lg h-96 flex items-center justify-center">
                <CardContent>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {t('home.contact.sendMessage')}
                    </h3>
                    <p className="text-gray-600">
                      {t('home.contact.sendMessageDesc')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Newsletter Signup */}
        <Card className="bg-gradient-to-r from-yellow-400 to-yellow-500 border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl md:text-2xl text-gray-900 text-center">
              {t('home.contact.newsletter')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <form onSubmit={handleSubscribe} className="max-w-md mx-auto">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder={t('home.contact.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white border-0 focus-visible:ring-gray-900 text-sm h-9"
                />
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gray-900 text-white hover:bg-gray-800 font-semibold whitespace-nowrap text-sm h-9"
                >
                  {submitting ? t('common.sending') : t('home.contact.subscribe')}
                </Button>
              </div>
              <p className="text-xs text-gray-800 mt-2 text-center">
                {t('home.contact.newsletterPrivacy')}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
