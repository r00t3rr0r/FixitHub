const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Payment = require('../models/Payment');

const COMPANY = {
  name: 'Online Point GmbH',
  street: 'Kurfuerstenstrasse 106',
  city: '10787 Berlin',
  phone: '030 403 688 951',
  bank: 'Commerzbank AG',
  iban: 'DE95100400000501905400',
  bic: 'COBADEFFXXX',
  court: 'Amtsgericht Charlottenburg',
  register: 'HRB 136735 B',
  managingDirector: 'Julian Szymansky',
  vatId: 'DE318981969'
};

const BLUE = '#1a2a5e';
const LINE = '#aeb7c5';
const LIGHT = '#f5f7fa';
const TOTAL = '#edf5fc';

const text = (value, fallback = '-') => String(value ?? '').trim() || fallback;
const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const date = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('de-DE') : '-';
};

const getCustomerNumber = (invoice) => text(invoice.customerId?.customerNumber, '-');
const getOrderNumber = (invoice) => text(invoice.bookingId?.bookingNumber || invoice.orderId?.orderNumber || invoice.orderId, '-');
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

const writeFooter = (doc, sellerVatId) => {
  const y = 775;
  const vat = sellerVatId || COMPANY.vatId;
  doc.moveTo(24, y).lineTo(571, y).strokeColor('#7f8a9c').lineWidth(1).stroke();
  doc.fillColor('#111111').font('Helvetica').fontSize(8.5);
  doc.text(`${COMPANY.name}\n${COMPANY.street}\n${COMPANY.city}\nTel.: ${COMPANY.phone}`, 24, y + 7, { width: 190 });
  doc.text(`${COMPANY.bank}\nIBAN: ${COMPANY.iban}\nBIC: ${COMPANY.bic}`, 230, y + 7, { width: 170 });
  doc.text(`${COMPANY.court}\n${COMPANY.register}\nGeschaeftsfuehrer: ${COMPANY.managingDirector}\nUst-IdNr.: ${vat}`, 414, y + 7, { width: 157 });
};

// Seitenaufbau der Positionstabelle. ALLE Positionen muessen gedruckt werden
// (§14 UStG, Spezifikation 4.2) - passen sie nicht auf eine Seite, laufen sie auf
// Folgeseiten weiter; die Summenbloecke stehen immer auf der letzten Seite.
const PAGE_CONTENT_BOTTOM = 757;      // darunter beginnt der Fusszeilenblock (y = 775)
const ROW_PITCH = 34;                 // Zeilenabstand einer Position
const TABLE_HEADER_HEIGHT = 28;
const FIRST_ROW_OFFSET = 9;
const SUMMARY_BLOCK_HEIGHT = 316;     // Rechnungsdetails + Zahlungsverlauf + Bewertung
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

const renderInvoice = (doc, invoice, payments, reviewQrCode) => {
  const left = 24;
  const right = 571;
  const pageWidth = right - left;
  const invoiceDate = date(invoice.createdAt);
  const isReverseCharge = Boolean(invoice.isReverseCharge);
  const reverseChargeNotice = text(invoice.reverseChargeNotice, 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge');
  const customerVatId = text(invoice.customerVatId || invoice.customerId?.vatId, '');
  const sellerVatId = text(invoice.sellerVatId, COMPANY.vatId);

  const isCreditNote = Boolean(invoice.isCreditNote);
  // Die gespeicherten Summen sind bereits brutto-first berechnet: der Rabatt steckt
  // in netTotal/taxTotal/grossTotal und darf hier NICHT erneut abgezogen werden.
  // Bei einer Gutschrift bleiben die Werte negativ - nur der offene Betrag wird gekappt.
  const netTotal = Number(invoice.invoiceNetTotal ?? invoice.subtotal ?? 0);
  const taxTotal = isReverseCharge ? 0 : Number(invoice.invoiceTaxTotal ?? invoice.tax ?? 0);
  const grossTotal = Number(invoice.invoiceGrossTotal ?? invoice.total ?? 0);
  const discount = Number(invoice.discount || 0);
  const outstanding = Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0));

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
  const formatRate = (rate) => `${Number(rate || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const itemPages = planItemPages(items.length);
  const totalPages = itemPages.length;

  doc.fillColor('#111111').font('Helvetica').fontSize(8.5)
    .text(`${COMPANY.name}, ${COMPANY.street}, ${COMPANY.city}`, left, 18, { width: 390 });
  doc.moveTo(left, 31).lineTo(448, 31).strokeColor('#d5d9df').lineWidth(0.5).stroke();

  doc.fillColor('#f5b800').font('Helvetica-Bold').fontSize(16).text('McRepair.de', 470, 20, { width: 101, align: 'center' });
  doc.fillColor(BLUE).font('Helvetica').fontSize(6.5).text('professionell | schnell | zuverlaessig', 465, 10, { width: 110, align: 'center' });

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
  if (isCreditNote) {
    doc.text(`Gutschrift-Nr. ${text(invoice.invoiceNumber)} - Gutschrift zu Rechnung ${getOriginalInvoiceNumber(invoice)}`, left, 193);
  } else {
    doc.text(`Rechnungsnr. ${text(invoice.invoiceNumber)} bzgl. Bestellnummer: ${getOrderNumber(invoice)}`, left, 193);
  }

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

  const columns = [left, 54, 113, 184, 350, 385, 476, right];
  const headers = ['Pos.', 'Menge', 'Art.-Nr.', 'Service Name', 'USt.', 'Einzel', 'Gesamt'];

  const drawItemsTable = (page) => {
    const tableTop = page.tableTop;
    const rowHeight = Math.max(37, page.count * ROW_PITCH);
    doc.rect(left, tableTop, pageWidth, TABLE_HEADER_HEIGHT).fillAndStroke('#f1f3f8', '#8793a7');
    headers.forEach((header, index) => {
      const align = index >= 5 ? 'right' : 'left';
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
      doc.fillColor('#111111').font('Helvetica').fontSize(8.8);
      doc.text(String(index + 1), columns[0] + 5, itemY);
      doc.text(`${quantity.toLocaleString('de-DE')} Stk`, columns[1] + 5, itemY);
      doc.text('-', columns[2] + 5, itemY);
      doc.text(text(item.serviceName || item.description), columns[3] + 5, itemY, { width: columns[4] - columns[3] - 10, height: 28 });
      doc.text(formatRate(itemRate), columns[4] + 5, itemY);
      doc.text(money(item.unitPrice), columns[5] + 5, itemY, { width: columns[6] - columns[5] - 10, align: 'right' });
      doc.text(money(item.total), columns[6] + 5, itemY, { width: columns[7] - columns[6] - 10, align: 'right' });
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
    if (!page.withSummary) writeFooter(doc, sellerVatId);
  });

  const detailsY = tableBottom + 17;
  const detailsWidth = 326;
  const summaryX = 364;
  drawBoxTitle(doc, left, detailsY, detailsWidth, 'Rechnungsdetails');
  doc.rect(left, detailsY, detailsWidth, 105).strokeColor('#c7ced8').lineWidth(0.7).stroke();
  const detailItems = [
    `Leistungsdatum: ${invoiceDate}`,
    `Zahlungsart: ${text(invoice.paymentMethod)}`,
    `Faelligkeitsdatum: ${date(invoice.dueDate)}`,
    `E-Mail: ${text(invoice.customerEmail)}`
  ];
  if (isReverseCharge) {
    detailItems.push(`Hinweis: ${reverseChargeNotice}`);
  }
  doc.font('Helvetica').fontSize(8.5).fillColor('#111111').text(detailItems.join('\n'), left + 7, detailsY + 26, { lineGap: 3, width: detailsWidth - 14 });

  doc.rect(summaryX, detailsY, right - summaryX, 105).fillAndStroke(LIGHT, '#8793a7');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
    .text(isCreditNote ? 'Gutschriftsuebersicht' : 'Zahlungsuebersicht', summaryX + 7, detailsY + 5);
  doc.moveTo(summaryX + 7, detailsY + 21).lineTo(right - 7, detailsY + 21).strokeColor('#d2d8e0').lineWidth(0.5).stroke();
  const totals = [];
  if (discount > 0) {
    // Eigene Zeile: der Rabatt ist in den Summen darunter bereits beruecksichtigt.
    totals.push(['Rabatt (brutto)', money(-discount)]);
  }
  totals.push(['Gesamt Netto', money(netTotal)]);
  totals.push([
    isReverseCharge ? 'zzgl. 0,00% MwSt. (RC)' : `zzgl. ${formatRate(taxRate)} MwSt.`,
    money(taxTotal)
  ]);
  totals.push(['Gesamtbetrag', money(grossTotal)]);
  totals.push(['Offener Betrag', money(outstanding)]);

  const rowStep = totals.length > 4 ? 16 : 18;
  const rowStart = totals.length > 4 ? 26 : 28;
  totals.forEach(([label, value], index) => {
    const y = detailsY + rowStart + index * rowStep;
    const isBold = index >= totals.length - 2;
    if (isBold) doc.rect(summaryX + 1, y - 3, right - summaryX - 2, rowStep).fill(TOTAL);
    doc.fillColor('#111111').font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.2)
      .text(label, summaryX + 7, y, { width: 110 })
      .text(value, summaryX + 115, y, { width: right - summaryX - 122, align: 'right' });
  });

  const historyY = detailsY + 118;
  doc.rect(left, historyY, pageWidth, 66).fillAndStroke('#fafbfd', '#c7ced8');
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(9.5).text('Zahlungsverlauf', left + 7, historyY + 7);
  doc.moveTo(left + 7, historyY + 21).lineTo(right - 7, historyY + 21).strokeColor('#d2d8e0').lineWidth(0.5).stroke();
  doc.fontSize(8.5).text('Datum', left + 7, historyY + 26).text('Methode / Notiz', left + 80, historyY + 26).text('Betrag', right - 70, historyY + 26, { width: 63, align: 'right' });
  if (!payments.length) {
    doc.fillColor('#737b88').font('Helvetica-Oblique').text('Noch keine Zahlungen erfasst', left + 7, historyY + 42);
  } else {
    const payment = payments[0];
    doc.fillColor('#111111').font('Helvetica').text(date(payment.processedAt || payment.createdAt), left + 7, historyY + 42)
      .text(text(payment.paymentMethod), left + 80, historyY + 42)
      .text(money(payment.amount), right - 70, historyY + 42, { width: 63, align: 'right' });
  }

  const ratingX = 427;
  const ratingY = historyY + 78;
  doc.rect(ratingX, ratingY, 144, 103).fillAndStroke('#f6f8fb', '#c7ced8');
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8.8).text('Bewertung', ratingX + 7, ratingY + 8, { width: 130, align: 'center' });
  doc.moveTo(ratingX + 12, ratingY + 22).lineTo(ratingX + 132, ratingY + 22).strokeColor('#d2d8e0').lineWidth(0.5).stroke();
  doc.image(reviewQrCode, ratingX + 52, ratingY + 27, { width: 40, height: 40 });
  doc.fillColor('#111111').font('Helvetica').fontSize(8.2).text('Wenn Sie mit der Reparatur zufrieden\nwaren, bewerten Sie uns gern.\nWir freuen uns auf Ihr Feedback!', ratingX + 8, ratingY + 71, { width: 128, align: 'center', lineGap: 1 });

  writeFooter(doc, sellerVatId);
};

class InvoicePdfService {
  static async generate(invoice) {
    let populatedInvoice = invoice;
    if (typeof invoice.populate === 'function' && invoice.db?.readyState === 1) {
      try {
        populatedInvoice = await invoice.populate([
          { path: 'customerId', select: 'customerNumber invoiceAddress paymentAddress country vatId company' },
          { path: 'orderId', select: 'orderNumber' },
          { path: 'bookingId', select: 'bookingNumber' },
          { path: 'creditNoteOf', select: 'invoiceNumber createdAt total' }
        ]);
      } catch (err) {
        console.warn('InvoicePdfService: populate skipped or failed:', err.message);
      }
    }
    const payments = invoice.db?.readyState === 1
      ? await Payment.find({ invoiceId: populatedInvoice._id }).sort({ processedAt: -1, createdAt: -1 }).lean()
      : (invoice.payments || []);
    const reviewUrl = process.env.GOOGLE_REVIEW_URL
      || 'https://search.google.com/local/writereview?placeid=ChIJVVVVlf1QqEcRtHn-0ehLwpk&source=g.page.m.dd._&laa=lu-desktop-reviews-dialog-review-solicitation';
    const reviewQrCode = await QRCode.toBuffer(reviewUrl, { type: 'png', width: 180, margin: 1 });

    return new Promise((resolve, reject) => {
      const chunks = [];
      const documentTitle = populatedInvoice.isCreditNote
        ? `Gutschrift ${populatedInvoice.invoiceNumber}`
        : `Rechnung ${populatedInvoice.invoiceNumber}`;
      const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: documentTitle } });
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      renderInvoice(doc, populatedInvoice, payments, reviewQrCode);
      doc.end();
    });
  }
}

module.exports = InvoicePdfService;
