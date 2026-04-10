import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { useTranslation } from 'react-i18next';
import './Terms.css';

export function Terms() {
  const { i18n } = useTranslation();
  const isGerman = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase().startsWith('de');

  if (!isGerman) {
    return (
      <>
        <TopBar />
        <McRepairNav />

        <div className="terms-page">
          <div className="container">
            <div className="terms-content">
              <header className="terms-header">
                <h1>Terms and Customer Information</h1>
                <p className="terms-subtitle">General terms, payment and delivery information for repair and webshop orders</p>
              </header>

              <section className="terms-part">
                <h2 className="part-title">I. General Terms and Conditions</h2>

                <div className="terms-section">
                  <h3>Section 1 Basic Provisions</h3>
                  <div className="paragraph">
                    <p className="paragraph-number">(1)</p>
                    <p>
                      The following terms and conditions apply to all contracts concluded with us as provider
                      (Online Point GmbH) via the website www.mcrepair.de. Unless otherwise agreed, we object to
                      the inclusion of your own terms and conditions.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(2)</p>
                    <p>
                      A consumer is any natural person who concludes a legal transaction for purposes that are
                      predominantly outside their trade, business or profession. An entrepreneur is any natural or
                      legal person or partnership with legal capacity acting in the exercise of their independent
                      professional or commercial activity.
                    </p>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>Section 2 Contract Formation</h3>

                  <div className="paragraph">
                    <p className="paragraph-number">(1)</p>
                    <p>
                      The subject matter of the contract is the sale of goods and/or the provision of repair
                      services.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(2)</p>
                    <p>
                      By listing a product or service on our website, we already submit a binding offer to conclude
                      a contract under the conditions stated in the respective description.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(3)</p>
                    <p>
                      The contract is concluded via the online cart system. Products and/or repair services intended
                      for purchase are placed in the cart. You can access the cart at any time via the corresponding
                      button in the navigation and make changes.
                    </p>
                    <p>
                      After opening the checkout page and entering your personal data as well as payment and shipping
                      terms, all order data is displayed again on the order overview page.
                    </p>
                    <p>
                      If you use an instant payment system, you are either directed to the order overview page in
                      our shop first or redirected to the payment provider. After completing payment there, you are
                      redirected back to our order overview page.
                    </p>
                    <p>
                      Before submitting the order, you can review all details again, change them (including browser
                      back function), or cancel the purchase.
                    </p>
                    <p>
                      By submitting the order via the final order button, you legally accept our offer and the
                      contract is concluded.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(4)</p>
                    <p>
                      Requests for quotation submitted by you are non-binding. We may provide a binding offer in
                      text form (for example by email), which can be accepted within 5 days.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(5)</p>
                    <p>
                      Order processing and transmission of information required for contract conclusion takes place by
                      email, partly automated. You must ensure that the email address stored with us is correct and
                      that receipt of our emails is technically possible and not blocked by spam filters.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(6)</p>
                    <p>Online Point GmbH is authorized to assign subcontractors.</p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(7)</p>
                    <p>
                      Current prices for services are available on Online Point GmbH websites and in-store. Prices
                      include statutory VAT applicable at the time.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(8)</p>
                    <p>
                      If completion deadlines cannot be met due to force majeure or operational disruptions without
                      fault of Online Point GmbH, delays do not create claims for damages. We will inform customers
                      of such delays without undue delay.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(9)</p>
                    <p>
                      Acceptance takes place by handover to the customer, either by shipping or handover in-store.
                      The customer must collect the contract item within one week after completion notice and invoice
                      dispatch/handover. For one-day repairs, this period is reduced to two working days.
                    </p>
                    <p>
                      In case of delay in acceptance, we may exercise statutory rights and charge customary storage
                      fees. At our discretion, the item may also be stored elsewhere.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(10)</p>
                    <p>
                      Offers made by Online Point GmbH, especially on websites operated by us, are valid for a
                      maximum of two weeks.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(11)</p>
                    <p>
                      We reserve the right to make technical deviations and amendments to descriptions, offers,
                      documents, performance specifications, design and material details due to technical progress.
                      No guarantee is assumed for such changes.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(12)</p>
                    <p>
                      For devices designated by the manufacturer as water- and dust-resistant, Online Point GmbH
                      does not guarantee that such protection remains intact after opening the device.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(13)</p>
                    <p>
                      Customers must disclose all relevant facts for order processing before booking. Each device is
                      fully diagnosed before repair. If additional defects are identified beyond the booked repair,
                      we coordinate further action with the customer.
                    </p>
                    <p>
                      If the additional defect is directly related to the booked repair and additional repair is
                      declined, Online Point GmbH may reject the booked order. In this case, a service fee of
                      EUR 14.95 is charged.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(14)</p>
                    <p>
                      In complaints/warranty returns, if no valid reason for complaint is found after inspection,
                      the service fee of EUR 14.95 applies as well. This fee must be paid before return shipment.
                    </p>
                  </div>

                  <div className="paragraph">
                    <p className="paragraph-number">(15)</p>
                    <p>Online Point GmbH reserves the right to refuse specific repair orders, including devices:</p>
                    <ul className="terms-list">
                      <li>with corrosion/wear where repair risks destroying essential components;</li>
                      <li>where repair would not extend usable life;</li>
                      <li>where spare parts costs make repair economically unreasonable;</li>
                      <li>
                        marked as "on request" due to parts availability and market price fluctuations.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>Section 3 Repair Services</h3>
                  <div className="paragraph">
                    <p className="paragraph-number">(1)</p>
                    <p>
                      Where repair services are part of the contract, we owe the repair work resulting from the
                      service description. We provide these services to the best of our knowledge either ourselves
                      or through third parties.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(2)</p>
                    <p>
                      You are obliged to cooperate, especially by describing the existing device defect as fully as
                      possible and by making the defective device available.
                    </p>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>Section 4 Payment Methods</h3>
                  <div className="paragraph">
                    <p className="paragraph-number">(1)</p>
                    <p>
                      <strong>SEPA direct debit (core and/or business direct debit)</strong>
                    </p>
                    <p>
                      By granting a SEPA mandate, you authorize us to collect invoice amounts from the indicated
                      account.
                    </p>
                    <p>
                      Collection takes place within 10 days for deliveries in Germany and within 10 days after
                      contract conclusion for international deliveries.
                    </p>
                    <p>
                      The pre-notification period is reduced to 5 days before due date. You must ensure sufficient
                      account funds on due date. In case of chargeback due to your fault, applicable bank fees are
                      to be borne by you.
                    </p>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>Section 5 Retention of Title</h3>
                  <div className="paragraph">
                    <p className="paragraph-number">(1)</p>
                    <p>
                      You may only exercise a right of retention if it concerns claims from the same contractual
                      relationship.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(2)</p>
                    <p>Goods remain our property until the purchase price has been paid in full.</p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(3)</p>
                    <p>If you are an entrepreneur, the following also applies:</p>
                    <div className="sub-paragraph">
                      <p><strong>a)</strong> We retain title until all claims from the ongoing business relationship have been fully settled.</p>
                      <p><strong>b)</strong> You may resell goods in the ordinary course of business; claims from resale are assigned to us in advance in the amount of the invoice value.</p>
                      <p><strong>c)</strong> In case of combination/mixing, we acquire co-ownership of the new item proportional to invoice values at the time of processing.</p>
                      <p><strong>d)</strong> At your request, we release securities insofar as their realizable value exceeds secured claims by more than 10%.</p>
                    </div>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>Section 6 Warranty</h3>
                  <div className="paragraph">
                    <p className="paragraph-number">(1)</p>
                    <p>Statutory defect liability rights apply.</p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(2)</p>
                    <p>
                      Consumers are requested to check goods immediately upon delivery for completeness, visible
                      defects and transport damage and to notify us and the carrier as quickly as possible.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(3)</p>
                    <p>
                      If you are an entrepreneur, deviating warranty provisions may apply, including shortened
                      warranty periods where legally permissible.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(4)</p>
                    <p>
                      After asserting warranty rights (complaint registration), the device must be sent in within
                      14 days of return label issue. Otherwise, the claim must be registered again.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(5)</p>
                    <p>
                      Devices where liquid damage is detected during repair are generally excluded from warranty
                      and guarantee. Our service team informs you before further processing.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(6)</p>
                    <p>
                      Online Point GmbH assumes no liability for loss of packaging, charging cables, cases or other
                      accessories enclosed with the order. Please send only the device to be repaired, unless our
                      service explicitly requests accessories.
                    </p>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>Section 7 Applicable Law and Jurisdiction</h3>
                  <div className="paragraph">
                    <p className="paragraph-number">(1)</p>
                    <p>
                      German law applies. For consumers, this choice of law applies only insofar as mandatory
                      protections of the consumer's habitual residence are not withdrawn.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(2)</p>
                    <p>
                      Place of performance and jurisdiction for entrepreneurs, legal entities under public law, and
                      special funds under public law is our registered office, where legally permissible.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">(3)</p>
                    <p>The provisions of the UN Convention on Contracts for the International Sale of Goods do not apply.</p>
                  </div>
                </div>
              </section>

              <section className="terms-part">
                <h2 className="part-title">II. Customer Information</h2>

                <div className="terms-section">
                  <h3>1. Seller Identity</h3>
                  <div className="contact-info">
                    <p>
                      <strong>Online Point GmbH</strong>
                      <br />
                      Kurfuerstenstr. 106
                      <br />
                      10787 Berlin
                      <br />
                      Germany
                    </p>
                    <p>
                      <strong>Phone:</strong> 030 403688950
                      <br />
                      <strong>Email:</strong> kontakt@onlinepoint-gmbh.de
                    </p>
                  </div>

                  <div className="info-box">
                    <h4>Alternative dispute resolution</h4>
                    <p>
                      The EU Commission provides an online dispute resolution platform at{' '}
                      <a href="http://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
                        http://ec.europa.eu/consumers/odr/
                      </a>
                      . We are not obliged and not willing to participate in consumer arbitration proceedings.
                    </p>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>2. Contract Process</h3>
                  <p>
                    The technical steps for contract conclusion, the conclusion itself and correction options are
                    governed by the provisions under "Section 2 Contract Formation" in Part I of these terms.
                  </p>
                </div>

                <div className="terms-section">
                  <h3>3. Contract Language and Storage</h3>
                  <div className="paragraph">
                    <p className="paragraph-number">3.1.</p>
                    <p>Contract language is German.</p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">3.2.</p>
                    <p>
                      We do not store the complete contract text in a way directly retrievable by you. Before
                      submitting an order, contract data can be printed or saved electronically using browser
                      functions. After we receive your order, order data, legally required distance-selling
                      information and these terms are sent again by email.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">3.3.</p>
                    <p>
                      For offer requests outside the online cart system, all contract data is provided in text form
                      as part of a binding offer (for example by email), which you can print or save electronically.
                    </p>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>4. Main Characteristics of Services and Goods</h3>
                  <p>
                    Essential characteristics of goods and/or services are contained in the respective offer.
                    Upon written request before submitting a device to our workshop, removed defective components
                    can be returned to you after repair (except defective batteries/accumulators).
                  </p>
                </div>

                <div className="terms-section">
                  <h3>5. Prices and Payment Terms</h3>
                  <div className="paragraph">
                    <p className="paragraph-number">5.1.</p>
                    <p>
                      Prices shown in respective offers and shipping costs are total prices and include all price
                      components including applicable taxes.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">5.2.</p>
                    <p>
                      Shipping costs are not included in the purchase price unless free shipping is expressly
                      granted. They are displayed separately during checkout.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">5.3.</p>
                    <p>
                      For deliveries outside the EU, additional costs not attributable to us may arise (for example
                      customs duties, taxes, transfer fees), which are borne by you.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">5.4.</p>
                    <p>Available payment methods are displayed in our online presence and in the respective offer.</p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">5.5.</p>
                    <p>Unless otherwise stated for specific payment methods, payment is due immediately.</p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">5.6.</p>
                    <p>
                      Devices are inspected before repair. If a repair is rejected after inspection or a device is
                      returned unrepaired, diagnostic fees may apply depending on device category. If diagnostics
                      were booked and repair follows, fees may be offset according to booking conditions.
                    </p>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>6. Delivery Conditions</h3>
                  <div className="paragraph">
                    <p className="paragraph-number">6.1.</p>
                    <p>
                      Delivery conditions, delivery dates and any delivery restrictions are shown in our online
                      presence and in the respective offer.
                    </p>
                  </div>
                  <div className="paragraph">
                    <p className="paragraph-number">6.2.</p>
                    <p>
                      For consumers, risk of accidental loss and deterioration passes upon handover of goods,
                      irrespective of insured or uninsured shipment, unless you commissioned a carrier not named by
                      us. For entrepreneurs, delivery and shipment are at your risk.
                    </p>
                  </div>
                </div>

                <div className="terms-section">
                  <h3>7. Statutory Defect Liability</h3>
                  <p>
                    Defect liability is governed by the "Section 6 Warranty" provisions in Part I of these terms.
                  </p>
                </div>

                <div className="terms-footer">
                  <p>
                    For legal certainty and the currently binding wording, the German version of these terms is
                    authoritative. If you need a complete English text version for your records, please contact
                    us at{' '}
                    <a href="mailto:kontakt@onlinepoint-gmbh.de">kontakt@onlinepoint-gmbh.de</a>.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>

        <Footer />
      </>
    );
  }

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
