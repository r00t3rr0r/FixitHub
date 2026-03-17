import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './Privacy.css';

export function Privacy() {
  return (
    <>
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="privacy-page">
        <div className="container">
          <div className="privacy-content">
            {/* Header */}
            <header className="privacy-header">
              <h1>Datenschutzerklärung</h1>
            </header>

            {/* General Information */}
            <section className="privacy-section">
              <p>
                Soweit nachstehend keine anderen Angaben gemacht werden, ist die Bereitstellung Ihrer personenbezogenen Daten weder gesetzlich oder vertraglich vorgeschrieben, noch für einen Vertragsabschluss erforderlich. Sie sind zur Bereitstellung der Daten nicht verpflichtet. Eine Nichtbereitstellung hat keine Folgen. Dies gilt nur soweit bei den nachfolgenden Verarbeitungsvorgängen keine anderweitige Angabe gemacht wird.
              </p>
              <p className="definition-highlight">
                "Personenbezogene Daten" sind alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person beziehen.
              </p>
            </section>

            {/* Verantwortlicher / Controller */}
            <section className="privacy-section">
              <h2>Verantwortlicher</h2>
              <div className="contact-info">
                <p><strong>Online Point GmbH</strong><br />
                Kurfürstenstr. 106<br />
                10787 Berlin<br />
                Deutschland</p>
                <p>
                  <strong>Telefon:</strong> 030 403 688 951<br />
                  <strong>E-Mail:</strong> kontakt@mcrepair.de
                </p>
              </div>
            </section>

            {/* Server-Logfiles */}
            <section className="privacy-section">
              <h2>Server-Logfiles</h2>
              <p>
                Sie können unsere Webseiten besuchen, ohne Angaben zu Ihrer Person zu machen. Es werden bei jedem Zugriff auf unsere Website Nutzungsdaten durch Ihren Internetbrowser übermittelt und in Protokolldaten (Server-Logfiles) gespeichert. Zu diesen gespeicherten Daten gehören z.B. Name der aufgerufenen Seite, Datum und Uhrzeit des Abrufs, übertragene Datenmenge und der anfragende Provider. Diese Daten dienen ausschließlich der Gewährleistung eines störungsfreien Betriebs unserer Website und zur Verbesserung unseres Angebotes. Eine Zuordnung dieser Daten zu einer bestimmten Person ist nicht möglich.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)
              </div>
            </section>

            {/* Kontaktformular */}
            <section className="privacy-section">
              <h2>Erhebung und Verarbeitung bei Nutzung des Kontaktformulars</h2>
              <p>
                Bei der Nutzung des Kontaktformulars erheben wir Ihre personenbezogenen Daten (Name, E-Mail-Adresse, Nachrichtentext) nur in dem von Ihnen zur Verfügung gestellten Umfang. Die Datenverarbeitung dient dem Zweck der Kontaktaufnahme. Mit Absenden Ihrer Nachricht willigen Sie in die Verarbeitung der übermittelten Daten ein.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)
              </div>
              <p>
                Sie können Ihre Einwilligung jederzeit durch Mitteilung an uns widerrufen, ohne dass die Rechtmäßigkeit der aufgrund der Einwilligung bis zum Widerruf erfolgten Verarbeitung berührt wird. Ihre E-Mail-Adresse nutzen wir nur zur Bearbeitung Ihrer Anfrage. Ihre Daten werden anschließend gelöscht, sofern Sie der weitergehenden Verarbeitung und Nutzung nicht zugestimmt haben.
              </p>
            </section>

            {/* Google reCAPTCHA */}
            <section className="privacy-section">
              <h2>Verwendung von Google reCAPTCHA</h2>
              <p>
                Wir verwenden auf unserer Website den Dienst reCAPTCHA der Google Inc. (1600 Amphitheatre Parkway, Mountain View, CA 94043, USA; „Google"). Die Abfrage dient dem Zweck der Unterscheidung, ob die Eingabe durch einen Menschen oder durch automatisierte, maschinelle Verarbeitung erfolgt.
              </p>
              <p>
                Die Abfrage schließt den Versand der IP-Adresse und ggf. weiterer von Google für den Dienst reCAPTCHA benötigter Daten an Google ein. Zu diesem Zweck wird Ihre Eingabe an Google übermittelt und dort weiter verwendet. Ihre IP-Adresse wird von Google jedoch innerhalb von Mitgliedstaaten der Europäischen Union oder in anderen Vertragsstaaten des Abkommens über den Europäischen Wirtschaftsraum zuvor gekürzt. Nur in Ausnahmefällen wird die volle IP-Adresse an einen Server von Google in den USA übertragen und dort gekürzt.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)<br />
                <strong>Datenübermittlung:</strong> USA (Angemessenheitsbeschluss der EU-Kommission)
              </div>
              <p>
                Nähere Informationen zu Google reCAPTCHA sowie die dazugehörige Datenschutzerklärung finden Sie unter: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a>
              </p>
            </section>

            {/* Kundenkonto */}
            <section className="privacy-section">
              <h2>Kundenkonto</h2>
              <p>
                Bei der Eröffnung eines Kundenkontos erheben wir Ihre personenbezogenen Daten in dem dort angegeben Umfang. Die Datenverarbeitung dient dem Zweck, Ihr Einkaufserlebnis zu verbessern und die Bestellabwicklung zu vereinfachen.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)
              </div>
              <p>
                Sie können Ihre Einwilligung jederzeit durch Mitteilung an uns widerrufen, ohne dass die Rechtmäßigkeit der aufgrund der Einwilligung bis zum Widerruf erfolgten Verarbeitung berührt wird. Ihr Kundenkonto wird anschließend gelöscht.
              </p>
            </section>

            {/* Bestellungen */}
            <section className="privacy-section">
              <h2>Erhebung, Verarbeitung und Nutzung personenbezogener Daten bei Bestellungen</h2>
              <p>
                Bei der Bestellung erheben und verwenden wir Ihre personenbezogenen Daten nur, soweit dies zur Erfüllung und Abwicklung Ihrer Bestellung sowie zur Bearbeitung Ihrer Anfragen erforderlich ist. Die Bereitstellung der Daten ist für den Vertragsschluss erforderlich. Eine Nichtbereitstellung hat zur Folge, dass kein Vertrag geschlossen werden kann.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
              </div>
              <p>
                Eine Weitergabe Ihrer Daten an Dritte ohne Ihre ausdrückliche Einwilligung erfolgt nicht. Ausgenommen hiervon sind lediglich unsere Dienstleistungspartner, die wir zur Abwicklung des Vertragsverhältnisses benötigen oder Dienstleister derer wir uns im Rahmen einer Auftragsverarbeitung bedienen. Neben den in den jeweiligen Klauseln dieser Datenschutzerklärung benannten Empfängern sind dies beispielsweise Empfänger folgender Kategorien:
              </p>
              <ul className="category-list">
                <li>Versanddienstleister</li>
                <li>Zahlungsdienstleister</li>
                <li>Warenwirtschaftsdienstleister</li>
                <li>Diensteanbieter für die Bestellabwicklung</li>
                <li>Webhoster</li>
                <li>IT-Dienstleister</li>
                <li>Dropshipping Händler</li>
              </ul>
              <p>
                In allen Fällen beachten wir strikt die gesetzlichen Vorgaben. Der Umfang der Datenübermittlung beschränkt sich auf ein Mindestmaß.
              </p>
            </section>

            {/* Käufersiegel */}
            <section className="privacy-section">
              <h2>Käufersiegel-Kundenbewertung</h2>
              <p>
                Wir verwenden auf unserer Website das Käufersiegel-Kundenbewertungs-Tool der Händlerbund Management AG (Torgauer Straße 233 B, 04347 Leipzig). Nach Ihrer Bestellung möchten wir Sie bitten, Ihren Kauf bei uns zu bewerten und zu kommentieren.
              </p>
              <p>
                Zu diesem Zweck werden Sie von uns per E-Mail angeschrieben, wobei wir uns hierbei des technischen Systems des Anbieters des Käufersiegel-Bewertungstools im Rahmen einer Auftragsverarbeitung bedienen.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (mit Einwilligung) oder Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an verifizierten Bewertungen)
              </div>
              <p>
                Der Widerspruch ist jederzeit durch Mitteilung an uns möglich. Die Kontaktdaten für die Ausübung des Widerspruchs finden Sie im Impressum. Sie können auch den dafür vorgesehenen Link in der Bewertungsaufforderung nutzen.
              </p>
              <p>
                Die in diesem Zusammenhang im technischen System des Käufersiegel-Bewertungstools gespeicherten personenbezogenen Daten werden 3 Monate nach der zur Bewertung erfassten Warenlieferung gelöscht.
              </p>
            </section>

            {/* Newsletter */}
            <section className="privacy-section">
              <h2>Verwendung der E-Mail-Adresse für die Zusendung von Newslettern</h2>
              <p>
                Wir nutzen Ihre E-Mail-Adresse unabhängig von der Vertragsabwicklung ausschließlich für eigene Werbezwecke zum Newsletterversand, sofern Sie dem ausdrücklich zugestimmt haben.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)
              </div>
              <p>
                Sie können die Einwilligung jederzeit widerrufen, ohne dass die Rechtmäßigkeit der aufgrund der Einwilligung bis zum Widerruf erfolgten Verarbeitung berührt wird. Sie können dazu den Newsletter jederzeit unter Nutzung des entsprechenden Links im Newsletter oder durch Mitteilung an uns abbestellen. Ihre E-Mail-Adresse wird danach aus dem Verteiler entfernt.
              </p>
            </section>

            {/* Versandstatus */}
            <section className="privacy-section">
              <h2>Weitergabe der E-Mail-Adresse an Versandunternehmen zur Information über den Versandstatus</h2>
              <p>
                Wir geben Ihre E-Mail-Adresse im Rahmen der Vertragsabwicklung an das Transportunternehmen weiter, sofern Sie dem ausdrücklich im Bestellvorgang zugestimmt haben. Die Weitergabe dient dem Zweck, Sie per E-Mail über den Versandstatus zu informieren.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)
              </div>
              <p>
                Sie können die Einwilligung jederzeit durch Mitteilung an uns oder das Transportunternehmen widerrufen.
              </p>
            </section>

            {/* Warenwirtschaftssystem */}
            <section className="privacy-section">
              <h2>Nutzung eines externen Warenwirtschaftssystems</h2>
              <p>
                Wir verwenden zur Vertragsabwicklung ein Warenwirtschaftssystem im Rahmen einer Auftragsverarbeitung. Dazu werden Ihre im Rahmen der Bestellung erhobenen personenbezogenen Daten an JTL-Software-GmbH, Rheinstr. 7, 41836 Hückelhoven, Deutschland übermittelt.
              </p>
            </section>

            {/* PayPal */}
            <section className="privacy-section">
              <h2>Verwendung von PayPal</h2>
              <p>
                Alle PayPal-Transaktionen unterliegen der PayPal-Datenschutzerklärung. Diese finden Sie unter: <a href="https://www.paypal.com/de/webapps/mpp/ua/privacy-prev?locale.x=de_DE" target="_blank" rel="noopener noreferrer">https://www.paypal.com/de/webapps/mpp/ua/privacy-prev</a>
              </p>
            </section>

            {/* Cookies */}
            <section className="privacy-section">
              <h2>Cookies</h2>
              <p>
                Unsere Website verwendet Cookies. Cookies sind kleine Textdateien, die im Internetbrowser bzw. vom Internetbrowser auf dem Computersystem eines Nutzers gespeichert werden. Ruft ein Nutzer eine Website auf, so kann ein Cookie auf dem Betriebssystem des Nutzers gespeichert werden. Dieser Cookie enthält eine charakteristische Zeichenfolge, die eine eindeutige Identifizierung des Browsers beim erneuten Aufrufen der Website ermöglicht.
              </p>
              <p>
                Wir setzen Cookies zu dem Zweck ein, unser Angebot nutzerfreundlicher, effektiver und sicherer zu machen. Des Weiteren ermöglichen Cookies unseren Systemen, Ihren Browser auch nach einem Seitenwechsel zu erkennen und Ihnen Services anzubieten. Einige Funktionen unserer Internetseite können ohne den Einsatz von Cookies nicht angeboten werden.
              </p>
              <p>
                Wir verwenden auf unserer Website darüber hinaus Cookies zu dem Zweck, eine Analyse des Surfverhaltens unserer Seitenbesucher zu ermöglichen. Des Weiteren verwenden wir Cookies zu dem Zweck, Seitenbesucher anschließend auf anderen Webseiten mit gezielter, interessenbezogener Werbung anzusprechen.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> § 15 Abs. 3 TMG sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)
              </div>
              <p>
                Die auf diese Weise von Ihnen erhobenen Daten werden durch technische Vorkehrungen pseudonymisiert. Eine Zuordnung der Daten zu Ihrer Person ist daher nicht mehr möglich. Die Daten werden nicht gemeinsam mit sonstigen personenbezogenen Daten von Ihnen gespeichert.
              </p>
              <p>
                Sie haben das Recht aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit dieser auf Art. 6 Abs. 1 lit. f DSGVO beruhenden Verarbeitung Sie betreffender personenbezogener Daten zu widersprechen.
              </p>
              <p>
                Cookies werden auf Ihrem Rechner gespeichert. Daher haben Sie die volle Kontrolle über die Verwendung von Cookies. Durch die Auswahl entsprechender technischer Einstellungen in Ihrem Internetbrowser können Sie die Speicherung der Cookies und Übermittlung der enthaltenen Daten verhindern. Bereits gespeicherte Cookies können jederzeit gelöscht werden. Wir weisen Sie jedoch darauf hin, dass Sie dann gegebenenfalls nicht sämtliche Funktionen dieser Website vollumfänglich werden nutzen können.
              </p>
              <div className="browser-settings">
                <h3>Cookie-Verwaltung in Browsern:</h3>
                <ul>
                  <li><a href="https://support.google.com/accounts/answer/61416?hl=de" target="_blank" rel="noopener noreferrer">Chrome Browser</a></li>
                  <li><a href="https://support.microsoft.com/de-de/help/17442/windows-internet-explorer-delete-manage-cookies" target="_blank" rel="noopener noreferrer">Internet Explorer</a></li>
                  <li><a href="https://support.mozilla.org/de/kb/cookies-erlauben-und-ablehnen" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
                  <li><a href="https://support.apple.com/de-de/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
                </ul>
              </div>
            </section>

            {/* Google Analytics */}
            <section className="privacy-section">
              <h2>Nutzung von Google Analytics</h2>
              <p>
                Wir verwenden auf unserer Website den Webanalysedienst Google Analytics der Google Inc. (1600 Amphitheatre Parkway, Mountain View, CA 94043, USA; „Google"). Die Datenverarbeitung dient dem Zweck der Analyse dieser Website und ihrer Besucher.
              </p>
              <p>
                Google Analytics verwendet Cookies, die eine Analyse der Benutzung der Website durch Sie ermöglichen. Die durch die Cookies erzeugten Informationen über Ihre Benutzung dieser Website werden in der Regel an einen Server von Google in den USA übertragen und dort gespeichert. Auf dieser Website ist die IP-Anonymisierung aktiviert. Dadurch wird Ihre IP-Adresse von Google innerhalb von Mitgliedstaaten der Europäischen Union oder in anderen Vertragsstaaten des Abkommens über den Europäischen Wirtschaftsraum zuvor gekürzt.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an bedarfsgerechter Gestaltung)<br />
                <strong>Datenübermittlung:</strong> USA (Angemessenheitsbeschluss der EU-Kommission)
              </div>
              <p>
                Sie können die Erfassung der durch das Cookie erzeugten und auf Ihre Nutzung der Website bezogenen Daten (inkl. Ihrer IP-Adresse) an Google sowie die Verarbeitung dieser Daten durch Google verhindern, indem sie das unter dem folgenden Link verfügbare Browser-Plug-in herunterladen und installieren: <a href="https://tools.google.com/dlpage/gaoptout?hl=de" target="_blank" rel="noopener noreferrer">Google Analytics deaktivieren</a>
              </p>
              <p>
                Nähere Informationen zu Nutzungsbedingungen und Datenschutz finden Sie unter <a href="https://www.google.com/analytics/terms/de.html" target="_blank" rel="noopener noreferrer">Google Analytics Terms</a> bzw. unter <a href="https://www.google.de/intl/de/policies/" target="_blank" rel="noopener noreferrer">Google Policies</a>.
              </p>
            </section>

            {/* Google Remarketing */}
            <section className="privacy-section">
              <h2>Verwendung der Remarketing- oder "Ähnliche Zielgruppen"-Funktion der Google Inc.</h2>
              <p>
                Wir verwenden auf unserer Website die Remarketing- oder "Ähnliche Zielgruppen"- Funktion der Google Inc. (1600 Amphitheatre Parkway, Mountain View, CA 94043, USA; „Google"). Diese Funktion dient dem Zweck der Analyse des Besucherverhaltens und der Besucherinteressen.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an zielgerichteter Werbung)<br />
                <strong>Datenübermittlung:</strong> USA (Angemessenheitsbeschluss der EU-Kommission)
              </div>
              <p>
                Sie können die Verwendung von Cookies durch Google dauerhaft deaktivieren, indem Sie dem nachfolgenden Link folgen und das dort bereitgestellte Plug-In herunterladen und installieren: <a href="https://support.google.com/ads/answer/7395996?hl=de" target="_blank" rel="noopener noreferrer">Google Ads deaktivieren</a>
              </p>
              <p>
                Alternativ können Sie die Verwendung von Cookies durch Drittanbieter deaktivieren, indem sie die Deaktivierungsseite der Netzwerkwerbeinitiative (Network Advertising Initiative) unter <a href="https://www.networkadvertising.org/choices/" target="_blank" rel="noopener noreferrer">https://www.networkadvertising.org/choices/</a> aufrufen.
              </p>
              <p>
                Nähere Informationen zu Google Remarketing sowie die dazugehörige Datenschutzerklärung finden Sie unter: <a href="https://www.google.com/privacy/ads/" target="_blank" rel="noopener noreferrer">https://www.google.com/privacy/ads/</a>
              </p>
            </section>

            {/* Google AdWords Conversion Tracking */}
            <section className="privacy-section">
              <h2>Verwendung von Google AdWords Conversion-Tracking</h2>
              <p>
                Wir verwenden auf unserer Website das Online-Werbeprogramm „Google AdWords" und in diesem Rahmen Conversion-Tracking (Besuchsaktionsauswertung). Das Google Conversion Tracking ist ein Analysedienst der Google Inc.
              </p>
              <p>
                Wenn Sie auf eine von Google geschaltete Anzeige klicken, wird ein Cookie für das Conversion-Tracking auf Ihrem Rechner abgelegt. Diese Cookies haben eine begrenzte Gültigkeit, enthalten keine personenbezogenen Daten und dienen somit nicht der persönlichen Identifizierung.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an zielgerichteter Werbung)
              </div>
              <p>
                Weiterführende Informationen sowie die Datenschutzerklärung von Google finden Sie unter: <a href="https://www.google.de/policies/privacy/" target="_blank" rel="noopener noreferrer">https://www.google.de/policies/privacy/</a>
              </p>
            </section>

            {/* Facebook Remarketing */}
            <section className="privacy-section">
              <h2>Verwendung von Facebook Remarketing</h2>
              <p>
                Wir verwenden auf unserer Website die Remarketing-Funktion „Custom Audiences" der Facebook Inc. (1601 S. California Ave, Palo Alto, CA 94304, USA; "Facebook"). Diese Funktion dient dem Zweck die Besucher der Website zielgerichtet mit interessenbezogener Werbung im sozialen Netzwerk Facebook anzusprechen.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an zielgerichteter Werbung)
              </div>
              <p>
                Nähere Informationen zur Erhebung und Nutzung der Daten durch Facebook, über Ihre diesbezüglichen Rechte und Möglichkeiten zum Schutz Ihrer Privatsphäre finden Sie in den Datenschutzhinweisen von Facebook unter <a href="https://www.facebook.com/about/privacy/" target="_blank" rel="noopener noreferrer">https://www.facebook.com/about/privacy/</a>.
              </p>
            </section>

            {/* Google AdSense */}
            <section className="privacy-section">
              <h2>Verwendung von Google AdSense</h2>
              <p>
                Wir verwenden auf unserer Website die AdSense-Funktion der Google Inc. (1600 Amphitheatre Parkway, Mountain View, CA 94043, USA; „Google"). Diese Funktion dient dem Zweck Werbeflächen auf der Website zu vermieten und auf diesen die Besucher der Website zielgerichtet mit interessenbezogener Werbung anzusprechen.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)
              </div>
              <p>
                Sie können die Verwendung von Cookies durch Google dauerhaft deaktivieren, indem Sie dem nachfolgenden Link folgen und das dort bereitgestellte Plug-In herunterladen und installieren: <a href="https://support.google.com/ads/answer/7395996?hl=de" target="_blank" rel="noopener noreferrer">Google Ads deaktivieren</a>
              </p>
              <p>
                Nähere Informationen sowie die Datenschutzerklärung von Google finden Sie unter: <a href="https://www.google.com/policies/technologies/ads/" target="_blank" rel="noopener noreferrer">https://www.google.com/policies/technologies/ads/</a>
              </p>
            </section>

            {/* Bing Ads */}
            <section className="privacy-section">
              <h2>Verwendung von Bing Ads</h2>
              <p>
                Wir verwenden auf unserer Website Bing Ads der Microsoft Corporation (Microsoft Corporation, One Microsoft Way, Redmond, WA 98052-6399, USA; "Microsoft"). Bei Klick auf eine von Microsoft Bing Ads geschaltete Anzeige, wird ein Cookie für das Conversion-Tracking auf Ihrem Rechner abgelegt.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an zielgerichteter Werbung)<br />
                <strong>Datenschutz:</strong> Microsoft Bing hat sich nach dem US-EU-Datenschutzabkommen „Privacy Shield" zertifiziert
              </div>
              <p>
                Nähere Informationen zum Datenschutz und den eingesetzten Cookies bei Microsoft Bing finden Sie unter: <a href="https://privacy.microsoft.com/de-de/privacystatement" target="_blank" rel="noopener noreferrer">https://privacy.microsoft.com/de-de/privacystatement</a>
              </p>
            </section>

            {/* Social Media Plug-ins */}
            <section className="privacy-section">
              <h2>Verwendung von Social Plug-ins mittels „Shariff"</h2>
              <p>
                Wir verwenden auf unserer Website Plug-ins sozialer Netzwerke. Damit Sie die Kontrolle über Ihre Daten behalten, nutzen wir die datenschutzsichere „Shariff"-Schaltflächen.
              </p>
              <p>
                Ohne Ihre ausdrückliche Zustimmung werden keine Verknüpfungen zu den Servern der sozialen Netzwerke hergestellt und folglich keine Daten übermittelt. „Shariff" ist eine Entwicklung der Spezialisten der Computerzeitschrift c't. Es ermöglicht mehr Privatsphäre im Netz und ersetzt die üblichen "Share"-Buttons der sozialen Netzwerke.
              </p>
              <p>
                Erst wenn Sie die Buttons anklicken, erscheint ein Popup-Fenster, in dem Sie sich mit Ihren Daten beim jeweiligen Anbieter einloggen können. Durch Ihr Login geben Sie Ihre Zustimmung zur Übertragung Ihrer Daten an den jeweiligen Social Media Anbieter.
              </p>
              <h3>Eingebundene soziale Netzwerke:</h3>
              <ul className="social-list">
                <li><strong>Google+</strong> der Google Inc. - <a href="https://www.google.com/intl/de/+/policy/+1button.html" target="_blank" rel="noopener noreferrer">Datenschutz</a></li>
                <li><strong>Facebook</strong> der Facebook Inc. - <a href="https://www.facebook.com/policy.php" target="_blank" rel="noopener noreferrer">Datenschutz</a></li>
                <li><strong>Twitter</strong> der Twitter Inc. - <a href="https://twitter.com/privacy" target="_blank" rel="noopener noreferrer">Datenschutz</a></li>
                <li><strong>Instagram</strong> der Instagram LLC - <a href="https://help.instagram.com/155833707900388" target="_blank" rel="noopener noreferrer">Datenschutz</a></li>
                <li><strong>XING</strong> der XING SE - <a href="https://www.xing.com/privacy" target="_blank" rel="noopener noreferrer">Datenschutz</a></li>
              </ul>
            </section>

            {/* YouTube */}
            <section className="privacy-section">
              <h2>Verwendung von YouTube</h2>
              <p>
                Wir verwenden auf unserer Website die Funktion zur Einbettung von YouTube-Videos der YouTube LLC. (901 Cherry Ave., San Bruno, CA 94066, USA; „YouTube"). YouTube ist ein mit der Google Inc. verbundenes Unternehmen.
              </p>
              <p>
                Die Funktion zeigt bei YouTube hinterlegte Videos in einem iFrame auf der Website an. Dabei ist die Option „Erweiterter Datenschutzmodus" aktiviert. Dadurch werden von YouTube keine Informationen über die Besucher der Website gespeichert. Erst wenn Sie sich ein Video ansehen, werden Informationen darüber an YouTube übermittelt und dort gespeichert.
              </p>
              <p>
                Nähere Informationen zur Erhebung und Nutzung der Daten durch YouTube und Google finden Sie in den Datenschutzhinweisen von YouTube: <a href="https://www.youtube.com/t/privacy" target="_blank" rel="noopener noreferrer">https://www.youtube.com/t/privacy</a>
              </p>
            </section>

            {/* Google Maps */}
            <section className="privacy-section">
              <h2>Verwendung von Google Maps</h2>
              <p>
                Wir verwenden auf unserer Website die Funktion zur Einbettung von Google Maps-Karten der Google Inc. (1600 Amphitheatre Parkway, Mountain View, CA 94043, USA; "Google"). Die Funktion ermöglicht die visuelle Darstellung von geographischen Informationen und interaktiven Landkarten.
              </p>
              <div className="legal-basis">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an bedarfsgerechter Gestaltung)<br />
                <strong>Datenübermittlung:</strong> USA (Angemessenheitsbeschluss der EU-Kommission)
              </div>
              <p>
                Nähere Informationen zur Erhebung und Nutzung der Daten durch Google finden Sie in den Datenschutzhinweisen von Google unter <a href="https://www.google.com/privacypolicy.html" target="_blank" rel="noopener noreferrer">https://www.google.com/privacypolicy.html</a>.
              </p>
            </section>

            {/* Speicherdauer */}
            <section className="privacy-section">
              <h2>Dauer der Speicherung</h2>
              <p>
                Nach vollständiger Vertragsabwicklung werden die Daten zunächst für die Dauer der Gewährleistungsfrist, danach unter Berücksichtigung gesetzlicher, insbesondere steuer- und handelsrechtlicher Aufbewahrungsfristen gespeichert und dann nach Fristablauf gelöscht, sofern Sie der weitergehenden Verarbeitung und Nutzung nicht zugestimmt haben.
              </p>
              <div className="info-box">
                <h3>Gesetzliche Aufbewahrungsfristen:</h3>
                <ul>
                  <li><strong>Handelsrechtlich:</strong> 6-10 Jahre (§ 257 HGB)</li>
                  <li><strong>Steuerrechtlich:</strong> 10 Jahre (§ 147 AO)</li>
                </ul>
              </div>
            </section>

            {/* Betroffenenrechte */}
            <section className="privacy-section">
              <h2>Rechte der betroffenen Person</h2>
              <p>
                Ihnen stehen bei Vorliegen der gesetzlichen Voraussetzungen folgende Rechte nach Art. 15 bis 20 DSGVO zu:
              </p>
              <ul className="rights-list">
                <li><strong>Recht auf Auskunft</strong> (Art. 15 DSGVO)</li>
                <li><strong>Recht auf Berichtigung</strong> (Art. 16 DSGVO)</li>
                <li><strong>Recht auf Löschung</strong> (Art. 17 DSGVO)</li>
                <li><strong>Recht auf Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)</li>
                <li><strong>Recht auf Datenübertragbarkeit</strong> (Art. 20 DSGVO)</li>
              </ul>
              <p>
                Außerdem steht Ihnen nach Art. 21 Abs. 1 DSGVO ein <strong>Widerspruchsrecht</strong> gegen die Verarbeitungen zu, die auf Art. 6 Abs. 1 lit. f DSGVO beruhen, sowie gegen die Verarbeitung zum Zwecke von Direktwerbung.
              </p>
              <div className="contact-highlight">
                <p><strong>Kontaktieren Sie uns auf Wunsch.</strong><br />
                Die Kontaktdaten finden Sie in unserem Impressum.</p>
              </div>
            </section>

            {/* Beschwerderecht */}
            <section className="privacy-section">
              <h2>Beschwerderecht bei der Aufsichtsbehörde</h2>
              <p>
                Sie haben gemäß Art. 77 DSGVO das Recht, sich bei der Aufsichtsbehörde zu beschweren, wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer personenbezogenen Daten nicht rechtmäßig erfolgt.
              </p>
              <div className="authority-info">
                <h3>Zuständige Aufsichtsbehörde für Berlin:</h3>
                <p>
                  <strong>Berliner Beauftragte für Datenschutz und Informationsfreiheit</strong><br />
                  Friedrichstr. 219<br />
                  10969 Berlin<br />
                  <br />
                  Telefon: 030 13889-0<br />
                  E-Mail: mailbox@datenschutz-berlin.de<br />
                  Website: <a href="https://www.datenschutz-berlin.de" target="_blank" rel="noopener noreferrer">www.datenschutz-berlin.de</a>
                </p>
              </div>
            </section>

            {/* Stand der Datenschutzerklärung */}
            <section className="privacy-section last-section">
              <p className="last-updated">
                <strong>Stand dieser Datenschutzerklärung:</strong> März 2026
              </p>
              <p className="final-note">
                Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen in der Datenschutzerklärung umzusetzen. Für Ihren erneuten Besuch gilt dann die neue Datenschutzerklärung.
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer with McRepair Design */}
      <Footer />
    </>
  );
}
