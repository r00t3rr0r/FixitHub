import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { useTranslation } from 'react-i18next';
import './Widerrufsrecht.css';

export function Widerrufsrecht() {
  const { t } = useTranslation();

  const instructionParagraphs = [
    t('withdrawalPage.instruction.paragraphs.p1'),
    t('withdrawalPage.instruction.paragraphs.p2'),
    t('withdrawalPage.instruction.paragraphs.p3'),
    t('withdrawalPage.instruction.paragraphs.p4'),
    t('withdrawalPage.instruction.paragraphs.p5')
  ];

  const consequencesParagraphs = [
    t('withdrawalPage.consequences.paragraphs.p1'),
    t('withdrawalPage.consequences.paragraphs.p2')
  ];

  const exclusionsParagraphs = [
    t('withdrawalPage.exclusions.paragraphs.p1'),
    t('withdrawalPage.exclusions.paragraphs.p2')
  ];

  const formFields = [
    t('withdrawalPage.form.fields.orderedOnReceivedOn'),
    t('withdrawalPage.form.fields.consumerName'),
    t('withdrawalPage.form.fields.consumerAddress'),
    t('withdrawalPage.form.fields.consumerSignature'),
    t('withdrawalPage.form.fields.date')
  ];

  return (
    <>
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="widerrufsrecht-page">
        <div className="container">
          <div className="widerrufsrecht-content">
            {/* Header */}
            <header className="widerrufsrecht-header">
              <h1>{t('withdrawalPage.title')}</h1>
            </header>

            {/* Consumer Definition */}
            <section className="widerrufsrecht-section">
              <h2>{t('withdrawalPage.consumer.title')}</h2>
              <p className="consumer-definition">
                {t('withdrawalPage.consumer.definition')}
              </p>
            </section>

            {/* Widerrufsbelehrung */}
            <section className="widerrufsrecht-section">
              <h2>{t('withdrawalPage.instruction.title')}</h2>
              
              <h3>{t('withdrawalPage.instruction.rightTitle')}</h3>
              {instructionParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>

            {/* Folgen des Widerrufs */}
            <section className="widerrufsrecht-section">
              <h3>{t('withdrawalPage.consequences.title')}</h3>
              {consequencesParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>

            {/* Ausschluss- bzw. Erlöschensgründe */}
            <section className="widerrufsrecht-section">
              <h3>{t('withdrawalPage.exclusions.title')}</h3>
              {exclusionsParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>

            {/* Muster-Widerrufsformular */}
            <section className="widerrufsrecht-section widerrufsrecht-form">
              <h2>{t('withdrawalPage.form.title')}</h2>
              
              <p className="form-intro">
                {t('withdrawalPage.form.intro')}
              </p>
              
              <div className="form-content">
                <p><strong>{t('withdrawalPage.form.addressLine')}</strong></p>
                
                <p>
                  <strong>{t('withdrawalPage.form.declarationLine')}</strong>
                </p>
                
                <div className="form-fields">
                  {formFields.map((field) => (
                    <p key={field}>{field}</p>
                  ))}
                </div>
                
                <p className="form-footer">{t('withdrawalPage.form.footer')}</p>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Footer with McRepair Design */}
      <Footer />
    </>
  );
}
