import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './Terms.css';

export function Terms() {
  return (
    <>
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="terms-page">
        <div className="container">
          <div className="terms-content">
            {/* Header */}
            <header className="terms-header">
              <h1>AGB und Kundeninformationen</h1>
              <p className="terms-subtitle">Allgemeine Geschäftsbedingungen und Kundeninformationen</p>
            </header>

            {/* I. Allgemeine Geschäftsbedingungen */}
            <section className="terms-part">
              <h2 className="part-title">I. Allgemeine Geschäftsbedingungen</h2>

              {/* § 1 Grundlegende Bestimmungen */}
              <div className="terms-section">
                <h3>§ 1 Grundlegende Bestimmungen</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">(1)</p>
                  <p>Die nachstehenden Geschäftsbedingungen gelten für alle Verträge, die Sie mit uns als Anbieter (Online Point GmbH) über die Internetseite www.mcrepair.de schließen. Soweit nicht anders vereinbart, wird der Einbeziehung gegebenenfalls von Ihnen verwendeter eigener Bedingungen widersprochen.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(2)</p>
                  <p>Verbraucher im Sinne der nachstehenden Regelungen ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden kann. Unternehmer ist jede natürliche oder juristische Person oder eine rechtsfähige Personengesellschaft, die bei Abschluss eines Rechtsgeschäfts in Ausübung ihrer selbständigen beruflichen oder gewerblichen Tätigkeit handelt.</p>
                </div>
              </div>

              {/* § 2 Zustandekommen des Vertrages */}
              <div className="terms-section">
                <h3>§ 2 Zustandekommen des Vertrages</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">(1)</p>
                  <p>Gegenstand des Vertrages ist der Verkauf von Waren und/ oder die Erbringung von Reparaturleistungen.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(2)</p>
                  <p>Bereits mit dem Einstellen des jeweiligen Produkts auf unserer Internetseite unterbreiten wir Ihnen ein verbindliches Angebot zum Abschluss eines Vertrages zu den in der Artikelbeschreibung angegebenen Bedingungen.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(3)</p>
                  <p>Der Vertrag kommt über das Online-Warenkorbsystem wie folgt zustande:</p>
                  <p>Die zum Kauf beabsichtigten Waren und/ oder Reparaturleistungen werden im "Warenkorb" abgelegt. Über die entsprechende Schaltfläche in der Navigationsleiste können Sie den "Warenkorb" aufrufen und dort jederzeit Änderungen vornehmen.</p>
                  <p>Nach Aufrufen der Seite "Kasse" und der Eingabe der persönlichen Daten sowie der Zahlungs- und Versandbedingungen werden abschließend nochmals alle Bestelldaten auf der Bestellübersichtsseite angezeigt.</p>
                  <p>Soweit Sie als Zahlungsart ein Sofortzahl-System nutzen, werden Sie entweder in unserem Online-Shop auf die Bestellübersichtsseite geführt oder Sie werden zunächst auf die Internetseite des Anbieters des Sofortzahl-Systems weitergeleitet.</p>
                  <p>Erfolgt die Weiterleitung zu dem jeweiligen Sofortzahl-System, nehmen Sie dort die entsprechende Auswahl bzw. Eingabe Ihrer Daten vor. Abschließend werden Sie zurück in unseren Online-Shop auf die Bestellübersichtsseite geleitet.</p>
                  <p>Vor Absenden der Bestellung haben Sie die Möglichkeit, hier sämtliche Angaben nochmals zu überprüfen, zu ändern (auch über die Funktion „zurück" des Internetbrowsers) bzw. den Kauf abzubrechen.</p>
                  <p>Mit dem Absenden der Bestellung über die Schaltfläche "zahlungspflichtig bestellen" erklären Sie rechtsverbindlich die Annahme des Angebotes, wodurch der Vertrag zustande kommt.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(4)</p>
                  <p>Ihre Anfragen zur Erstellung eines Angebotes sind für Sie unverbindlich. Wir unterbreiten Ihnen hierzu ein verbindliches Angebot in Textform (z.B. per E-Mail), welches Sie innerhalb von 5 Tagen annehmen können.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(5)</p>
                  <p>Die Abwicklung der Bestellung und Übermittlung aller im Zusammenhang mit dem Vertragsschluss erforderlichen Informationen erfolgt per E-Mail zum Teil automatisiert. Sie haben deshalb sicherzustellen, dass die von Ihnen bei uns hinterlegte E-Mail-Adresse zutreffend ist, der Empfang der E-Mails technisch sichergestellt und insbesondere nicht durch Spam-Filter verhindert wird.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(6)</p>
                  <p>Online Point GmbH ist ermächtigt, Unteraufträge zu erteilen.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(7)</p>
                  <p>Die geltenden Preise für die Arbeiten sind auf den Webseiten von Online Point GmbH und im Ladengeschäft einsehbar. Die Preise enthalten die jeweils geltende gesetzliche Umsatzsteuer.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(8)</p>
                  <p>Soweit Online Point GmbH den Fertigstellung infolge höherer Gewalt oder aufgrund von Betriebsstörungen ohne eigenes Verschulden nicht einhalten kann, besteht aufgrund deswegen entstehender Verzögerungen keine Verpflichtung zum Schadensersatz. Online Point GmbH verpflichtet sich den Kunden von solchen Verzögerungen unverzüglich in Kenntnis zu setzen.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(9)</p>
                  <p>Die Abnahme erfolgt durch Aushändigung an den jeweiligen Kunden, entweder per Versand oder Aushändigung im Ladengeschäft. Der Kunde ist verpflichtet, den Auftragsgegenstand innerhalb von 1 Woche ab Zugang der Fertigstellungsanzeige und Aushändigung oder Übersendung der Rechnung abzuholen. Im Falle der Nichtabnahme kann Online Point GmbH von seinen gesetzlichen Rechten Gebrauch machen. Bei Reparaturarbeiten, die innerhalb eines Arbeitstages ausgeführt werden, verkürzt sich die Frist auf 2 Arbeitstage. Bei Abnahmeverzug kann Online Point GmbH die ortsübliche Aufbewahrungsgebühr berechnen. Der Auftragsgegenstand kann nach Ermessen von Online Point GmbH auch anderweitig aufbewahrt werden.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(10)</p>
                  <p>Die Angebote von Online Point GmbH, insbesondere auf den von Online Point GmbH betriebenen Webseiten, haben maximal eine Gültigkeit von zwei Wochen.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(11)</p>
                  <p>Online Point GmbH behält sich das Recht vor, technische Abweichungen oder Änderungen von Beschreibungen sowie Angaben in Angeboten und Unterlagen, Leistungs-, Konstruktions- und Materialänderungen dem technischen Fortschritt anzupassen. Eine Garantie diesbezüglich erfolgt nicht. Kunden können aus dem hier unter 2.11. genannten Bereichen keine Rechte ableiten.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(12)</p>
                  <p>Bei allen Geräten die vom Hersteller als wasserdicht und staubgeschützt gekennzeichnet sind, übernimmt Online Point GmbH keine Garantie, dass nach dem Öffnen des Gerätes dieser Schutz noch weiterhin besteht. Kunden können aus dem hier unter 2.12. genannten Bereichen keine Rechte ableiten.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(13)</p>
                  <p>Ein Kunde ist verpflichtet über sämtliche relevanten Tatsachen zur Auftragsbearbeitung vor Buchung hinzuweisen. Vor jeder Reparatur wird das Gerät vollständig diagnostiziert. Sollten bei der Diagnose noch weitere Fehler oder Schäden an dem Gerät vorhanden sein, als die vom Kunden angegeben bzw. gebuchte Reparatur, sind wir verpflichtet mit dem Kunden Rücksprache zu halten und über das weitere Vorgehen abzustimmen. Sofern nur die gebuchte Reparatur gewünscht ist und der zusätzliche Fehler/Schaden unabhängig von der gebuchten Reparatur ist, kann die Reparatur durchgeführt werden. Ist der Fehler/Schaden aber in direkten Zusammenhang mit der gebuchten Reparatur und kann ohne diese zusätzliche Reparatur nicht durchgeführt werden und diese zusätzliche Reparatur wird abgelehnt, dann kann Online Point GmbH vom gebuchten Auftrag Abstand nehmen und diesen ablehnen. In dem Fall fällt eine Servicepauschale i.H.v. 14,95 Euro zugunsten von Online Point GmbH an.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(14)</p>
                  <p>Bei Reklamationen gilt: Sollte sich im Rahmen der Einsendung der Reklamation herausstellen, dass kein Grund zur Reklamation vorliegt, so fällt auch dann die Servicepauschale i.H.v. 14,95 € (vrgl. 2.13. dieser AGB). Diese Servicepauschale hat der Kunde vor Rückversand des Gerätes zu zahlen.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(15)</p>
                  <p>Online Point GmbH behält sich das Recht vor, bestimmte Reparaturaufträge abzulehnen. Hierzu zählen u.a. Geräte</p>
                  <ul className="terms-list">
                    <li>bei denen auf Grund Korrosion oder Abnutzungserscheinungen eine Reparatur nicht möglich ist, ohne Gefahr zu laufen, wesentliche Komponenten zu zerstören.</li>
                    <li>bei denen eine Reparatur die Nutzungszeit nicht verlängern würde.</li>
                    <li>bei denen die Preise für Ersatzteile zu hoch sind, als dass eine Reparatur wirtschaftlich wäre.</li>
                    <li>deren Preis auf der Website mit "auf Anfrage" versehen sind; dieser Status hängt mit der Verfügbarkeit der Ersatzteile auf dem Markt sowie damit verbundenen Preisschwankungen zusammen. Sollten Sie vermuten, dass Ihr Gerät den o.g. Kriterien entspricht, so setzen Sie sich bitte vor der Buchung mit unserem Serviceteam in Verbindung.</li>
                  </ul>
                </div>
              </div>

              {/* § 3 Leistungserbringung bei Reparaturen */}
              <div className="terms-section">
                <h3>§ 3 Leistungserbringung bei Reparaturen</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">(1)</p>
                  <p>Soweit Reparaturleistungen Vertragsgegenstand sind, schulden wir die sich aus der Leistungsbeschreibung ergebenden Reparaturarbeiten. Diese erbringen wir nach bestem Wissen und Gewissen persönlich oder durch Dritte.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(2)</p>
                  <p>Sie sind zur Mitwirkung verpflichtet, insbesondere haben Sie den am Gerät bestehenden Defekt so umfassend als möglich zu beschreiben und das defekte Gerät zur Verfügung zu stellen.</p>
                </div>
              </div>

              {/* § 4 Besondere Vereinbarungen zu angebotenen Zahlungsarten */}
              <div className="terms-section">
                <h3>§ 4 Besondere Vereinbarungen zu angebotenen Zahlungsarten</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">(1)</p>
                  <p><strong>SEPA-Lastschrift (Basis- und/ oder Firmenlastschrift)</strong></p>
                  <p>Bei Zahlung per SEPA-Basislastschrift oder per SEPA-Firmenlastschrift ermächtigen Sie uns durch Erteilung eines entsprechenden SEPA-Mandats, den Rechnungsbetrag vom angegebenen Konto einzuziehen.</p>
                  <p>Der Einzug der Lastschrift erfolgt bei Lieferung der Ware in Deutschland innerhalb von 10 Tagen, bei Auslandslieferungen innerhalb von 10 Tagen nach Vertragsschluss.</p>
                  <p>Die Frist für die Übermittlung der Vorabankündigung (Pre-Notification) wird auf 5 Tage vor dem Fälligkeitsdatum verkürzt. Sie sind verpflichtet für die ausreichende Deckung des Kontos zum Fälligkeitsdatum zu sorgen. Im Falle einer Rücklastschrift aufgrund Ihres Verschuldens haben Sie die anfallende Bankgebühr zu tragen.</p>
                </div>
              </div>

              {/* § 5 Zurückbehaltungsrecht, Eigentumsvorbehalt */}
              <div className="terms-section">
                <h3>§ 5 Zurückbehaltungsrecht, Eigentumsvorbehalt</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">(1)</p>
                  <p>Ein Zurückbehaltungsrecht können Sie nur ausüben, soweit es sich um Forderungen aus demselben Vertragsverhältnis handelt.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(2)</p>
                  <p>Die Ware bleibt bis zur vollständigen Zahlung des Kaufpreises unser Eigentum.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(3)</p>
                  <p>Sind Sie Unternehmer, gilt ergänzend Folgendes:</p>
                  
                  <div className="sub-paragraph">
                    <p><strong>a)</strong> Wir behalten uns das Eigentum an der Ware bis zum vollständigen Ausgleich aller Forderungen aus der laufenden Geschäftsbeziehung vor. Vor Übergang des Eigentums an der Vorbehaltsware ist eine Verpfändung oder Sicherheitsübereignung nicht zulässig.</p>
                    
                    <p><strong>b)</strong> Sie können die Ware im ordentlichen Geschäftsgang weiterverkaufen. Für diesen Fall treten Sie bereits jetzt alle Forderungen in Höhe des Rechnungsbetrages, die Ihnen aus dem Weiterverkauf erwachsen, an uns ab, wir nehmen die Abtretung an. Sie sind weiter zur Einziehung der Forderung ermächtigt. Soweit Sie Ihren Zahlungsverpflichtungen nicht ordnungsgemäß nachkommen, behalten wir uns allerdings vor, die Forderung selbst einzuziehen.</p>
                    
                    <p><strong>c)</strong> Bei Verbindung und Vermischung der Vorbehaltsware erwerben wir Miteigentum an der neuen Sache im Verhältnis des Rechnungswertes der Vorbehaltsware zu den anderen verarbeiteten Gegenständen zum Zeitpunkt der Verarbeitung.</p>
                    
                    <p><strong>d)</strong> Wir verpflichten uns, die uns zustehenden Sicherheiten auf Ihr Verlangen insoweit freizugeben, als der realisierbare Wert unserer Sicherheiten die zu sichernde Forderung um mehr als 10% übersteigt. Die Auswahl der freizugebenden Sicherheiten obliegt uns.</p>
                  </div>
                </div>
              </div>

              {/* § 6 Gewährleistung */}
              <div className="terms-section">
                <h3>§ 6 Gewährleistung</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">(1)</p>
                  <p>Es bestehen die gesetzlichen Mängelhaftungsrechte.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(2)</p>
                  <p>Als Verbraucher werden Sie gebeten, die Sache bei Lieferung umgehend auf Vollständigkeit, offensichtliche Mängel und Transportschäden zu überprüfen und uns sowie dem Spediteur Beanstandungen schnellstmöglich mitzuteilen. Kommen Sie dem nicht nach, hat dies keine Auswirkung auf Ihre gesetzlichen Gewährleistungsansprüche.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(3)</p>
                  <p>Soweit Sie Unternehmer sind, gilt abweichend von den vorstehenden Gewährleistungsregelungen:</p>
                  
                  <div className="sub-paragraph">
                    <p><strong>a)</strong> Als Beschaffenheit der Sache gelten nur unsere eigenen Angaben und die Produktbeschreibung des Herstellers als vereinbart, nicht jedoch sonstige Werbung, öffentliche Anpreisungen und Äußerungen des Herstellers.</p>
                    
                    <p><strong>b)</strong> Bei Mängeln leisten wir nach unserer Wahl Gewähr durch Nachbesserung oder Nachlieferung. Schlägt die Mangelbeseitigung fehl, können Sie nach Ihrer Wahl Minderung verlangen oder vom Vertrag zurücktreten. Die Mängelbeseitigung gilt nach erfolglosem zweiten Versuch als fehlgeschlagen, wenn sich nicht insbesondere aus der Art der Sache oder des Mangels oder den sonstigen Umständen etwas anderes ergibt. Im Falle der Nachbesserung müssen wir nicht die erhöhten Kosten tragen, die durch die Verbringung der Ware an einen anderen Ort als den Erfüllungsort entstehen, sofern die Verbringung nicht dem bestimmungsgemäßen Gebrauch der Ware entspricht.</p>
                    
                    <p><strong>c)</strong> Die Gewährleistungsfrist beträgt ein Jahr ab Ablieferung der Ware. Ausnahme gilt beim Akkutausch, hier beträgt die Gewährleistungsfrist 6 Monate. Die Fristverkürzung gilt nicht:</p>
                    <ul className="terms-list">
                      <li>für uns zurechenbare schuldhaft verursachte Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit und bei vorsätzlich oder grob fahrlässig verursachten sonstigen Schäden;</li>
                      <li>soweit wir den Mangel arglistig verschwiegen oder eine Garantie für die Beschaffenheit der Sache übernommen haben;</li>
                      <li>bei Sachen, die entsprechend ihrer üblichen Verwendungsweise für ein Bauwerk verwendet worden sind und dessen Mangelhaftigkeit verursacht haben;</li>
                      <li>bei gesetzlichen Rückgriffsansprüchen, die Sie im Zusammenhang mit Mängelrechten gegen uns haben.</li>
                    </ul>
                  </div>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(4)</p>
                  <p>Nach Inanspruchnahme der Gewährleistung (Anmeldung einer Reklamation) muss das Gerät binnen 14 Tagen ab Ausstellungszeitpunkt des Retourentickets eingesendet werden, ansonsten muss der Anspruch erneut angemeldet werden.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(5)</p>
                  <p>Geräte, bei denen während der Reparatur Schäden durch Flüssigkeit festgestellt worden, sind grundsätzlich von Garantie und Gewährleistung ausgeschlossen; sollten derlei Schäden festgestellt werden, informiert unser Service Sie vorab.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(6)</p>
                  <p>Online Point GmbH übernimmt keine Haftung beim Verlust von OVP, Ladekabeln, Cases oder sonstigem Zubehör, das dem Auftrag beigelegt und mit eingesendet wurde. Senden Sie daher bitte ausschließlich die für die Reparatur bestimmten Geräte ein, ohne Zusatzmaterial. Ausnahmen bilden Laptop-Reparaturen, bei denen wir in der Regel die Ladekabel benötigen. Senden Sie benötigtes Zubehör bitte nur auf ausdrückliche Aufforderung mit ein. Bei Fragen diesbezüglich, kontaktieren Sie bitte unseren Service.</p>
                </div>
              </div>

              {/* § 7 Rechtswahl, Erfüllungsort, Gerichtsstand */}
              <div className="terms-section">
                <h3>§ 7 Rechtswahl, Erfüllungsort, Gerichtsstand</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">(1)</p>
                  <p>Es gilt deutsches Recht. Bei Verbrauchern gilt diese Rechtswahl nur, soweit hierdurch der durch zwingende Bestimmungen des Rechts des Staates des gewöhnlichen Aufenthaltes des Verbrauchers gewährte Schutz nicht entzogen wird (Günstigkeitsprinzip).</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(2)</p>
                  <p>Erfüllungsort für alle Leistungen aus den mit uns bestehenden Geschäftsbeziehungen sowie Gerichtsstand ist unser Sitz, soweit Sie nicht Verbraucher, sondern Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen sind. Dasselbe gilt, wenn Sie keinen allgemeinen Gerichtsstand in Deutschland oder der EU haben oder der Wohnsitz oder gewöhnliche Aufenthalt im Zeitpunkt der Klageerhebung nicht bekannt ist. Die Befugnis, auch das Gericht an einem anderen gesetzlichen Gerichtsstand anzurufen, bleibt hiervon unberührt.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">(3)</p>
                  <p>Die Bestimmungen des UN-Kaufrechts finden ausdrücklich keine Anwendung.</p>
                </div>
              </div>
            </section>

            {/* II. Kundeninformationen */}
            <section className="terms-part">
              <h2 className="part-title">II. Kundeninformationen</h2>

              {/* 1. Identität des Verkäufers */}
              <div className="terms-section">
                <h3>1. Identität des Verkäufers</h3>
                
                <div className="contact-info">
                  <p><strong>Online Point GmbH</strong><br />
                  Kurfürstenstr. 106<br />
                  10787 Berlin<br />
                  Deutschland</p>
                  
                  <p><strong>Telefon:</strong> 030 403688950<br />
                  <strong>E-Mail:</strong> kontakt@onlinepoint-gmbh.de</p>
                </div>

                <div className="info-box">
                  <h4>Alternative Streitbeilegung:</h4>
                  <p>Alternative Streitbeilegung gemäß Art. 14 Abs. 1 ODR-VO und § 36 VSBG: Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit, die Sie unter <a href="http://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">http://ec.europa.eu/consumers/odr/</a> finden. Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle sind wir nicht verpflichtet und nicht bereit.</p>
                </div>
              </div>

              {/* 2. Informationen zum Zustandekommen des Vertrages */}
              <div className="terms-section">
                <h3>2. Informationen zum Zustandekommen des Vertrages</h3>
                <p>Die technischen Schritte zum Vertragsschluss, der Vertragsschluss selbst und die Korrekturmöglichkeiten erfolgen nach Maßgabe der Regelungen "Zustandekommen des Vertrages" unserer Allgemeinen Geschäftsbedingungen (Teil I.).</p>
              </div>

              {/* 3. Vertragssprache, Vertragstextspeicherung */}
              <div className="terms-section">
                <h3>3. Vertragssprache, Vertragstextspeicherung</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">3.1.</p>
                  <p>Vertragssprache ist deutsch.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">3.2.</p>
                  <p>Der vollständige Vertragstext wird von uns nicht gespeichert. Vor Absenden der Bestellung über das Online - Warenkorbsystem können die Vertragsdaten über die Druckfunktion des Browsers ausgedruckt oder elektronisch gesichert werden. Nach Zugang der Bestellung bei uns werden die Bestelldaten, die gesetzlich vorgeschriebenen Informationen bei Fernabsatzverträgen und die Allgemeinen Geschäftsbedingungen nochmals per E-Mail an Sie übersandt.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">3.3.</p>
                  <p>Bei Angebotsanfragen außerhalb des Online-Warenkorbsystems erhalten Sie alle Vertragsdaten im Rahmen eines verbindlichen Angebotes in Textform übersandt, z.B. per E-Mail, welche Sie ausdrucken oder elektronisch sichern können.</p>
                </div>
              </div>

              {/* 4. Wesentliche Merkmale der Ware oder Dienstleistung */}
              <div className="terms-section">
                <h3>4. Wesentliche Merkmale der Ware oder Dienstleistung</h3>
                <p>Die wesentlichen Merkmale der Ware und/oder Dienstleistung finden sich im jeweiligen Angebot. Auf schriftlichen Wunsch vor Einreichung des Gerätes bei uns in der Service-Werkstatt, können wir Ihr ausgebautes defektes Bauteil gern an Sie nach der Reparatur mit zurücksenden (Ausnahme defekte Akkus/Batterien).</p>
              </div>

              {/* 5. Preise und Zahlungsmodalitäten */}
              <div className="terms-section">
                <h3>5. Preise und Zahlungsmodalitäten</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">5.1.</p>
                  <p>Die in den jeweiligen Angeboten angeführten Preise sowie die Versandkosten stellen Gesamtpreise dar. Sie beinhalten alle Preisbestandteile einschließlich aller anfallenden Steuern.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">5.2.</p>
                  <p>Die anfallenden Versandkosten sind nicht im Kaufpreis enthalten. Sie sind über eine entsprechend bezeichnete Schaltfläche auf unserer Internetpräsenz oder im jeweiligen Angebot aufrufbar, werden im Laufe des Bestellvorganges gesondert ausgewiesen und sind von Ihnen zusätzlich zu tragen, soweit nicht die versandkostenfreie Lieferung zugesagt ist.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">5.3.</p>
                  <p>Erfolgt die Lieferung in Länder außerhalb der Europäischen Union können von uns nicht zu vertretende weitere Kosten anfallen, wie z.B. Zölle, Steuern oder Geldübermittlungsgebühren (Überweisungs- oder Wechselkursgebühren der Kreditinstitute), die von Ihnen zu tragen sind. Entstandene Kosten der Geldübermittlung sind von Ihnen auch in den Fällen zu tragen, in denen die Lieferung in einen EU-Mitgliedsstaat erfolgt, die Zahlung aber außerhalb der Europäischen Union veranlasst wurde.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">5.4.</p>
                  <p>Die Ihnen zur Verfügung stehenden Zahlungsarten sind unter einer entsprechend bezeichneten Schaltfläche auf unserer Internetpräsenz oder im jeweiligen Angebot ausgewiesen.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">5.5.</p>
                  <p>Soweit bei den einzelnen Zahlungsarten nicht anders angegeben, sind die Zahlungsansprüche aus dem geschlossenen Vertrag sofort zur Zahlung fällig.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">5.6.</p>
                  <p>Online Point GmbH überprüft Geräte vor der Reparatur. Wenn eine Reparatur nach einer Prüfung abgelehnt wird oder das Gerät unrepariert wieder an Kunden zurückgeschickt werden soll, so muss Online Point GmbH die Kosten in Höhe von 49,90 € (Smartphone + Smartwatches), 69,90 € (Tablet + E-Scooter) und 79,90 € (Notebook) für die Diagnose in Rechnung stellen. Wenn Kunden die Diagnose als Leistung gebucht haben und eine Reparatur im Anschluss gewünscht ist, so wird diese verrechnet. Für Kunden gilt: Bitte achten Sie auch immer darauf, dass Sie das richtige Gerät ausgewählt haben. Sollte ein anderes Modell als gebucht eingesendet werden und dann keine Reparatur stattfinden, so wird auch in diesem Fall die Diagnose bzw. Bearbeitungsgebühr in Rechnung gestellt.</p>
                </div>
              </div>

              {/* 6. Lieferbedingungen */}
              <div className="terms-section">
                <h3>6. Lieferbedingungen</h3>
                
                <div className="paragraph">
                  <p className="paragraph-number">6.1.</p>
                  <p>Die Lieferbedingungen, der Liefertermin sowie gegebenenfalls bestehende Lieferbeschränkungen finden sich unter einer entsprechend bezeichneten Schaltfläche auf unserer Internetpräsenz oder im jeweiligen Angebot.</p>
                </div>

                <div className="paragraph">
                  <p className="paragraph-number">6.2.</p>
                  <p>Soweit Sie Verbraucher sind ist gesetzlich geregelt, dass die Gefahr des zufälligen Untergangs und der zufälligen Verschlechterung der verkauften Sache während der Versendung erst mit der Übergabe der Ware an Sie übergeht, unabhängig davon, ob die Versendung versichert oder unversichert erfolgt. Dies gilt nicht, wenn Sie eigenständig ein nicht vom Unternehmer benanntes Transportunternehmen oder eine sonst zur Ausführung der Versendung bestimmte Person beauftragt haben.</p>
                  <p>Sind Sie Unternehmer, erfolgt die Lieferung und Versendung auf Ihre Gefahr.</p>
                </div>
              </div>

              {/* 7. Gesetzliches Mängelhaftungsrecht */}
              <div className="terms-section">
                <h3>7. Gesetzliches Mängelhaftungsrecht</h3>
                <p>Die Mängelhaftung richtet sich nach der Regelung "Gewährleistung" in unseren Allgemeinen Geschäftsbedingungen (Teil I).</p>
              </div>

              {/* Footer Note */}
              <div className="terms-footer">
                <p>Diese AGB und Kundeninformationen wurden von den auf IT-Recht spezialisierten Juristen des Händlerbundes erstellt und werden permanent auf Rechtskonformität geprüft. Die Händlerbund Management AG garantiert für die Rechtssicherheit der Texte und haftet im Falle von Abmahnungen. Nähere Informationen dazu finden Sie unter: <a href="https://www.haendlerbund.de/agb-service" target="_blank" rel="noopener noreferrer">https://www.haendlerbund.de/agb-service</a>.</p>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </>
  );
}
