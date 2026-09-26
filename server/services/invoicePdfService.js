const crypto = require('crypto');
const PDFDocument = require('pdfkit');

// 'qrcode' wird erst bei Bedarf geladen: fehlt das Modul (z.B. unvollstaendige
// Installation), wird der Beleg ohne QR-Code erzeugt statt gar nicht.
let qrCodeModule;
const loadQrCode = () => {
  if (qrCodeModule !== undefined) return qrCodeModule;
  try {
    // eslint-disable-next-line global-require
    qrCodeModule = require('qrcode');
  } catch (error) {
    console.warn('InvoicePdfService: Modul "qrcode" nicht verfuegbar - Beleg ohne QR-Code:', error.message);
    qrCodeModule = null;
  }
  return qrCodeModule;
};

// Pflichtangaben der Fusszeile (verbindlicher Wortlaut, siehe Abnahme).
const COMPANY = {
  name: 'Online Point GmbH',
  street: 'Kurfürstenstraße 106',
  city: '10787 Berlin',
  phone: '030 403 688 951',
  email: 'kontakt@onlinepoint-gmbh.de',
  bank: 'Commerzbank AG',
  iban: 'DE95100400000501905400',
  bic: 'COBADEFFXXX',
  court: 'Amtsgericht Charlottenburg',
  register: 'HRB 136735 B',
  managingDirector: 'Julian Szymansky',
  vatId: 'DE318981969'
};

// Verbindlicher Bewertungstext (ein Satzpaar, nur umbrochen, nicht umformuliert).
const REVIEW_TEXT = 'Wenn Sie mit der Reparatur zufrieden waren, bewerten Sie uns gern. Wir freuen uns auf Ihr Feedback!';

const BLUE = '#1a2a5e';
const LINE = '#aeb7c5';
const LIGHT = '#f5f7fa';
const TOTAL = '#edf5fc';

// Deutsche Bezeichnung der Zahlart - nie der rohe Enum-Wert.
const PAYMENT_METHOD_LABELS = {
  credit_card: 'Kreditkarte',
  card: 'Kreditkarte',
  debit_card: 'Debitkarte',
  stripe: 'Kreditkarte (Stripe)',
  paypal: 'PayPal',
  sepa: 'SEPA-Lastschrift',
  bank_transfer: 'Überweisung',
  invoice: 'Rechnung (Überweisung)',
  cash: 'Bar',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay'
};
const paymentMethodLabel = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  return PAYMENT_METHOD_LABELS[key] || '';
};

const CORRECTION_LABELS = {
  full_cancellation: 'Storno (vollständige Gutschrift)',
  price_adjustment: 'Preiskorrektur (Wertminderung)',
  partial_refund: 'Erstattung einer Überzahlung'
};

const text = (value, fallback = '-') => String(value ?? '').trim() || fallback;
const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const date = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';
};
const sameDay = (a, b) => date(a) === date(b) && date(a) !== '-';

const getCustomerNumber = (invoice) => text(invoice.customerId?.customerNumber, '-');
const refNumber = (value) => (value && typeof value === 'object' ? value.orderNumber || value.bookingNumber || '' : '');

// Auftrags- und Buchungsbezug. Beide werden ausgewiesen, wenn vorhanden.
const getReferenceLine = (invoice) => {
  const parts = [];
  const orderNumbers = new Set();
  const mainOrder = refNumber(invoice.orderId);
  if (mainOrder) orderNumbers.add(mainOrder);
  (invoice.repairOrderIds || []).forEach((entry) => {
    const number = refNumber(entry);
    if (number) orderNumbers.add(number);
  });
  if (orderNumbers.size > 0) parts.push(`Auftrag: ${[...orderNumbers].join(', ')}`);
  const bookingNumber = refNumber(invoice.bookingId);
  if (bookingNumber) parts.push(`Buchung: ${bookingNumber}`);
  return parts.join(' · ');
};

// Nummer der Ursprungsrechnung einer Gutschrift: bevorzugt der eingefrorene Snapshot,
// sonst das populierte Dokument.
const getOriginalInvoiceNumber = (invoice) => text(
  invoice.creditNoteOfNumber || invoice.creditNoteOf?.invoiceNumber,
  '-'
);

const getBillingAddress = (invoice) => {
  const customer = invoice.customerId && typeof invoice.customerId === 'object' ? invoice.customerId : {};
  const address = invoice.billingAddress?.street
    ? invoice.billingAddress
    : (customer.invoiceAddress?.street ? customer.invoiceAddress : customer.paymentAddress || {});
  const cityLine = [address.zip || address.zipCode || address.postalCode, address.city].filter(Boolean).join(' ');
  return [text(invoice.customerName, 'Kunde'), address.street, cityLine, address.country || customer.country || 'DE'].filter(Boolean);
};

const drawBoxTitle = (doc, x, y, width, title) => {
  doc.rect(x, y, width, 18).fillAndStroke(LIGHT, LINE);
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text(title, x + 7, y + 5, { width: width - 14 });
  doc.moveTo(x + 7, y + 21).lineTo(x + width - 7, y + 21).strokeColor('#d2d8e0').lineWidth(0.5).stroke();
};

// Fusszeile mit den verbindlichen Firmenangaben. Die USt-IdNr. der Fusszeile ist immer
// die des Unternehmens; eine abweichende Aussteller-ID (Reverse Charge) steht im Kopf.
const writeFooter = (doc) => {
  const y = 772;
  doc.moveTo(24, y).lineTo(571, y).strokeColor('#7f8a9c').lineWidth(1).stroke();
  doc.fillColor('#111111').font('Helvetica').fontSize(8);
  doc.text(`${COMPANY.name}\n${COMPANY.street}\n${COMPANY.city}\nTel. ${COMPANY.phone}\n${COMPANY.email}`, 24, y + 6, { width: 190, lineGap: 0.5 });
  doc.text(`${COMPANY.bank}\nIBAN ${COMPANY.iban}\nBIC ${COMPANY.bic}`, 230, y + 6, { width: 170, lineGap: 0.5 });
  doc.text(`${COMPANY.court}\n${COMPANY.register}\nGeschäftsführer ${COMPANY.managingDirector}\nUSt-IdNr. ${COMPANY.vatId}`, 414, y + 6, { width: 157, lineGap: 0.5 });
};

// Seitenaufbau der Positionstabelle. ALLE Positionen muessen gedruckt werden
// (§14 UStG, Spezifikation 4.2) - passen sie nicht auf eine Seite, laufen sie auf
// Folgeseiten weiter; die Summenbloecke stehen immer auf der letzten Seite.
const PAGE_CONTENT_BOTTOM = 754;      // darunter beginnt der Fusszeilenblock (y = 772)
const ROW_PITCH = 34;                 // Zeilenabstand einer Position (Name + 2 Zeilen Beschreibung)
const TABLE_HEADER_HEIGHT = 28;
const FIRST_ROW_OFFSET = 7;
const SUMMARY_BLOCK_HEIGHT = 316;     // Belegdetails + Zahlungsstand + Bewertung
const FIRST_PAGE_TABLE_TOP = 243;
const CONTINUATION_TABLE_TOP = 96;

const planItemPages = (itemCount) => {
  const pages = [];
  let startIndex = 0;
  let tableTop = FIRST_PAGE_TABLE_TOP;

  for (let guard = 0; guard <= itemCount + 2; guard += 1) {
    const remaining = itemCount - startIndex;
    const rowsTop = tableTop + TABLE_HEADER_HEIGHT + FIRST_ROW_OFFSET;
    const fitWithSummary = Math.floor((PAGE_CONTENT_BOTTOM - SUMMARY_BLOCK_HEIGHT - rowsTop) / ROW_PITCH);
    const fitFullPage = Math.floor((PAGE_CONTENT_BOTTOM - rowsTop) / ROW_PITCH);

    if (remaining <= Math.max(0, fitWithSummary)) {
      pages.push({ tableTop, startIndex, count: remaining, withSummary: true });
      return pages;
    }

    const take = Math.max(1, Math.min(remaining, fitFullPage));
    pages.push({ tableTop, startIndex, count: take, withSummary: false });
    startIndex += take;
    tableTop = CONTINUATION_TABLE_TOP;
  }

  // Sicherheitsnetz: darf nie erreicht werden, verhindert aber eine Endlosschleife.
  pages.push({ tableTop, startIndex, count: Math.max(0, itemCount - startIndex), withSummary: true });
  return pages;
};

const writeContinuationHeader = (doc, invoice, { left, right, pageWidth, isCreditNote }, pageNumber, totalPages) => {
  doc.fillColor('#111111').font('Helvetica').fontSize(8.5)
    .text(`${COMPANY.name}, ${COMPANY.street}, ${COMPANY.city}`, left, 18, { width: 390 });
  doc.fillColor('#f5b800').font('Helvetica-Bold').fontSize(16).text('McRepair.de', 470, 14, { width: 101, align: 'center' });
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(12)
    .text(`${isCreditNote ? 'Gutschrift' : 'Rechnung'} ${text(invoice.invoiceNumber)} - Fortsetzung`, left, 44, { width: pageWidth });
  doc.font('Helvetica').fontSize(9.5)
    .text(`Seite: ${pageNumber} von ${totalPages}`, left, 63)
    .text(date(invoice.createdAt), right - 80, 63, { width: 80, align: 'right' });
  doc.moveTo(left, 82).lineTo(right, 82).strokeColor('#c7ced8').lineWidth(0.6).stroke();
};

/**
 * Zeichnet den Beleg. Alle Werte kommen aus dem gespeicherten Beleg und seinem
 * issueSnapshot (Stand bei Rechnungsstellung) - NIE aus dem aktuellen Zahlungsstand,
 * damit das archivierte Dokument durch spaetere Zahlungen nicht "wandert".
 */
const renderInvoice = (doc, invoice, reviewQrCode) => {
  const left = 24;
  const right = 571;
  const pageWidth = right - left;
  const invoiceDate = date(invoice.createdAt);
  const isReverseCharge = Boolean(invoice.isReverseCharge);
  const reverseChargeNotice = text(invoice.reverseChargeNotice, 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge');
  const customerVatId = text(invoice.customerVatId || invoice.customerId?.vatId, '');
  const sellerVatId = text(invoice.sellerVatId, COMPANY.vatId);
  const snapshot = invoice.issueSnapshot || {};

  const isCreditNote = Boolean(invoice.isCreditNote);
  // Die gespeicherten Summen sind bereits brutto-first berechnet: der Rabatt steckt
  // in netTotal/taxTotal/grossTotal und darf hier NICHT erneut abgezogen werden.
  // Bei einer Gutschrift bleiben die Werte negativ.
  const netTotal = Number(invoice.invoiceNetTotal ?? invoice.subtotal ?? 0);
  const taxTotal = isReverseCharge ? 0 : Number(invoice.invoiceTaxTotal ?? invoice.tax ?? 0);
  const grossTotal = Number(invoice.invoiceGrossTotal ?? invoice.total ?? 0);
  const discount = Number(invoice.discount || 0);

  const storedRate = Number(invoice.taxRate);
  const derivedRate = netTotal !== 0 ? (taxTotal / netTotal) * 100 : 0;
  let taxRate;
  if (isReverseCharge) {
    taxRate = 0;
  } else if (!Number.isFinite(storedRate)) {
    taxRate = derivedRate;
  } else if (!isCreditNote && Math.abs((netTotal * storedRate) / 100 - taxTotal) > 0.01) {
    // Altdokument: der gespeicherte Satz passt nicht zu den gespeicherten Betraegen.
    taxRate = derivedRate;
  } else {
    taxRate = storedRate;
  }
  const formatRate = (rate) => `${Number(rate || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const itemPages = planItemPages(items.length);
  const totalPages = itemPages.length;

  doc.fillColor('#111111').font('Helvetica').fontSize(8.5)
    .text(`${COMPANY.name}, ${COMPANY.street}, ${COMPANY.city}`, left, 18, { width: 390 });
  doc.moveTo(left, 31).lineTo(448, 31).strokeColor('#d5d9df').lineWidth(0.5).stroke();

  doc.fillColor('#f5b800').font('Helvetica-Bold').fontSize(16).text('McRepair.de', 470, 20, { width: 101, align: 'center' });
  doc.fillColor(BLUE).font('Helvetica').fontSize(6.5).text('professionell | schnell | zuverlässig', 465, 10, { width: 110, align: 'center' });

  const addressLines = getBillingAddress(invoice);
  if (customerVatId) {
    addressLines.push(`USt-IdNr.: ${customerVatId}`);
  }

  doc.rect(left, 40, 225, 84).strokeColor('#c7ced8').lineWidth(0.7).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Rechnungsadresse', left + 7, 48);
  doc.moveTo(left + 7, 61).lineTo(242, 61).strokeColor('#d0d5dd').lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(10).text(addressLines.join('\n'), left + 7, 67, { lineGap: 1 });

  doc.font('Helvetica-Bold').fontSize(20).text(isCreditNote ? 'Gutschrift' : 'Rechnung', left, 139, { width: pageWidth, align: 'center' });
  doc.moveTo(left, 169).lineTo(right, 169).strokeColor('#7f8a9c').lineWidth(1.2).stroke();
  doc.font('Helvetica').fontSize(9.5).text(`Seite: 1 von ${totalPages}`, left, 174).text(invoiceDate, right - 80, 174, { width: 80, align: 'right' });

  const referenceLine = getReferenceLine(invoice);
  if (isCreditNote) {
    doc.text(`Gutschrift-Nr. ${text(invoice.invoiceNumber)} zu Rechnung ${getOriginalInvoiceNumber(invoice)}`, left, 193, { width: 330 });
  } else {
    doc.text(`Rechnungsnr. ${text(invoice.invoiceNumber)}`, left, 193, { width: 330 });
  }
  if (referenceLine) doc.text(referenceLine, right - 215, 193, { width: 215, align: 'right' });

  if (isReverseCharge) {
    doc.text(`Kundennummer: ${getCustomerNumber(invoice)} | USt-IdNr. Empfänger: ${customerVatId || '-'}`, left, 212);
    doc.text(`USt-IdNr. Aussteller: ${sellerVatId}`, right - 220, 212, { width: 220, align: 'right' });
  } else {
    doc.text(`Kundennummer: ${getCustomerNumber(invoice)}`, left, 212);
    if (customerVatId) {
      doc.text(`USt-IdNr. Kunde: ${customerVatId}`, right - 200, 212, { width: 200, align: 'right' });
    }
  }
  doc.moveTo(left, 229).lineTo(right, 229).strokeColor('#c7ced8').lineWidth(0.6).stroke();

  // Spalten: Pos. | Menge | Leistung (Name + Beschreibung inkl. Geraet/IMEI) | USt. | Einzel | Gesamt
  const columns = [left, 54, 113, 350, 400, 476, right];
  const headers = ['Pos.', 'Menge', 'Leistung', 'USt.', 'Einzel', 'Gesamt'];

  const drawItemsTable = (page) => {
    const tableTop = page.tableTop;
    const rowHeight = Math.max(37, page.count * ROW_PITCH);
    doc.rect(left, tableTop, pageWidth, TABLE_HEADER_HEIGHT).fillAndStroke('#f1f3f8', '#8793a7');
    headers.forEach((header, index) => {
      const align = index >= 4 ? 'right' : 'left';
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9)
        .text(header, columns[index] + 5, tableTop + 9, { width: columns[index + 1] - columns[index] - 10, align });
    });
    doc.rect(left, tableTop + TABLE_HEADER_HEIGHT, pageWidth, rowHeight).strokeColor('#8793a7').lineWidth(0.8).stroke();
    columns.slice(1, -1).forEach((x) => doc.moveTo(x, tableTop).lineTo(x, tableTop + TABLE_HEADER_HEIGHT + rowHeight)
      .strokeColor('#c6ccd5').lineWidth(0.5).stroke());

    let itemY = tableTop + TABLE_HEADER_HEIGHT + FIRST_ROW_OFFSET;
    for (let offset = 0; offset < page.count; offset += 1) {
      const index = page.startIndex + offset;
      const item = items[index];
      if (!item) break;
      const quantity = Number(item.quantity || 0);
      // Satz je Position aus der Position selbst, nicht aus einem global abgeleiteten Wert.
      const itemRate = isReverseCharge ? 0 : (Number.isFinite(Number(item.taxRate)) ? Number(item.taxRate) : taxRate);
      const name = text(item.serviceName || item.description);
      const description = String(item.description || '').trim();
      const nameWidth = columns[3] - columns[2] - 10;
      doc.fillColor('#111111').font('Helvetica').fontSize(8.8);
      doc.text(String(index + 1), columns[0] + 5, itemY);
      doc.text(`${quantity.toLocaleString('de-DE')} Stk`, columns[1] + 5, itemY);
      doc.font('Helvetica-Bold').text(name, columns[2] + 5, itemY, { width: nameWidth, height: 11, ellipsis: true });
      if (description && description !== name) {
        // Geraet mit IMEI/Seriennummer und ggf. Beschreibung der manuellen Position.
        doc.font('Helvetica').fontSize(7.2).fillColor('#374151')
          .text(description, columns[2] + 5, itemY + 11, { width: nameWidth, height: 18, ellipsis: true });
        doc.fillColor('#111111').fontSize(8.8);
      }
      doc.font('Helvetica').fontSize(8.8);
      doc.text(formatRate(itemRate), columns[3] + 5, itemY);
      doc.text(money(item.unitPrice), columns[4] + 5, itemY, { width: columns[5] - columns[4] - 10, align: 'right' });
      doc.text(money(item.total), columns[5] + 5, itemY, { width: columns[6] - columns[5] - 10, align: 'right' });
      itemY += ROW_PITCH;
    }

    return tableTop + TABLE_HEADER_HEIGHT + rowHeight;
  };

  let tableBottom = FIRST_PAGE_TABLE_TOP + TABLE_HEADER_HEIGHT + 37;
  itemPages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
      writeContinuationHeader(doc, invoice, { left, right, pageWidth, isCreditNote }, pageIndex + 1, totalPages);
    }
    if (page.count === 0 && pageIndex > 0) {
      // Reine Abschlussseite: keine leere Positionstabelle drucken, die Summenbloecke
      // beginnen direkt unter dem Fortsetzungskopf.
      tableBottom = page.tableTop - 17;
    } else {
      tableBottom = drawItemsTable(page);
    }
    // Jede Folgeseite bekommt ihren eigenen Fussbereich; die letzte Seite erhaelt ihn
    // erst nach den Summenbloecken.
    if (!page.withSummary) writeFooter(doc);
  });

  const detailsY = tableBottom + 17;
  const detailsWidth = 326;
  const summaryX = 364;
  drawBoxTitle(doc, left, detailsY, detailsWidth, isCreditNote ? 'Gutschriftsdetails' : 'Rechnungsdetails');
  doc.rect(left, detailsY, detailsWidth, 105).strokeColor('#c7ced8').lineWidth(0.7).stroke();

  const methodLabel = paymentMethodLabel(snapshot.paymentMethod || invoice.paymentMethod) || 'nicht festgelegt';
  const detailItems = isCreditNote
    ? [
      `Gutschriftsdatum: ${invoiceDate}`,
      `Bezug: Rechnung ${getOriginalInvoiceNumber(invoice)}${invoice.creditNoteOf?.createdAt ? ` vom ${date(invoice.creditNoteOf.createdAt)}` : ''}`,
      `Art: ${CORRECTION_LABELS[invoice.correctionType] || 'Gutschrift'}`,
      `Grund: ${text(invoice.notes)}`,
      `E-Mail: ${text(invoice.customerEmail)}`
    ]
    : [
      `Rechnungsdatum: ${invoiceDate}`,
      // Produktentscheidung: Leistungsdatum = Rechnungsdatum.
      `Leistungsdatum: ${invoiceDate}`,
      `Fälligkeitsdatum: ${date(invoice.dueDate)}`,
      `Zahlungsart: ${methodLabel}`,
      `Zahlungsziel: ${text(invoice.paymentTerms)}`,
      `E-Mail: ${text(invoice.customerEmail)}`
    ];
  if (isReverseCharge) {
    detailItems.push(`Hinweis: ${reverseChargeNotice}`);
  }
  doc.font('Helvetica').fontSize(8.5).fillColor('#111111').text(detailItems.join('\n'), left + 7, detailsY + 26, { lineGap: 2, width: detailsWidth - 14, height: 76, ellipsis: true });

  doc.rect(summaryX, detailsY, right - summaryX, 105).fillAndStroke(LIGHT, '#8793a7');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
    .text(isCreditNote ? 'Gutschriftsübersicht' : 'Zahlungsübersicht', summaryX + 7, detailsY + 5);
  doc.moveTo(summaryX + 7, detailsY + 21).lineTo(right - 7, detailsY + 21).strokeColor('#d2d8e0').lineWidth(0.5).stroke();
  const totals = [];
  if (discount > 0) {
    // Eigene Zeile: der Rabatt ist in den Summen darunter bereits beruecksichtigt.
    totals.push(['Rabatt (brutto)', money(-discount)]);
  }
  totals.push([isCreditNote ? 'Gutschrift Netto' : 'Gesamt Netto', money(netTotal)]);
  totals.push([
    isReverseCharge ? 'zzgl. 0,00 % MwSt. (RC)' : `zzgl. ${formatRate(taxRate)} MwSt.`,
    money(taxTotal)
  ]);
  totals.push([isCreditNote ? 'Gutschriftsbetrag' : 'Gesamtbetrag', money(grossTotal)]);
  if (!isCreditNote) {
    // Offener Betrag ZUM ZEITPUNKT DER RECHNUNGSSTELLUNG (Snapshot). Wurde der Beleg erst
    // spaeter archiviert (Altbestand), steht der Stichtag dabei.
    const hasSnapshot = Number.isFinite(Number(snapshot.openAmount));
    const openAtIssue = hasSnapshot ? Number(snapshot.openAmount) : Math.max(0, grossTotal - Number(invoice.paidAmount || 0));
    const atIssue = !hasSnapshot || !snapshot.capturedAt || sameDay(snapshot.capturedAt, invoice.createdAt);
    totals.push([atIssue ? 'Offener Betrag bei Rechnungsstellung' : `Offener Betrag (Stand ${date(snapshot.capturedAt)})`, money(openAtIssue)]);
  }

  const rowStep = totals.length > 4 ? 15 : 18;
  const rowStart = totals.length > 4 ? 25 : 28;
  totals.forEach(([label, value], index) => {
    const y = detailsY + rowStart + index * rowStep;
    const isBold = isCreditNote ? index === totals.length - 1 : index >= totals.length - 2;
    if (isBold) doc.rect(summaryX + 1, y - 3, right - summaryX - 2, rowStep).fill(TOTAL);
    doc.fillColor('#111111').font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.6)
      .text(label, summaryX + 7, y, { width: 120 })
      .text(value, summaryX + 120, y, { width: right - summaryX - 127, align: 'right' });
  });

  const historyY = detailsY + 118;
  doc.rect(left, historyY, pageWidth, 66).fillAndStroke('#fafbfd', '#c7ced8');
  if (isCreditNote) {
    // Verrechnung/Erstattung verstaendlich beschreiben - ohne Salden des Kundenkontos,
    // die sich nach Belegdatum aendern koennen.
    const settlement = invoice.correctionType === 'partial_refund'
      ? `Diese Gutschrift dokumentiert die Rückzahlung einer Überzahlung zu Rechnung ${getOriginalInvoiceNumber(invoice)}. Die Rückzahlung erfolgt gesondert auf Ihr Zahlungsmittel bzw. Konto.`
      : invoice.correctionType === 'full_cancellation'
        ? `Diese Gutschrift storniert die Rechnung ${getOriginalInvoiceNumber(invoice)} vollständig. Bereits geleistete Zahlungen bleiben als Guthaben erhalten und werden verrechnet oder erstattet.`
        : `Diese Gutschrift mindert die Forderung aus Rechnung ${getOriginalInvoiceNumber(invoice)} um den oben ausgewiesenen Betrag.`;
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(9.5).text('Verrechnung', left + 7, historyY + 7);
    doc.moveTo(left + 7, historyY + 21).lineTo(right - 7, historyY + 21).strokeColor('#d2d8e0').lineWidth(0.5).stroke();
    doc.fillColor('#111111').font('Helvetica').fontSize(8.5).text(settlement, left + 7, historyY + 27, { width: pageWidth - 14, height: 36 });
  } else {
    const payments = Array.isArray(snapshot.payments) ? snapshot.payments : [];
    const atIssue = !snapshot.capturedAt || sameDay(snapshot.capturedAt, invoice.createdAt);
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(9.5)
      .text(atIssue ? 'Zahlungen bis Rechnungsstellung' : `Zahlungen (Stand ${date(snapshot.capturedAt)})`, left + 7, historyY + 7);
    doc.moveTo(left + 7, historyY + 21).lineTo(right - 7, historyY + 21).strokeColor('#d2d8e0').lineWidth(0.5).stroke();
    doc.fontSize(8.5).text('Datum', left + 7, historyY + 25).text('Zahlungsart', left + 80, historyY + 25).text('Betrag', right - 70, historyY + 25, { width: 63, align: 'right' });
    if (!payments.length) {
      doc.fillColor('#737b88').font('Helvetica-Oblique').text('Keine Zahlungen bis Rechnungsstellung', left + 7, historyY + 38);
    } else {
      payments.slice(0, 3).forEach((payment, index) => {
        const y = historyY + 37 + index * 9.5;
        doc.fillColor('#111111').font('Helvetica').fontSize(8)
          .text(date(payment.date), left + 7, y)
          .text(paymentMethodLabel(payment.method) || 'Zahlung', left + 80, y)
          .text(money(payment.amount), right - 70, y, { width: 63, align: 'right' });
      });
    }

    const ratingX = 427;
    const ratingY = historyY + 78;
    doc.rect(ratingX, ratingY, 144, 103).fillAndStroke('#f6f8fb', '#c7ced8');
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8.8).text('Bewertung', ratingX + 7, ratingY + 8, { width: 130, align: 'center' });
    doc.moveTo(ratingX + 12, ratingY + 22).lineTo(ratingX + 132, ratingY + 22).strokeColor('#d2d8e0').lineWidth(0.5).stroke();
    // QR-Code NUR mit konfiguriertem Ziel - ohne Ziel wird keine Adresse erfunden.
    if (reviewQrCode) doc.image(reviewQrCode, ratingX + 52, ratingY + 27, { width: 40, height: 40 });
    doc.fillColor('#111111').font('Helvetica').fontSize(8.2)
      .text(REVIEW_TEXT, ratingX + 8, reviewQrCode ? ratingY + 71 : ratingY + 34, { width: 128, align: 'center', lineGap: 1 });
  }

  writeFooter(doc);
};

// Konfiguriertes Bewertungsziel (nur http/https). Kein Ersatzwert.
const resolveReviewUrl = () => {
  const raw = String(process.env.GOOGLE_REVIEW_URL || '').trim();
  return /^https?:\/\/\S+$/i.test(raw) ? raw : '';
};

/**
 * Fingerabdruck des betragsrelevanten Belegs. Zahlungsstand, Status, Mahnstufe und
 * Versanddaten gehoeren bewusst NICHT dazu: sie aendern das archivierte PDF nie.
 */
const buildDocumentFingerprint = (invoice) => {
  const plain = invoice && typeof invoice.toObject === 'function' ? invoice.toObject({ depopulate: true }) : (invoice || {});
  const address = plain.billingAddress || {};
  const payload = {
    invoiceNumber: plain.invoiceNumber || '',
    isCreditNote: Boolean(plain.isCreditNote),
    creditNoteOfNumber: plain.creditNoteOfNumber || '',
    customerName: plain.customerName || '',
    billingAddress: [address.street, address.zip || address.zipCode, address.city, address.country].map((v) => String(v || '')),
    items: (plain.items || []).map((item) => [
      String(item.serviceName || ''), String(item.description || ''), Number(item.quantity || 0),
      Number(item.unitPrice || 0), Number(item.total || 0), Number(item.taxRate ?? '')
    ]),
    subtotal: Number(plain.subtotal || 0),
    tax: Number(plain.tax || 0),
    total: Number(plain.total || 0),
    discount: Number(plain.discount || 0),
    taxRate: Number(plain.taxRate ?? ''),
    isReverseCharge: Boolean(plain.isReverseCharge),
    dueDate: plain.dueDate ? new Date(plain.dueDate).toISOString().slice(0, 10) : '',
    createdAt: plain.createdAt ? new Date(plain.createdAt).toISOString() : ''
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

class InvoicePdfService {
  static COMPANY = COMPANY;

  static REVIEW_TEXT = REVIEW_TEXT;

  static paymentMethodLabel = paymentMethodLabel;

  static buildDocumentFingerprint = buildDocumentFingerprint;

  /**
   * Erzeugt das PDF aus dem gespeicherten Beleg (reine Darstellung, schreibt nichts).
   * Archivierung und Auslieferung der unveraenderlichen Fassung: FinancialService.ensureInvoiceDocument.
   */
  static async generate(invoice) {
    let populatedInvoice = invoice;
    if (typeof invoice.populate === 'function' && invoice.db?.readyState === 1) {
      try {
        populatedInvoice = await invoice.populate([
          { path: 'customerId', select: 'customerNumber invoiceAddress paymentAddress country vatId company' },
          { path: 'orderId', select: 'orderNumber' },
          { path: 'repairOrderIds', select: 'orderNumber' },
          { path: 'bookingId', select: 'bookingNumber' },
          { path: 'creditNoteOf', select: 'invoiceNumber createdAt total' }
        ]);
      } catch (err) {
        console.warn('InvoicePdfService: populate skipped or failed:', err.message);
      }
    }

    let reviewQrCode = null;
    const reviewUrl = populatedInvoice.isCreditNote ? '' : resolveReviewUrl();
    if (reviewUrl) {
      const QRCode = loadQrCode();
      if (QRCode) {
        try {
          reviewQrCode = await QRCode.toBuffer(reviewUrl, { type: 'png', width: 180, margin: 1 });
        } catch (error) {
          console.warn('InvoicePdfService: QR-Code konnte nicht erzeugt werden:', error.message);
        }
      }
    }

    return new Promise((resolve, reject) => {
      const chunks = [];
      const documentTitle = populatedInvoice.isCreditNote
        ? `Gutschrift ${populatedInvoice.invoiceNumber}`
        : `Rechnung ${populatedInvoice.invoiceNumber}`;
      const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: documentTitle } });
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        renderInvoice(doc, populatedInvoice, reviewQrCode);
      } catch (error) {
        reject(error);
        return;
      }
      doc.end();
    });
  }
}

module.exports = InvoicePdfService;
