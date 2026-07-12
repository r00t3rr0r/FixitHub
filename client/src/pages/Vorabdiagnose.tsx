import { useTranslation } from 'react-i18next'
import { SEO } from '@/components/SEO'
import { ClipboardCheck, Phone, MapPin, Wrench } from 'lucide-react'
import { McRepairNav } from '@/components/home/McRepairNav'
import { Footer } from '@/components/Footer'
import { VorabdiagnoseWizard } from '@/components/VorabdiagnoseWizard'

export function Vorabdiagnose() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="Kostenlose Vorab-Diagnose – FixitHub"
        description="Ermitteln Sie kostenlos, welche Reparatur Ihr Gerät benötigt. Diagnose-Assistent starten und direkt Kosten abschätzen."
        canonical="/vorabdiagnose"
      />
      <McRepairNav />
      <section className="diagnose-hero">
        <div className="container">
          <div className="diagnose-hero-content">
            <div className="diagnose-hero-badge">
              <ClipboardCheck className="w-[18px] h-[18px]" />
              {t('vorabdiagnose.badge', 'Schnell & Einfach')}
            </div>
            <h1>
              {t('vorabdiagnose.title', 'Vorabdiagnose')}{' '}
              <span>{t('vorabdiagnose.heroSub', 'in 3 Schritten')}</span>
            </h1>
            <p>{t('vorabdiagnose.heroDesc', 'Beantworten Sie einige kurze Fragen und finden Sie heraus, welche Reparatur Ihr Gerät benötigt.')}</p>
          </div>
        </div>
      </section>

      {/* Wizard Section */}
      <section className="diagnose-section">
        <div className="container">
          <VorabdiagnoseWizard />

          {/* Info cards */}
          <div className="diagnose-info-row">
            <div className="diagnose-info-card">
              <div className="diagnose-info-icon">
                <Phone className="w-6 h-6" />
              </div>
              <div className="diagnose-info-text">
                <h4>{t('vorabdiagnose.hotline', 'Hotline')}</h4>
                <p>Mo–Fr 10–12, 14–16 Uhr<br /><a href="tel:+4930403688951">030 / 403 68 89 51</a></p>
              </div>
            </div>
            <div className="diagnose-info-card">
              <div className="diagnose-info-icon">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="diagnose-info-text">
                <h4>{t('vorabdiagnose.onsite', 'Vor-Ort-Diagnose')}</h4>
                <p>{t('vorabdiagnose.visitUs', 'Besuchen Sie eine unserer')}<br /><a href="/annahmestellen">108 {t('vorabdiagnose.locations', 'Annahmestellen')}</a></p>
              </div>
            </div>
            <div className="diagnose-info-card">
              <div className="diagnose-info-icon">
                <Wrench className="w-6 h-6" />
              </div>
              <div className="diagnose-info-text">
                <h4>{t('vorabdiagnose.bookRepairShort', 'Reparatur buchen')}</h4>
                <p>{t('vorabdiagnose.bookOnline', 'Direkt online buchen')}<br /><a href="/#hero">{t('vorabdiagnose.toConfigurator', 'Zum Konfigurator')}</a></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
