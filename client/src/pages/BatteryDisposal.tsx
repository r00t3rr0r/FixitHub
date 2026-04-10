import { useTranslation } from 'react-i18next';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './BatteryDisposal.css';

export function BatteryDisposal() {
  const { t } = useTranslation();

  return (
    <>
      <TopBar />
      <McRepairNav />

      <div className="battery-page">
        <div className="container">
          <div className="battery-content">
            <header className="battery-header">
              <h1>{t('batteryDisposal.title', 'Hinweise zur Batterieentsorgung')}</h1>
            </header>

            <section className="battery-section">
              <div className="battery-info-box">
                <p>
                  {t(
                    'batteryDisposal.intro',
                    'In connection with the sale of batteries or devices containing batteries, we are obliged to inform you of the following:'
                  )}
                </p>
                <p>
                  {t(
                    'batteryDisposal.returnInfo',
                    'As an end user, you are legally required to return used batteries. You can return used batteries that we carry or have carried as new batteries in our product range free of charge to our shipping warehouse (shipping address).'
                  )}
                </p>
              </div>
            </section>

            <section className="battery-section">
              <h2>{t('batteryDisposal.symbolsTitle', 'Batteriesymbole und Bedeutung')}</h2>
              <p>
                {t(
                  'batteryDisposal.symbolsIntro',
                  'Die auf den Batterien abgebildeten Symbole haben folgende Bedeutung:'
                )}
              </p>
              <ul className="battery-symbol-list">
                <li>
                  {t(
                    'batteryDisposal.symbolBin',
                    'The crossed-out wheeled bin symbol means that the battery must not be disposed of in household waste.'
                  )}
                </li>
                <li>{t('batteryDisposal.symbolPb', 'Pb = Battery contains more than 0.004 percent lead by mass')}</li>
                <li>{t('batteryDisposal.symbolCd', 'Cd = Battery contains more than 0.002 percent cadmium by mass')}</li>
                <li>{t('batteryDisposal.symbolHg', 'Hg = Battery contains more than 0.0005 percent mercury by mass.')}</li>
              </ul>
            </section>

            <section className="battery-section last-section">
              <p className="battery-final-note">
                {t('batteryDisposal.finalNote', 'Bitte beachten Sie die vorstehenden Hinweise.')}
              </p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
