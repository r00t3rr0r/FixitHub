import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { submitContactForm, type ContactFormPayload } from '@/api/contact';

type ContactSubject = ContactFormPayload['subject'];

interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  orderNumber: string;
  subject: ContactSubject;
  message: string;
  privacyAccepted: boolean;
}

const initialFormState: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  orderNumber: '',
  subject: 'repair',
  message: '',
  privacyAccepted: false,
};

export function Contact() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [formData, setFormData] = useState<ContactFormState>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [formStartedAt] = useState(() => new Date().toISOString());

  const contactTopics: Array<{ value: ContactSubject; label: string; icon: typeof Wrench }> = [
    { value: 'repair', label: t('home.contact.topicRepair'), icon: Wrench },
    { value: 'status', label: t('home.contact.topicStatus'), icon: Clock3 },
    { value: 'business', label: t('home.contact.topicBusiness'), icon: Building2 },
    { value: 'complaint', label: t('home.contact.topicComplaint'), icon: MessageSquare },
    { value: 'other', label: t('home.contact.topicOther'), icon: HelpCircle },
  ];

  const infoCards = [
    {
      icon: Phone,
      label: t('home.contact.phone'),
      value: t('home.contact.phoneValue'),
      href: 'tel:+4930403688951',
    },
    {
      icon: Mail,
      label: t('home.contact.email'),
      value: t('home.contact.emailValue'),
      href: 'mailto:kontakt@mcrepair.de',
    },
    {
      icon: MapPin,
      label: t('home.contact.address'),
      value: `${t('home.contact.addressValueLine1')}, ${t('home.contact.addressValueLine2')}`,
      href: 'https://maps.google.com/?q=Kurfürstenstraße+106,+10787+Berlin',
    },
    {
      icon: Clock3,
      label: t('home.contact.hours'),
      value: t('home.contact.hoursValue'),
      href: undefined,
    },
  ];

  const highlightCards = [
    {
      icon: CheckCircle2,
      title: t('home.contact.responseTime'),
      description: t('home.contact.responseTimeDesc'),
    },
    {
      icon: ShieldCheck,
      title: t('home.contact.secureHandling'),
      description: t('home.contact.secureHandlingDesc'),
    },
  ];

  const updateField = <T extends keyof ContactFormState>(field: T, value: ContactFormState[T]) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof ContactFormState, string>> = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      nextErrors.name = t('home.contact.validationName');
    }

    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      nextErrors.email = t('home.contact.validationEmail');
    }

    if (!formData.message.trim() || formData.message.trim().length < 20) {
      nextErrors.message = t('home.contact.validationMessage');
    }

    if (!formData.privacyAccepted) {
      nextErrors.privacyAccepted = t('home.contact.validationPrivacy');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      await submitContactForm({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        orderNumber: formData.orderNumber.trim(),
        subject: formData.subject,
        message: formData.message.trim(),
        privacyAccepted: formData.privacyAccepted,
        website: honeypot,
        formStartedAt,
      });

      setHasSubmitted(true);
      setFormData(initialFormState);
      toast({
        title: t('home.contact.successTitle'),
        description: t('home.contact.successDescription'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error', 'Fehler'),
        description: error.message || t('home.contact.submitError', 'Die Anfrage konnte nicht gesendet werden.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, rgba(245,197,24,0.08) 0%, var(--off-white, #f8f9fc) 20%, #ffffff 58%, rgba(26,42,94,0.06) 100%)',
      }}
    >
      <TopBar />
      <McRepairNav />

      <section className="container px-4 py-10 md:py-14">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-0 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div
                className="p-8 md:p-10"
                style={{
                  background: 'linear-gradient(135deg, var(--primary-blue, #1a2a5e) 0%, var(--primary-blue-light, #2f57b0) 100%)',
                  color: 'white',
                }}
              >
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                  <MessageSquare className="h-4 w-4" />
                  {t('home.contact.title')}
                </div>
                <h1 className="max-w-2xl text-3xl font-bold leading-tight md:text-5xl">
                  {t('home.contact.subtitle')}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-50 md:text-base">
                  {t('home.contact.pageDescription')}
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="tel:+4930403688951"
                    className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition"
                    style={{
                      background: 'var(--accent-yellow, #f5c518)',
                      color: 'var(--primary-blue, #1a2a5e)',
                    }}
                  >
                    <Phone className="h-4 w-4" />
                    {t('home.contact.phoneValue')}
                  </a>
                  <a
                    href="mailto:kontakt@mcrepair.de"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <Mail className="h-4 w-4" />
                    {t('home.contact.emailValue')}
                  </a>
                </div>
              </div>

              <div className="grid gap-4 p-6 md:grid-cols-2 md:p-8">
                {highlightCards.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border p-5"
                    style={{
                      borderColor: 'rgba(26, 42, 94, 0.08)',
                      background: 'rgba(248, 250, 252, 0.85)',
                    }}
                  >
                    <item.icon className="mb-3 h-6 w-6" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                      {item.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                  {t('home.contact.faqHintTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                <p>{t('home.contact.faqHintDesc')}</p>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Link to="/faq" className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white" style={{ background: 'var(--primary-blue, #1a2a5e)' }}>
                    <HelpCircle className="h-4 w-4" />
                    {t('home.contact.faqButton')}
                  </Link>
                  <Link to="/new-order" className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold" style={{ borderColor: 'rgba(26,42,94,0.15)', color: 'var(--primary-blue, #1a2a5e)' }}>
                    <ArrowRight className="h-4 w-4" />
                    {t('home.contact.repairButton')}
                  </Link>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {infoCards.map((item) => (
                <Card key={item.label} className="border-0 shadow-md">
                  <CardContent className="flex items-start gap-4 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(245, 197, 24, 0.18)', color: 'var(--primary-blue, #1a2a5e)' }}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{item.label}</p>
                      {item.href ? (
                        <a href={item.href} target={item.href.startsWith('https') ? '_blank' : undefined} rel={item.href.startsWith('https') ? 'noopener noreferrer' : undefined} className="mt-1 block text-sm leading-6 hover:underline" style={{ color: 'var(--gray-600, #475569)' }}>
                          {item.value}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>{item.value}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                {t('home.contact.formTitle')}
              </CardTitle>
              <p className="text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                {t('home.contact.formDescription')}
              </p>
            </CardHeader>
            <CardContent>
              {hasSubmitted && (
                <div className="mb-6 rounded-2xl border px-4 py-4 text-sm" style={{ borderColor: 'rgba(16,185,129,0.24)', background: 'rgba(236,253,245,0.9)', color: '#065f46' }}>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">{t('home.contact.successTitle')}</p>
                      <p className="mt-1 leading-6">{t('home.contact.successDescription')}</p>
                    </div>
                  </div>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="hidden" aria-hidden="true">
                  <Label htmlFor="contact-website">Website</Label>
                  <Input
                    id="contact-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(event) => setHoneypot(event.target.value)}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">{t('home.contact.nameLabel')}</Label>
                    <Input
                      id="contact-name"
                      value={formData.name}
                      onChange={(event) => updateField('name', event.target.value)}
                      placeholder={t('home.contact.namePlaceholder')}
                      autoComplete="name"
                    />
                    {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-email">{t('home.contact.email')}</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={formData.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      placeholder={t('home.contact.emailPlaceholder')}
                      autoComplete="email"
                    />
                    {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">{t('home.contact.phoneLabel')}</Label>
                    <Input
                      id="contact-phone"
                      value={formData.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      placeholder={t('home.contact.phonePlaceholder')}
                      autoComplete="tel"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-order-number">{t('home.contact.orderNumberLabel')}</Label>
                    <Input
                      id="contact-order-number"
                      value={formData.orderNumber}
                      onChange={(event) => updateField('orderNumber', event.target.value)}
                      placeholder={t('home.contact.orderNumberPlaceholder')}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>{t('home.contact.topicLabel')}</Label>
                  <div className="flex flex-wrap gap-3">
                    {contactTopics.map((topic) => (
                      <button
                        key={topic.value}
                        type="button"
                        onClick={() => updateField('subject', topic.value)}
                        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition"
                        style={{
                          borderColor: formData.subject === topic.value ? 'transparent' : 'rgba(26,42,94,0.14)',
                          background: formData.subject === topic.value
                            ? 'linear-gradient(135deg, var(--primary-blue, #1a2a5e) 0%, var(--primary-blue-light, #2f57b0) 100%)'
                            : 'white',
                          color: formData.subject === topic.value ? 'white' : 'var(--primary-blue, #1a2a5e)',
                          boxShadow: formData.subject === topic.value ? '0 12px 30px rgba(26, 42, 94, 0.18)' : 'none',
                        }}
                      >
                        <topic.icon className="h-4 w-4" />
                        {topic.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-message">{t('home.contact.messageLabel')}</Label>
                  <Textarea
                    id="contact-message"
                    value={formData.message}
                    onChange={(event) => updateField('message', event.target.value)}
                    placeholder={t('home.contact.messagePlaceholder')}
                    className="min-h-[180px]"
                  />
                  {errors.message && <p className="text-sm text-red-600">{errors.message}</p>}
                </div>

                <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(26,42,94,0.1)', background: 'rgba(248,250,252,0.9)' }}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="contact-privacy"
                      checked={formData.privacyAccepted}
                      onCheckedChange={(checked) => updateField('privacyAccepted', checked === true)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="contact-privacy" className="leading-6">
                        {t('home.contact.privacyConsent')}
                      </Label>
                      {errors.privacyAccepted && <p className="text-sm text-red-600">{errors.privacyAccepted}</p>}
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full text-base font-semibold"
                  style={{ background: 'var(--primary-blue, #1a2a5e)', color: 'white' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('home.contact.sending')}
                    </>
                  ) : (
                    <>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      {t('home.contact.submit')}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                  {t('home.contact.sendMessage')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                <p>{t('home.contact.sendMessageDesc')}</p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--accent-yellow, #f5c518)' }} />
                    <span>{t('home.contact.responseTimeDesc')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--accent-yellow, #f5c518)' }} />
                    <span>{t('home.contact.secureHandlingDesc')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--accent-yellow, #f5c518)' }} />
                    <span>{t('home.contact.hoursValue')}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 text-white" style={{ background: 'linear-gradient(135deg, var(--primary-blue, #1a2a5e) 0%, #28448f 100%)' }}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">McRepair.de</p>
                  <h2 className="mt-2 text-2xl font-semibold">{t('home.contact.address')}</h2>
                  <p className="mt-3 text-sm leading-7 text-blue-50">
                    {t('home.contact.addressValueLine1')}<br />
                    {t('home.contact.addressValueLine2')}
                  </p>
                </div>
                <div className="space-y-3 p-6 text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                  <a href="https://maps.google.com/?q=Kurfürstenstraße+106,+10787+Berlin" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold hover:underline" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                    <MapPin className="h-4 w-4" />
                    Route anzeigen
                  </a>
                  <p>{t('home.contact.hoursValue')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}