import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './Widerrufsrecht.css';

export function Widerrufsrecht() {
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
              <h1>Widerrufsrecht Reparatur</h1>
            </header>

            {/* Consumer Definition */}
            <section className="widerrufsrecht-section">
              <h2>Widerrufsrecht für Verbraucher</h2>
              <p className="consumer-definition">
                (Verbraucher ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, 
                die überwiegend weder ihrer gewerblichen noch ihrer selbstständigen beruflichen Tätigkeit 
                zugerechnet werden kann.)
              </p>
            </section>

            {/* Widerrufsbelehrung */}
            <section className="widerrufsrecht-section">
              <h2>Widerrufsbelehrung</h2>
              
              <h3>Widerrufsrecht</h3>
              <p>
                Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
              </p>
              <p>
                Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
              </p>
              
              <p>
                Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Online Point GmbH, Kurfürstenstr. 106, 10787 Berlin, 
                Telefonnummer: 030 403 688 951, E-Mail-Adresse: kontakt@mcrepair.de) mittels einer eindeutigen Erklärung 
                (z.B. ein mit der Post versandter Brief, Telefax oder E-Mail) über Ihren Entschluss, diesen Vertrag zu 
                widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch 
                nicht vorgeschrieben ist.
              </p>
              
              <p>
                Sie können das Muster-Widerrufsformular oder eine andere eindeutige Erklärung auch auf unserer Webseite 
                (www.mcrepair.de) elektronisch ausfüllen und übermitteln. Machen Sie von dieser Möglichkeit Gebrauch, 
                so werden wir Ihnen unverzüglich (z.B. per E-Mail) eine Bestätigung über den Eingang eines solchen 
                Widerrufs übermitteln.
              </p>
              
              <p>
                Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts 
                vor Ablauf der Widerrufsfrist absenden.
              </p>
            </section>

            {/* Folgen des Widerrufs */}
            <section className="widerrufsrecht-section">
              <h3>Folgen des Widerrufs</h3>
              
              <p>
                Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, 
                einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie 
                eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), 
                unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über 
                Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe 
                Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde 
                ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
              </p>
              
              <p>
                Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns 
                einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung 
                des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich 
                zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.
              </p>
            </section>

            {/* Ausschluss- bzw. Erlöschensgründe */}
            <section className="widerrufsrecht-section">
              <h3>Ausschluss- bzw. Erlöschensgründe</h3>
              
              <p>
                Das Widerrufsrecht besteht nicht bei Verträgen zur Erbringung von Dienstleistungen im Zusammenhang mit 
                Freizeitbetätigungen, wenn der Vertrag für die Erbringung einen spezifischen Termin oder Zeitraum vorsieht.
              </p>
              
              <p>
                Das Widerrufsrecht erlischt bei einem Vertrag zur Erbringung von Dienstleistungen, wenn der Unternehmer 
                die Dienstleistung vollständig erbracht hat und mit der Ausführung der Dienstleistung erst begonnen hat, 
                nachdem der Verbraucher dazu seine ausdrückliche Zustimmung gegeben hat und gleichzeitig seine Kenntnis 
                davon bestätigt hat, dass er sein Widerrufsrecht bei vollständiger Vertragserfüllung durch den Unternehmer 
                verliert.
              </p>
            </section>

            {/* Muster-Widerrufsformular */}
            <section className="widerrufsrecht-section widerrufsrecht-form">
              <h2>Muster-Widerrufsformular</h2>
              
              <p className="form-intro">
                (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)
              </p>
              
              <div className="form-content">
                <p><strong>- An Online Point GmbH, Kurfürstenstr. 106, 10787 Berlin, E-Mail-Adresse: kontakt@mcrepair.de:</strong></p>
                
                <p>
                  <strong>- Hiermit widerrufe(n) ich/ wir (*) den von mir/ uns (*) abgeschlossenen Vertrag über den Kauf 
                  der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*)</strong>
                </p>
                
                <div className="form-fields">
                  <p>- Bestellt am (*) / erhalten am (*)</p>
                  <p>- Name des/ der Verbraucher(s)</p>
                  <p>- Anschrift des/ der Verbraucher(s)</p>
                  <p>- Unterschrift des/ der Verbraucher(s) (nur bei Mitteilung auf Papier)</p>
                  <p>- Datum</p>
                </div>
                
                <p className="form-footer">(*) Unzutreffendes streichen.</p>
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
