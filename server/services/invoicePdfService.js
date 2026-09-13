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

const renderInvoice = (doc, invoice, payments, reviewQrCode) => {
  const left = 24;
  const right = 571;
  const pageWidth = right - left;
  const invoiceDate = date(invoice.createdAt);
  const isReverseCharge = Boolean(invoice.isReverseCharge);
  const reverseChargeNotice = text(invoice.reverseChargeNotice, 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge');
  const customerVatId = text(invoice.customerVatId || invoice.customerId?.vatId, '');
  const sellerVatId = text(invoice.sellerVatId, COMPANY.vatId);

  const outstanding = Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0));
  const taxable = Math.max(0, Number(invoice.subtotal || 0) - Number(invoice.discount || 0));
  const taxRate = isReverseCharge ? 0 : (taxable > 0 ? (Number(invoice.tax || 0) / taxable) * 100 : 0);

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

  doc.font('Helvetica-Bold').fontSize(20).text(invoice.isCreditNote ? 'Gutschrift' : 'Rechnung', left, 139, { width: pageWidth, align: 'center' });
  doc.moveTo(left, 169).lineTo(right, 169).strokeColor('#7f8a9c').lineWidth(1.2).stroke();
  doc.font('Helvetica').fontSize(9.5).text('Seite: 1', left, 174).text(invoiceDate, right - 80, 174, { width: 80, align: 'right' });
  doc.text(`Rechnungsnr. ${text(invoice.invoiceNumber)} bzgl. Bestellnummer: ${getOrderNumber(invoice)}`, left, 193);

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
  const tableTop = 243;
  const headerHeight = 28;
  const rowHeight = Math.max(37, Math.min(108, (invoice.items?.length || 1) * 37));
  doc.rect(left, tableTop, pageWidth, headerHeight).fillAndStroke('#f1f3f8', '#8793a7');
  headers.forEach((header, index) => {
    const align = index >= 5 ? 'right' : 'left';
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9).text(header, columns[index] + 5, tableTop + 9, { width: columns[index + 1] - columns[index] - 10, align });
  });
  doc.rect(left, tableTop + headerHeight, pageWidth, rowHeight).strokeColor('#8793a7').lineWidth(0.8).stroke();
  columns.slice(1, -1).forEach((x) => doc.moveTo(x, tableTop).lineTo(x, tableTop + headerHeight + rowHeight).strokeColor('#c6ccd5').lineWidth(0.5).stroke());

  let itemY = tableTop + headerHeight + 9;
  (invoice.items || []).slice(0, 3).forEach((item, index) => {
    const quantity = Number(item.quantity || 0);
    const itemTaxLabel = isReverseCharge ? '0,00%' : `${taxRate.toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`;
    doc.fillColor('#111111').font('Helvetica').fontSize(8.8);
    doc.text(String(index + 1), columns[0] + 5, itemY);
    doc.text(`${quantity.toLocaleString('de-DE')} Stk`, columns[1] + 5, itemY);
    doc.text('-', columns[2] + 5, itemY);
    doc.text(text(item.serviceName || item.description), columns[3] + 5, itemY, { width: columns[4] - columns[3] - 10, height: 28 });
    doc.text(itemTaxLabel, columns[4] + 5, itemY);
    doc.text(money(item.unitPrice), columns[5] + 5, itemY, { width: columns[6] - columns[5] - 10, align: 'right' });
    doc.text(money(item.total), columns[6] + 5, itemY, { width: columns[7] - columns[6] - 10, align: 'right' });
    itemY += 34;
  });

  const detailsY = tableTop + headerHeight + rowHeight + 17;
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
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Zahlungsuebersicht', summaryX + 7, detailsY + 5);
  doc.moveTo(summaryX + 7, detailsY + 21).lineTo(right - 7, detailsY + 21).strokeColor('#d2d8e0').lineWidth(0.5).stroke();
  const totals = [
    ['Gesamt Netto', money(taxable)],
    [
      isReverseCharge ? 'zzgl. 0,00% MwSt. (RC)' : `zzgl. ${taxRate.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% MwSt.`,
      money(isReverseCharge ? 0 : invoice.tax)
    ],
    ['Gesamtbetrag', money(invoice.total)],
    ['Offener Betrag', money(outstanding)]
  ];
  totals.forEach(([label, value], index) => {
    const y = detailsY + 28 + index * 18;
    if (index >= 2) doc.rect(summaryX + 1, y - 3, right - summaryX - 2, 18).fill(TOTAL);
    doc.fillColor('#111111').font(index >= 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.2)
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
          { path: 'bookingId', select: 'bookingNumber' }
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
      const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Rechnung ${populatedInvoice.invoiceNumber}` } });
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      renderInvoice(doc, populatedInvoice, payments, reviewQrCode);
      doc.end();
    });
  }
}

module.exports = InvoicePdfService;
