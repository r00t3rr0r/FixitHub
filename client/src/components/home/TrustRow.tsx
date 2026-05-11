import { useTranslation } from 'react-i18next';
import { Shield, Clock, ThumbsUp, Award } from 'lucide-react';

export function TrustRow() {
  const { t } = useTranslation();

  const trustItems = [
    {
      icon: <Shield width={22} height={22} />,
      title: t('home.trust.warranty', 'Qualitaetsgarantie:'),
      description: t('home.trust.warrantyDesc', '12 Monate auf unsere Reparaturen*'),
      note: t('home.trust.warrantyNote', '*Ausnahmen gekennzeichnet')
    },
    {
      icon: <Clock width={22} height={22} />,
      title: t('home.trust.fastService', 'Schnell & professionell:'),
      description: t('home.trust.fastServiceDesc', 'Taggleiche Bearbeitung bei Express-Buchung')
    },
    {
      icon: <ThumbsUp width={22} height={22} />,
      title: t('home.trust.quality', 'Top-Qualitaet'),
      description: t('home.trust.qualityDesc', 'Dank zertifizierter Ersatzteile')
    },
    {
      icon: <Award width={22} height={22} />,
      title: t('home.trust.certified', 'Kompetenz & Faehigkeiten'),
      description: t('home.trust.certifiedDesc', 'Unsere fachkundigen Techniker haben 20 Jahre Reparatur-Erfahrung')
    }
  ];

  return (
    <section className="trust-row">
      <div className="container">
        <div className="trust-items">
          {trustItems.map((item, index) => (
            <div key={index} className="trust-item">
              <div className="trust-icon">
                {item.icon}
              </div>
              <div className="trust-text">
                <h4>{item.title}</h4>
                <p>{item.description}</p>
                {item.note ? <p className="trust-note">{item.note}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
