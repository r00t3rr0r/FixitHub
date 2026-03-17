import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { Package, Wrench, ThumbsUp } from 'lucide-react';
import './About.css';

export function About() {
  return (
    <>
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="about-page">
        <div className="container">
          <div className="about-content">
            {/* Header */}
            <header className="about-header">
              <h1>Über McRepair.de</h1>
              <div className="accent-line"></div>
              <p className="about-intro">
                McRepair ist einer der führenden Dienstleister für die professionelle Reparatur von Smartphones, 
                Tablets und Notebooks. Unsere Zentralwerkstatt mit Sitz in Berlin arbeitet bundesweit mit über 350 
                Annahmestellen zusammen und hilft Ihnen mit absolut zuverlässigen und professionellen Fachkräften 
                Ihr kaputtes Gerät wieder instand zu setzen.
              </p>
            </header>

            {/* So einfach geht's */}
            <section className="about-section steps-section">
              <h2 className="section-title-center">So einfach geht's</h2>
              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-number">1</div>
                  <div className="step-icon">
                    <Package />
                  </div>
                  <h3>Gerät und Reparatur auswählen</h3>
                  <p>Wählen Sie Ihr Gerät und die benötigte Reparatur aus unserem umfangreichen Angebot</p>
                </div>
                <div className="step-card">
                  <div className="step-number">2</div>
                  <div className="step-icon">
                    <Package />
                  </div>
                  <h3>Gerät einsenden oder vorbeibringen</h3>
                  <p>Nutzen Sie unseren kostenlosen Versandservice oder eine unserer 350 Annahmestellen</p>
                </div>
                <div className="step-card">
                  <div className="step-number">3</div>
                  <div className="step-icon">
                    <Wrench />
                  </div>
                  <h3>Wir reparieren es schnell und zuverlässig</h3>
                  <p>Unsere erfahrenen Techniker reparieren Ihr Gerät in nur 1-3 Werktagen</p>
                </div>
                <div className="step-card">
                  <div className="step-number">4</div>
                  <div className="step-icon">
                    <ThumbsUp />
                  </div>
                  <h3>Sie erhalten Ihr Gerät repariert zurück</h3>
                  <p>Ihr Gerät wird sicher zu Ihnen zurückgeschickt oder kann abgeholt werden</p>
                </div>
              </div>
            </section>

            {/* Was macht McRepair? */}
            <section className="about-section">
              <h2>Was macht McRepair?</h2>
              <h3 className="subtitle">Ganz einfach: Wir reparieren Ihr Smartphone, Tablet oder Notebook</h3>
              <p>
                Ist Ihr Smartphone defekt oder Ihr Tablet beschädigt, befindet es sich bei unseren hochqualifizierten 
                Technikern in besten Händen. Wir sind deutschlandweit einer der größten Reparaturwerkstätten für 
                Smartphones, Tablet und Notebooks und können auf langjährige Erfahrung verweisen. Wir übernehmen 
                Diagnose und Reparatur – selbstverständlich mit Datenerhalt. Unabhängig davon, ob Ihr Apple iPhone 
                heruntergefallen ist oder Ihr Samsung Galaxy Ladeprobleme aufweist – häufig handelt es sich lediglich 
                um kleine Fehler oder Schäden, die unsere Fachkräfte schnell und kostengünstig beheben können.
              </p>
            </section>

            {/* Was uns auszeichnet */}
            <section className="about-section highlight-section">
              <h2>Was uns auszeichnet</h2>
              <div className="highlight-box">
                <h3>Über 350 Annahmestellen bundesweit und einer zentralen Hauptwerkstatt mit langjährig-erfahrenen Technikern.</h3>
                <p>
                  Für kurze Reaktionszeiten haben wir qualitativ hochwertige Ersatzteile für alle namhaften Hersteller 
                  wie Apple oder Samsung stets in großer Stückzahl vorrätig. Dank bundesweit über 350 Annahmestellen 
                  können Sie unseren komfortablen und sicheren Service auch in Ihrer Nähe in Anspruch nehmen. Wir bauen 
                  unser Netzwerk beständig aus. Sollten Sie keinen Partner in Ihrer Region finden, freuen wir uns immer 
                  über neue Empfehlungen. Der Hin- und Rückversand Ihres mobilen Endgeräts mit unserem Partner DHL ist 
                  natürlich kostenlos.
                </p>
              </div>
            </section>

            {/* Galerie */}
            <section className="about-section gallery-section">
              <h2 className="section-title-center">Galerie</h2>
              <div className="gallery-collage">
                <div className="gallery-item gallery-large">
                  <img 
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_werkstatt.jpg" 
                    alt="McRepair Werkstatt" 
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-medium">
                  <img 
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_laptop_reparatur.jpg" 
                    alt="McRepair Laptop Reparatur" 
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-medium">
                  <img 
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_laptop_reparatur2.jpg" 
                    alt="McRepair Laptop Reparatur 2" 
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-small">
                  <img 
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_handy_reparatur3.jpg" 
                    alt="McRepair Smartphone Reparatur 3" 
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-small">
                  <img 
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_handy_reparatur2.jpg" 
                    alt="McRepair Smartphone Reparatur 2" 
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-medium">
                  <img 
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_handy_reparatur.jpg" 
                    alt="McRepair Smartphone Reparatur" 
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-small">
                  <img 
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_akkutausch.jpg" 
                    alt="McRepair Akkutausch" 
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-small">
                  <img 
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_akkutausch2.jpg" 
                    alt="McRepair Akkutausch 2" 
                    loading="lazy"
                  />
                </div>
              </div>
            </section>

            {/* Unsere Annahmestellen */}
            <section className="about-section locations-section">
              <div className="locations-content">
                <div className="locations-text">
                  <h2>Unsere Annahmestellen</h2>
                  <h3 className="subtitle">Annahmestellen in ganz Deutschland</h3>
                  <p>
                    Nutzen Sie eine unserer 350 Annahmestellen in ganz Deutschland, um Ihr Gerät ganz bequem in unsere 
                    Obhut zu geben.
                  </p>
                  <p>
                    Dank kurzer Durchlaufzeiten von nur ein bis drei Werktagen müssen Sie bei uns nicht länger als 
                    absolut nötig auf Ihr Smartphone oder Tablet verzichten. Stellen Sie unser konsequentes 
                    Qualitätsbewusstsein auf die Probe – wir werden Ihre Erwartungen übertreffen und machen Sie schnell 
                    für Ihr privates und berufliches Umfeld wieder uneingeschränkt erreichbar.
                  </p>
                  <p>
                    <strong>Wo Sie sich die nächste Annahmestelle befindet?</strong> Schauen Sie einfach auf unserer 
                    Umgebungssuche nach.
                  </p>
                </div>
                <div className="locations-image">
                  <img 
                    src="https://www.mcrepair.de/bilder/ueberuns/deutschland_annahmestellen.jpg" 
                    alt="Deutschland Annahmestellen Karte" 
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Hersteller */}
            <section className="about-section manufacturers-section">
              <h2 className="section-title-center">Hersteller</h2>
              <p className="manufacturers-intro">
                Wir führen Reparaturen aller namhaften Hersteller von Smartphones, Tablets und Notebooks aus. Falls Sie 
                Ihren gewünschten Hersteller bei uns nicht gefunden haben, dann können Sie gerne eine individuelle 
                Preisanfrage für die Reparatur Ihres Gerätes unter Kontakt anfragen.
              </p>
              <div className="manufacturers-grid">
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Sony</div>
                  <p>Sony Reparatur</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Google</div>
                  <p>Google Reparatur</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Apple</div>
                  <p>Apple Reparatur</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Asus</div>
                  <p>Asus Reparatur</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">LG</div>
                  <p>LG Reparatur</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">OnePlus</div>
                  <p>OnePlus Reparatur</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Motorola</div>
                  <p>Motorola Reparatur</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">HTC</div>
                  <p>HTC Reparatur</p>
                </div>
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
