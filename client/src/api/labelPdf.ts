import api from './api';
import { invoicePdfRequestConfig, toValidPdfBlob } from './invoices';

/**
 * EIN Abruf- und Speicherweg fuer alle DHL-Label-PDFs (Einsendelabel Kunde -> McRepair,
 * Versandlabel McRepair -> Kunde) - fuer Kunde, Team und Gast.
 *
 * Hintergrund (DHL-2): vier Kopien eines Download-Helfers nutzten
 * `transformResponse: undefined` + `validateStatus: s === 200`. axios faellt bei
 * `undefined` auf den JSON-Transform der Instanz zurueck (data.trim() auf einem Blob ->
 * TypeError), und der eigene validateStatus schaltet den 401/403-Logout-Zweig scharf. Jeder
 * Klick auf "Einsendelabel herunterladen" scheiterte deshalb. Hier wird dieselbe, bereits fuer
 * Rechnungen bewaehrte Konfiguration verwendet (Identitaets-Transform, kein validateStatus).
 */

export type LabelKind = 'inbound' | 'outbound';

const kindText = (kind: LabelKind) => (kind === 'outbound' ? 'Versandlabel' : 'Einsendelabel');

/** Deutsche Fehlermeldung je HTTP-Status; eine deutsche Servermeldung hat Vorrang bei 404/409/422. */
export const labelPdfErrorMessage = (status?: number, serverMessage?: string, kind: LabelKind = 'inbound'): string => {
  if (status === 401) return 'Bitte melden Sie sich erneut an, um das Label abzurufen.';
  if (status === 403) return 'Sie haben keine Berechtigung für dieses Label.';
  if (status === 404) return serverMessage || `Für diesen Vorgang ist kein ${kindText(kind)} hinterlegt.`;
  if (status && serverMessage) return serverMessage;
  if (status) return `Das ${kindText(kind)} konnte nicht geladen werden (HTTP ${status}). Bitte versuchen Sie es erneut.`;
  return `Das ${kindText(kind)} konnte nicht geladen werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.`;
};

/** Servermeldung aus einer Fehlerantwort lesen - bei responseType 'blob' steckt das JSON im Blob. */
const readServerMessage = async (data: unknown): Promise<string> => {
  try {
    let text: string | null = null;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      text = await data.text();
    } else if (typeof data === 'string') {
      text = data;
    } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      text = new TextDecoder().decode(data as ArrayBuffer);
    }
    if (text !== null) {
      const parsed = JSON.parse(text);
      return String(parsed?.error || parsed?.message || '');
    }
    if (data && typeof data === 'object') {
      const record = data as { error?: unknown; message?: unknown };
      return String(record.error || record.message || '');
    }
  } catch {
    /* kein JSON */
  }
  return '';
};

export class LabelPdfError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LabelPdfError';
    this.status = status;
  }
}

const toLabelPdfError = async (error: unknown, kind: LabelKind): Promise<LabelPdfError> => {
  const err = error as { status?: number; response?: { status?: number; data?: unknown }; data?: unknown };
  const status = err?.status ?? err?.response?.status;
  const serverMessage = await readServerMessage(err?.data ?? err?.response?.data);
  return new LabelPdfError(labelPdfErrorMessage(status, serverMessage, kind), status);
};

/** Laedt ein Label-PDF ueber die (angemeldete) API und prueft die PDF-Signatur. */
export const fetchLabelPdf = async (url: string, kind: LabelKind = 'inbound'): Promise<Blob> => {
  if (!url || !url.startsWith('/api/')) {
    throw new LabelPdfError(labelPdfErrorMessage(404, '', kind), 404);
  }
  let response;
  try {
    response = await api.get(url, invoicePdfRequestConfig());
  } catch (error: unknown) {
    throw await toLabelPdfError(error, kind);
  }
  try {
    return await toValidPdfBlob(response.data);
  } catch {
    throw new LabelPdfError(`Der Server hat kein gültiges PDF für das ${kindText(kind)} geliefert.`);
  }
};

/** Speichert einen Blob als Datei (<a download>, kein neues Fenster). */
export const saveBlobAsFile = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

/** Oeffnet den Druckdialog fuer ein PDF ueber einen unsichtbaren iframe (wie bei Rechnungen). */
export const printPdfBlob = (blob: Blob): void => {
  const pdfUrl = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    URL.revokeObjectURL(pdfUrl);
  };
  iframe.onload = () => {
    const printWindow = iframe.contentWindow;
    if (!printWindow) {
      cleanup();
      return;
    }
    printWindow.addEventListener('afterprint', cleanup);
    printWindow.focus();
    printWindow.print();
    window.setTimeout(cleanup, 60000);
  };
  iframe.src = pdfUrl;
};

/** Laedt ein Label-PDF und speichert es. Wirft LabelPdfError mit deutscher Meldung. */
export const downloadLabelPdf = async (url: string, filename: string, kind: LabelKind = 'inbound'): Promise<void> => {
  const blob = await fetchLabelPdf(url, kind);
  saveBlobAsFile(blob, filename);
};

/** Laedt ein Label-PDF und oeffnet den Druckdialog. Wirft LabelPdfError mit deutscher Meldung. */
export const printLabelPdf = async (url: string, kind: LabelKind = 'inbound'): Promise<void> => {
  const blob = await fetchLabelPdf(url, kind);
  printPdfBlob(blob);
};

/**
 * Gast: das Label kommt als data:-URL aus der Gast-Sendungsverfolgung. Eine Navigation zu
 * data:-URLs blockiert Chrome; deshalb Blob + <a download>.
 */
export const dataUrlToPdfBlob = async (dataUrl: string): Promise<Blob> => {
  const match = /^data:application\/pdf;base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) {
    throw new LabelPdfError('Für diesen Vorgang ist kein Einsendelabel hinterlegt.', 404);
  }
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  try {
    return await toValidPdfBlob(new Blob([bytes]));
  } catch {
    throw new LabelPdfError('Das gespeicherte Label ist kein gültiges PDF.');
  }
};

export const downloadDataUrlPdf = async (dataUrl: string, filename: string): Promise<void> => {
  saveBlobAsFile(await dataUrlToPdfBlob(dataUrl), filename);
};

export const printDataUrlPdf = async (dataUrl: string): Promise<void> => {
  printPdfBlob(await dataUrlToPdfBlob(dataUrl));
};

/** Einheitliche Dateinamen (wie der Server): DHL-Einsendelabel_<BKG|ORD>.pdf / DHL-Versandlabel_<ORD>.pdf */
export const labelFilename = (kind: LabelKind, reference?: string | null, placeholder = false): string => {
  const safe = String(reference || '').replace(/[^A-Za-z0-9\-_]/g, '') || 'Label';
  if (kind === 'outbound') return `DHL-Versandlabel_${safe}.pdf`;
  return `${placeholder ? 'DHL-Testlabel' : 'DHL-Einsendelabel'}_${safe}.pdf`;
};
