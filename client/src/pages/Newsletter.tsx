import { useState } from 'react';
import { SEO } from '@/components/SEO'
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { Footer } from '@/components/Footer';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
export default function Newsletter() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [unsubscribeEmail, setUnsubscribeEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unsubmitting, setUnsubmitting] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscribeEmail.trim()) {
      toast({ title: t('newsletter.emailRequired', 'E-Mail erforderlich'), description: t('newsletter.emailRequiredDesc', 'Bitte geben Sie Ihre E-Mail-Adresse ein.'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      toast({ title: t('newsletter.success', 'Erfolg'), description: t('newsletter.subscribeSuccess', 'Sie haben den Newsletter erfolgreich abonniert.') });
      setSubscribeEmail('');
      setSubmitting(false);
    }, 1200);
  };

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unsubscribeEmail.trim()) {
      toast({ title: t('newsletter.emailRequired', 'E-Mail erforderlich'), description: t('newsletter.emailRequiredDesc', 'Bitte geben Sie Ihre E-Mail-Adresse ein.'), variant: 'destructive' });
      return;
    }
    setUnsubmitting(true);
    setTimeout(() => {
      toast({ title: t('newsletter.unsubscribeSuccess', 'Abmeldung erfolgreich'), description: t('newsletter.unsubscribeSuccessDesc', 'Sie wurden vom Newsletter abgemeldet.') });
      setUnsubscribeEmail('');
      setUnsubmitting(false);
    }, 1200);
  };

  return (
    <div style={{ background: 'linear-gradient(180deg, var(--off-white, #f8f9fc) 0%, var(--white, #ffffff) 24%, var(--gray-50, #f5f6f8) 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SEO
        title="Newsletter abonnieren – FixitHub Updates"
        description="Jetzt FixitHub-Newsletter abonnieren und keine Angebote, Reparaturtipps und News mehr verpassen. Kostenlos & jederzeit kündbar."
        canonical="/newsletter"
      />
      <TopBar />
      <McRepairNav />
      <main className="flex-1 flex flex-col items-center justify-center py-10 px-4">
        <div className="w-full max-w-lg space-y-10">
          <Card className="shadow-xl border-0">
            <CardHeader className="pb-2 text-center" style={{ background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
              <CardTitle className="text-white text-2xl">{t('newsletter.subscribeTitle', 'Newsletter abonnieren')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-2">
              <form className="space-y-4" onSubmit={handleSubscribe}>
                <p className="text-gray-700 text-center text-base">{t('newsletter.subscribeDesc', 'Um sich für unseren Newsletter anzumelden, tragen Sie bitte hier Ihre E-Mail-Adresse ein und klicken anschließend auf')} <b>{t('newsletter.subscribeBtn', 'abonnieren')}</b>.<br /><span className="text-xs text-gray-500">({t('newsletter.unsubscribeAnytime', 'Abmeldung jederzeit möglich')})</span></p>
                <div className="space-y-2">
                  <Label htmlFor="newsletter-email">{t('newsletter.email', 'E-Mail')}</Label>
                  <Input
                    id="newsletter-email"
                    type="email"
                    value={subscribeEmail}
                    onChange={e => setSubscribeEmail(e.target.value)}
                    placeholder={t('newsletter.emailPlaceholder', 'name@beispiel.de')}
                    autoComplete="email"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  style={{ background: 'var(--primary-blue)', color: 'white' }}
                  disabled={submitting}
                >
                  {submitting ? t('newsletter.subscribing', 'Abonniere...') : t('newsletter.subscribeBtn', 'Abonnieren')}
                </Button>
                <div className="text-xs text-gray-500 text-center pt-2">{t('newsletter.unsubscribeAnytime', 'Abmeldung jederzeit möglich')}</div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0">
            <CardHeader className="pb-2 text-center" style={{ background: 'linear-gradient(135deg, #f5c518, #ffe066)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
              <CardTitle className="text-[#1a2a5e] text-2xl">{t('newsletter.unsubscribeTitle', 'Newsletter abmelden')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-2">
              <form className="space-y-4" onSubmit={handleUnsubscribe}>
                <p className="text-gray-700 text-center text-base">{t('newsletter.unsubscribeDesc', 'Zum Abmelden des Newsletters tragen Sie bitte Ihre E-Mail-Adresse im unten stehenden Feld ein. Klicken Sie anschließend auf')} <b>{t('newsletter.unsubscribeBtn', 'abmelden')}</b>.</p>
                <div className="space-y-2">
                  <Label htmlFor="newsletter-unsubscribe-email">{t('newsletter.email', 'E-Mail')}</Label>
                  <Input
                    id="newsletter-unsubscribe-email"
                    type="email"
                    value={unsubscribeEmail}
                    onChange={e => setUnsubscribeEmail(e.target.value)}
                    placeholder={t('newsletter.emailPlaceholder', 'name@beispiel.de')}
                    autoComplete="email"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  style={{ background: '#f5c518', color: '#1a2a5e' }}
                  disabled={unsubmitting}
                >
                  {unsubmitting ? t('newsletter.unsubscribing', 'Melde ab...') : t('newsletter.unsubscribeBtn', 'Abmelden')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
