import { useTranslation } from 'react-i18next';
import { Shield, Clock, ThumbsUp, Award } from 'lucide-react';

export function TrustRow() {
  const { t } = useTranslation();

  const trustItems = [
    {
      icon: <Shield width={22} height={22} />,
      title: t('home.trust.warranty', '12 Monate Garantie'),
      description: t('home.trust.warrantyDesc', 'Auf alle Reparaturen')
    },
    {
      icon: <Clock width={22} height={22} />,
      title: t('home.trust.fastService', 'Express-Service'),
      description: t('home.trust.fastServiceDesc', 'Reparatur in 60 Min.')
    },
    {
      icon: <ThumbsUp width={22} height={22} />,
      title: t('home.trust.quality', 'Top Qualität'),
      description: t('home.trust.qualityDesc', 'Original-Ersatzteile')
    },
    {
      icon: <Award width={22} height={22} />,
      title: t('home.trust.certified', 'Zertifiziert'),
      description: t('home.trust.certifiedDesc', 'Geprüfte Techniker')
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
