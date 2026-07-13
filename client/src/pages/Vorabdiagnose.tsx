import { useTranslation } from 'react-i18next'
import { SEO } from '@/components/SEO'
import {
  ClipboardCheck, Phone, MapPin, Wrench, Zap, RotateCcw, Thermometer,
  Camera, Wifi, Smartphone, Monitor, Battery, HelpCircle, Search,
  MessageSquare, CheckCircle, Shield, Clock, Star, ChevronRight,
} from 'lucide-react'
import { McRepairNav } from '@/components/home/McRepairNav'
import { Footer } from '@/components/Footer'
import { VorabdiagnoseWizard } from '@/components/VorabdiagnoseWizard'

/* ─────────────────────────────────────────────
   JSON-LD structured data (rendered in <head>)
───────────────────────────────────────────── */
const vorabdiagnoseJsonLd = [
  /* 1 — WebPage --------------------------------------------------- */
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': 'https://www.mcrepair.de/vorabdiagnose',
    url: 'https://www.mcrepair.de/vorabdiagnose',
    name: 'Kostenlose Vorab-Diagnose – Smartphone & Handy Problem erkennen | McRepair.de',
    description:
      'Starten Sie die kostenlose Online-Diagnose für Ihr Smartphone, iPhone, Samsung oder Tablet. In 3 Schritten zum Reparaturergebnis – Displayschaden, Akku, Kamera und mehr.',
    inLanguage: 'de-DE',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.mcrepair.de/' },
        { '@type': 'ListItem', position: 2, name: 'Vorabdiagnose', item: 'https://www.mcrepair.de/vorabdiagnose' },
      ],
    },
    publisher: {
      '@type': 'Organization',
      '@id': 'https://www.mcrepair.de/#business',
      name: 'McRepair.de',
    },
  },
  /* 2 — Service --------------------------------------------------- */
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Kostenlose Vorab-Diagnose für Smartphones & mobile Geräte',
    serviceType: 'Gerätediagnose',
    provider: {
      '@type': 'LocalBusiness',
      '@id': 'https://www.mcrepair.de/#business',
      name: 'McRepair.de',
    },
    description:
      'Kostenloser Online-Diagnose-Assistent für Smartphones, Tablets und Notebooks. Ermittelt die wahrscheinliche Schadensursache in 3 Schritten und empfiehlt die passende Reparatur.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Kostenlose Online-Vorabdiagnose – keine Registrierung erforderlich',
    },
    areaServed: { '@type': 'Country', name: 'Deutschland' },
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: 'https://www.mcrepair.de/vorabdiagnose',
      serviceType: 'Online-Assistent',
    },
  },
  /* 3 — HowTo ----------------------------------------------------- */
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Vorab-Diagnose Ihres Smartphones in 3 Schritten',
    description:
      'Ermitteln Sie kostenlos, welche Reparatur Ihr Smartphone, iPhone, Samsung Galaxy oder Tablet benötigt.',
    totalTime: 'PT3M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Problem auswählen',
        text: 'Wählen Sie aus 10 Problemkategorien diejenige, die Ihr aktuelles Geräteproblem am besten beschreibt – z. B. Displayschaden, Akku-Problem oder Kamerafehler.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Folgefragen beantworten',
        text: 'Beantworten Sie 2 bis 3 gezielte Folgefragen, um den Schaden weiter einzugrenzen und eine präzise Diagnose zu ermöglichen.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Diagnose & Empfehlung erhalten',
        text: 'Sie erhalten eine konkrete Einschätzung des Schadens sowie eine Reparaturempfehlung – inklusive Hinweis, ob ein Austausch oder eine Reinigung sinnvoll ist.',
      },
    ],
  },
  /* 4 — FAQPage --------------------------------------------------- */
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Was soll ich tun, wenn mein Smartphone gar nicht mehr angeht?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Wenn das Gerät länger nicht in Gebrauch war, ist vermutlich der Akku tiefentladen. Lassen Sie das Gerät mindestens eine Stunde am Strom. Falls es danach nicht startet, kann ein Defekt an der Ladeelektronik vorliegen – dafür ist eine Diagnose vor Ort nötig.',
        },
      },
      {
        '@type': 'Question',
        name: 'Mein Handy bleibt beim Hochfahren am Herstellerlogo hängen – was ist die Ursache?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Es kann sich um ein Softwareproblem oder einen defekten Speicherchip handeln, in seltenen Fällen auch um einen defekten Akku. Eine genauere Diagnose ist erforderlich. Bitte beachten Sie: Falls eine Softwarebehandlung notwendig ist, gehen sämtliche Daten verloren.',
        },
      },
      {
        '@type': 'Question',
        name: 'Warum wird mein Smartphone so ungewöhnlich heiß?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Bei starker Hitzeentwicklung liegt häufig ein defekter Akku vor. Es kann sich jedoch auch um ein allgemeines Hardwareproblem handeln. Eine Diagnose in der Werkstatt ist empfehlenswert.',
        },
      },
      {
        '@type': 'Question',
        name: 'Was tun, wenn mein Gesprächspartner mich beim Telefonieren kaum hört?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Häufig ist nur das Mikrofon verschmutzt. Versuchen Sie es vorsichtig mit einer weichen Zahnbürste zu reinigen. Wenn das nicht hilft, ist ein Austausch des Mikrofons empfehlenswert.',
        },
      },
      {
        '@type': 'Question',
        name: 'Meine Handykamera macht fleckige oder unscharfe Fotos – was ist defekt?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Entweder ist die Linse verschmutzt oder das Kameramodul defekt. Reinigen Sie zunächst die Linse. Hilft das nicht, muss das Kameramodul geprüft und ggf. ausgetauscht werden.',
        },
      },
      {
        '@type': 'Question',
        name: 'Mein Smartphone hat keinen WLAN-Empfang mehr – woran kann das liegen?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Wahrscheinlich ist der WLAN-Chip defekt. Hier ist eine genauere Diagnose in der Werkstatt ratsam.',
        },
      },
      {
        '@type': 'Question',
        name: 'Mein Akku entlädt sich sehr schnell – muss ich ihn tauschen?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Wahrscheinlich ist der Akku verschlissen. Reduzieren Sie zunächst die Hintergrundaktivitäten von Apps. Falls sich das Problem nicht bessert, empfehlen wir einen Akkutausch oder eine Diagnose.',
        },
      },
      {
        '@type': 'Question',
        name: 'Das Displayglas meines Smartphones ist gebrochen – muss ich das ganze Display tauschen?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Vermutlich muss das Displayglas oder die gesamte Displayeinheit ausgetauscht werden – das ist modellabhängig. Bei Geräten mit Panzerglas sollten Sie zunächst prüfen, ob das Originalglas darunter noch intakt ist.',
        },
      },
      {
        '@type': 'Question',
        name: 'Auf meinem Display sind Streifen, Flecken oder Punkte zu sehen – was ist kaputt?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Wahrscheinlich ist das Displaypanel defekt. In sehr seltenen Fällen hat sich nur der LCD-Flex gelockert. In der Regel ist ein Displayaustausch erforderlich.',
        },
      },
      {
        '@type': 'Question',
        name: 'Meine SIM-Karte wird vom Smartphone nicht mehr erkannt – was ist die Ursache?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Vermutlich ist der SIM-Kartenleser defekt und muss ausgetauscht werden. Probieren Sie zunächst eine andere SIM-Karte aus, um auszuschließen, dass die SIM selbst defekt ist.',
        },
      },
    ],
  },
]

/* ─────────────────────────────────────────────
   Static data for SEO content sections
───────────────────────────────────────────── */
const problemCategories = [
  {
    icon: Zap,
    title: 'Gerät geht nicht an',
    desc: 'Tiefentladener Akku, defekte Ladeelektronik oder schwarz gebliebenes Display trotz Ladereaktion.',
  },
  {
    icon: RotateCcw,
    title: 'Startet nicht richtig',
    desc: 'Gerät bleibt beim Herstellerlogo hängen, startet in eine Ladeschleife oder reagiert nicht vollständig.',
  },
  {
    icon: Thermometer,
    title: 'Betriebsprobleme',
    desc: 'Überhitzung, schlechte Touchreaktion, grundlose Neustarts oder plötzliches Abschalten.',
  },
  {
    icon: Phone,
    title: 'Telefonie & Audio',
    desc: 'Gesprächspartner hört Sie nicht, Hörmuschel ist stumm oder Lautsprecher ausgefallen.',
  },
  {
    icon: Camera,
    title: 'Kameraprobleme',
    desc: 'Flecken und Streifen auf Fotos, ratternder Autofokus oder unscharfe Frontkamera.',
  },
  {
    icon: Wifi,
    title: 'Mobilfunk & WLAN',
    desc: 'Kein Netz, SIM-Karte wird nicht erkannt oder WLAN-Empfang plötzlich ausgefallen.',
  },
  {
    icon: Smartphone,
    title: 'Displayglas gebrochen',
    desc: 'Gerissenes oder gesplittertes Deckglas – mit oder ohne Panzerglas-Schutzfolie.',
  },
  {
    icon: Monitor,
    title: 'Displayanzeige defekt',
    desc: 'Sichtbare Streifen, Farbflecken, Pixel-Ausfälle oder flackerndes Display.',
  },
  {
    icon: Battery,
    title: 'Akku & Laden',
    desc: 'Schnell entladender Akku, Gerät lädt gar nicht oder nur sehr langsam.',
  },
  {
    icon: HelpCircle,
    title: 'Sonstige Probleme',
    desc: 'Mehrere gleichzeitige Probleme oder ein Schaden, der in keine der anderen Kategorien passt.',
  },
]

const commonDiagnoses = [
  {
    q: 'Gerät ohne Reaktion beim Laden',
    a: 'Wenn das Gerät länger nicht genutzt wurde, ist der Akku möglicherweise tiefentladen. Mindestens 60 Minuten laden. Keine Reaktion danach → Defekt an der Ladeelektronik, Diagnose vor Ort erforderlich.',
  },
  {
    q: 'Display schwarz, Geräusche beim Laden hörbar',
    a: 'Höchstwahrscheinlich ist das LCD oder die Hintergrundbeleuchtung defekt. Ein Austausch der Displayeinheit ist notwendig.',
  },
  {
    q: 'Gerät startet grundlos neu oder schaltet sich ab',
    a: 'Bei plötzlichen Neustarts kann ein Akku-Defekt vorliegen, aber auch ein Fehler der Hauptplatine. Eine professionelle Diagnose ist ratsam.',
  },
  {
    q: 'Touchscreen reagiert schlecht oder gar nicht',
    a: 'Wahrscheinlich ist das Touchpanel beschädigt. Ein Displayaustausch behebt meist das Problem. In seltenen Fällen hat sich der Touchflex gelockert.',
  },
  {
    q: 'Kein Mobilfunknetz trotz eingelegter SIM',
    a: 'Probieren Sie zunächst eine andere SIM aus. Hilft das nicht, kann ein Problem am Antennenmodul, am SIM-Leser oder am Baseband-Chip vorliegen.',
  },
  {
    q: 'Akku entlädt sich schneller als gewöhnlich',
    a: 'Wahrscheinlich ist der Akku verschlissen. Prüfen Sie zunächst die Hintergrundaktivitäten von Apps. Falls kein Verbesserung eintritt → Akkutausch empfohlen.',
  },
  {
    q: 'Displayanzeige: Flackern, Streifen oder Punkte',
    a: 'Wahrscheinlich ist das Displaypanel defekt. In sehr seltenen Fällen hat sich der LCD-Flex gelockert. In der Regel ist ein Displaytausch erforderlich.',
  },
  {
    q: 'Ladebuchse defekt oder nur kabellos ladbar',
    a: 'Die Ladebuchse ist verschmutzt oder defekt. Zunächst vorsichtig reinigen. Falls kein Erfolg → Austausch der Ladebuchse notwendig.',
  },
]

const benefits = [
  {
    icon: CheckCircle,
    title: '100 % kostenlos',
    desc: 'Die Vorabdiagnose ist völlig gratis – keine Registrierung, keine versteckten Kosten.',
  },
  {
    icon: Clock,
    title: 'In 3 Minuten fertig',
    desc: 'Nur 2–3 Fragen pro Kategorie. Schnelle, präzise Einschätzung ohne langes Suchen.',
  },
  {
    icon: Shield,
    title: '12 Monate Garantie',
    desc: 'Alle anschließenden Reparaturen sind mit 12 Monaten Garantie auf Teile & Arbeit abgesichert.',
  },
  {
    icon: Star,
    title: '108 Annahmestellen',
    desc: 'Bundesweit über 108 Annahmestellen für eine schnelle Vor-Ort-Abgabe Ihres Geräts.',
  },
]

/* ─────────────────────────────────────────────
   Page component
───────────────────────────────────────────── */
export function Vorabdiagnose() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="Kostenlose Vorab-Diagnose – Smartphone, iPhone & Handy Problem erkennen"
        description="Kostenlose Online-Diagnose für Smartphone, iPhone, Samsung & Tablet. In 3 Schritten zum Reparaturergebnis – Displayschaden, Akku, Kamera & mehr."
        canonical="/vorabdiagnose"
        keywords="Vorabdiagnose Smartphone, Handy Diagnose kostenlos, iPhone Diagnose, Samsung Diagnose, Displayschaden erkennen, Akku Diagnose, Gerät geht nicht an, Handyreparatur Diagnose, Smartphone Problem erkennen, Display gebrochen Diagnose"
        jsonLd={vorabdiagnoseJsonLd}
      />
      <McRepairNav />

      {/* ── Hero ── */}
      <section className="diagnose-hero" aria-label="Vorabdiagnose Einstieg">
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
            <p>
              {t(
                'vorabdiagnose.heroDesc',
                'Beantworten Sie einige kurze Fragen und finden Sie heraus, welche Reparatur Ihr Gerät benötigt.',
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ── Wizard Section ── */}
      <section className="diagnose-section" aria-label="Diagnose-Assistent starten">
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
                <p>
                  Mo–Fr 10–12, 14–16 Uhr
                  <br />
                  <a href="tel:+4930403688951">030 / 403 68 89 51</a>
                </p>
              </div>
            </div>
            <div className="diagnose-info-card">
              <div className="diagnose-info-icon">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="diagnose-info-text">
                <h4>{t('vorabdiagnose.onsite', 'Vor-Ort-Diagnose')}</h4>
                <p>
                  {t('vorabdiagnose.visitUs', 'Besuchen Sie eine unserer')}
                  <br />
                  <a href="/annahmestellen">108 {t('vorabdiagnose.locations', 'Annahmestellen')}</a>
                </p>
              </div>
            </div>
            <div className="diagnose-info-card">
              <div className="diagnose-info-icon">
                <Wrench className="w-6 h-6" />
              </div>
              <div className="diagnose-info-text">
                <h4>{t('vorabdiagnose.bookRepairShort', 'Reparatur buchen')}</h4>
                <p>
                  {t('vorabdiagnose.bookOnline', 'Direkt online buchen')}
                  <br />
                  <a href="/#hero">{t('vorabdiagnose.toConfigurator', 'Zum Konfigurator')}</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="diagnose-how-works" aria-labelledby="how-it-works-heading">
        <div className="container">
          <div className="diagnose-section-header">
            <h2 id="how-it-works-heading">Wie funktioniert die Vorabdiagnose?</h2>
            <p>
              In nur 3 kurzen Schritten erhalten Sie eine fundierte Einschätzung des Schadens an
              Ihrem Smartphone, iPhone, Samsung Galaxy oder Tablet – komplett kostenlos und ohne
              Anmeldung.
            </p>
          </div>
          <ol className="diagnose-how-works-grid" aria-label="Schritte der Vorabdiagnose">
            <li className="diagnose-how-step">
              <div className="diagnose-how-step-num" aria-hidden="true">
                <Search className="w-5 h-5" />
              </div>
              <h3>Problem auswählen</h3>
              <p>
                Wählen Sie aus 10 Problemkategorien – z. B. Displayschaden, Akku schwach oder
                Kamerafehler – diejenige, die Ihr aktuelles Geräteproblem am besten beschreibt.
              </p>
            </li>
            <li className="diagnose-how-step">
              <div className="diagnose-how-step-num" aria-hidden="true">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3>Folgefragen beantworten</h3>
              <p>
                Beantworten Sie 2 bis 3 gezielte Folgefragen. So grenzen wir den Schaden weiter
                ein und ermöglichen eine präzise, individuelle Diagnose.
              </p>
            </li>
            <li className="diagnose-how-step">
              <div className="diagnose-how-step-num" aria-hidden="true">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3>Diagnose & Empfehlung erhalten</h3>
              <p>
                Sie erhalten eine konkrete Einschätzung des Schadens sowie eine
                Reparaturempfehlung mit Hinweis, ob ein Austausch, eine Reinigung oder eine
                weitere Vor-Ort-Diagnose sinnvoll ist.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* ── Problem categories ── */}
      <section className="diagnose-problems-section" aria-labelledby="problems-heading">
        <div className="container">
          <div className="diagnose-section-header">
            <h2 id="problems-heading">Welche Geräteprobleme erkennen wir?</h2>
            <p>
              Unser Diagnose-Assistent deckt alle häufigen Probleme bei Smartphones, iPhones,
              Samsung-Geräten, Tablets und Notebooks ab.
            </p>
          </div>
          <ul className="diagnose-problems-grid" aria-label="Unterstützte Problemkategorien">
            {problemCategories.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="diagnose-problem-card">
                <div className="diagnose-problem-icon" aria-hidden="true">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="diagnose-problem-text">
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Common diagnostic results ── */}
      <section className="diagnose-results-section" aria-labelledby="results-heading">
        <div className="container">
          <div className="diagnose-section-header">
            <h2 id="results-heading">Typische Diagnosen & Reparaturhinweise</h2>
            <p>
              Die häufigsten Diagnose-Ergebnisse unseres Assistenten auf einen Blick – für
              Smartphones, iPhones und Samsung-Geräte.
            </p>
          </div>
          <dl className="diagnose-results-list">
            {commonDiagnoses.map(({ q, a }) => (
              <div key={q} className="diagnose-result-item">
                <dt>
                  <h3>{q}</h3>
                </dt>
                <dd>
                  <p>{a}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Benefits + CTA ── */}
      <section className="diagnose-benefits-section" aria-labelledby="benefits-heading">
        <div className="container">
          <h2 id="benefits-heading">Warum McRepair.de für Ihre Reparatur?</h2>
          <ul className="diagnose-benefits-grid" aria-label="Vorteile von McRepair.de">
            {benefits.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="diagnose-benefit-card">
                <div className="diagnose-benefit-icon" aria-hidden="true">
                  <Icon className="w-8 h-8" />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </li>
            ))}
          </ul>
          <div className="diagnose-benefits-cta">
            <a href="/#hero" className="diagnose-benefits-cta-btn">
              <Wrench className="w-4 h-4" />
              Reparatur jetzt buchen
            </a>
            <a href="/annahmestellen" className="diagnose-benefits-cta-btn diagnose-benefits-cta-btn-outline">
              <MapPin className="w-4 h-4" />
              Annahmestelle finden
            </a>
            <a href="/faq" className="diagnose-benefits-cta-btn diagnose-benefits-cta-btn-outline">
              <HelpCircle className="w-4 h-4" />
              Häufige Fragen
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}

