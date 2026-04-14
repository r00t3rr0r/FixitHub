import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Eye,
  Code,
  Plus,
  Loader2,
  Info,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import {
  sendContactMessageReply,
  ContactMessage,
} from '@/api/contactMessages';

interface ContactMessageReplyDialogProps {
  message: ContactMessage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplySuccess: () => void;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function substituteTemplateVariables(
  content: string,
  vars: Record<string, unknown>
) {
  let output = content;
  Object.entries(vars).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    output = output.replace(regex, String(value || ''));
  });
  return output;
}

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  repair: 'Reparaturanfrage',
  status: 'Statusanfrage',
  business: 'Geschäftsanfrage',
  complaint: 'Reklamation',
  other: 'Kontaktanfrage',
};

function getInquiryTypeLabel(subject?: string) {
  if (!subject) return 'Kontaktanfrage';
  return SUBJECT_TYPE_LABELS[subject] || 'Kontaktanfrage';
}

function formatGermanDate(dateValue?: string) {
  if (!dateValue) return new Date().toLocaleDateString('de-DE');
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toLocaleDateString('de-DE');
  }
  return parsedDate.toLocaleDateString('de-DE');
}

function buildSmartReplySubject(message: ContactMessage) {
  const inquiryType = getInquiryTypeLabel(message.subject);
  const inquiryDate = formatGermanDate(message.createdAt);
  const orderSuffix = message.orderNumber
    ? ` | Auftrag ${message.orderNumber}`
    : '';
  return `Re: Ihre ${inquiryType} vom ${inquiryDate}${orderSuffix}`;
}

// Professional HTML Email Template (McRepair Style)
const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Antwort zu Ihrer Kontaktanfrage</title>
  <style>
    @media only screen and (max-width: 520px) {
      .email-shell {
        padding: 14px 6px !important;
      }
      .email-panel {
        border-radius: 16px !important;
      }
      .email-header {
        padding: 22px 18px !important;
      }
      .email-body,
      .email-footer {
        padding: 20px 18px !important;
      }
      .email-title {
        font-size: 24px !important;
        line-height: 1.25 !important;
      }
      .email-intro {
        font-size: 15px !important;
        line-height: 1.6 !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:'Segoe UI',Arial,sans-serif;color:#2d3748;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-shell" style="background:#f5f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-panel" style="max-width:680px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(15,29,69,0.12);">
          <tr>
            <td style="height:8px;background:#f5b800;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-header" style="padding:32px 36px;background:#1a2a5e;">
              <div style="font-size:12px;line-height:1;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.72);margin-bottom:14px;">SUPPORT & SERVICE</div>
              <div style="font-size:30px;line-height:1.2;font-weight:800;color:#ffffff;letter-spacing:-0.03em;">Mc<span style="color:#f5b800;">Repair</span>.de</div>
              <div style="width:72px;height:4px;border-radius:999px;background:#f5b800;margin:22px 0 0 0;"></div>
            </td>
          </tr>
          <tr>
            <td class="email-body" style="padding:36px;">
              <h1 class="email-title" style="margin:0 0 14px 0;font-size:30px;line-height:1.2;font-weight:800;color:#0f1d45;letter-spacing:-0.03em;">Antwort auf Ihre Kontaktanfrage</h1>
              <p class="email-intro" style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:#636e85;">Hallo {{senderName}}, vielen Dank für Ihre Nachricht an {{companyName}}. Nachfolgend erhalten Sie unsere Rückmeldung.</p>
              
              <div style="font-size:15px;line-height:1.8;color:#2d3748;margin-bottom:24px;">
                <p style="margin:0 0 16px 0;">Wir beziehen uns auf Ihre <strong>{{inquiryType}}</strong> vom <strong>{{requestDate}}</strong>.</p>
                
                <div style="margin:0 0 16px 0;padding:16px;border-radius:12px;background:#fff7df;border:1px solid #d8dce6;">
                  <strong style="display:block;margin-bottom:8px;color:#0f1d45;">Ihre ursprüngliche Anfrage</strong>
                  <div style="font-size:14px;line-height:1.7;color:#2d3748;">{{originalMessageHtml}}</div>
                </div>
                
                <div style="margin:0;padding:16px;border-radius:12px;background:#eef3ff;border:1px solid #d8dce6;">
                  <strong style="display:block;margin-bottom:8px;color:#0f1d45;">Unsere Antwort auf Ihre Anfrage</strong>
                  <div style="font-size:14px;line-height:1.7;color:#2d3748;">{{replyMessageHtml}}</div>
                </div>
              </div>
              
              <div style="margin:28px 0 24px 0;padding:18px 20px;background:#eef3ff;border-radius:18px;border:1px solid #d8dce6;font-size:14px;line-height:1.7;color:#2d3748;">
                <strong>Rückfragen:</strong><br />Wenn noch Informationen fehlen, antworten Sie einfach auf diese E-Mail. Unser Service-Team unterstützt Sie gerne.
              </div>

              <p style="font-size:14px;color:#636e85;margin-top:28px;padding-top:20px;border-top:1px solid #d8dce6;">
                Mit freundlichen Grüßen,<br />
                <strong>Ihr {{companyName}} Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding:24px 36px 32px 36px;background:#f8f9fc;border-top:1px solid #d8dce6;font-size:12px;line-height:1.7;color:#636e85;">
              Diese E-Mail enthält unsere Rückmeldung zu Ihrer Kontaktanfrage.<br />
              Bei Fragen erreichen Sie uns unter <a href="mailto:{{supportEmail}}" style="color:#1a2a5e;font-weight:700;text-decoration:none;">{{supportEmail}}</a> oder {{supportPhone}}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export function ContactMessageReplyDialog({
  message,
  open,
  onOpenChange,
  onReplySuccess,
}: ContactMessageReplyDialogProps) {
  const { toast } = useToast();

  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'editor' | 'html' | 'preview'>('editor');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Predefined template variables for contact messages
  const CONTACT_MESSAGE_VARIABLES = {
    senderName: { name: 'senderName', label: 'Name des Absenders', value: message?.name },
    senderEmail: { name: 'senderEmail', label: 'Email des Absenders', value: message?.email },
    senderPhone: { name: 'senderPhone', label: 'Telefon des Absenders', value: message?.phone },
    subject: { name: 'subject', label: 'Thema der Anfrage', value: message?.subject },
    inquiryType: { name: 'inquiryType', label: 'Anfragetyp (lesbar)', value: getInquiryTypeLabel(message?.subject) },
    orderNumber: { name: 'orderNumber', label: 'Auftragsnummer', value: message?.orderNumber },
    messageContent: { name: 'messageContent', label: 'Inhalt der Anfrage', value: message?.message },
    requestDate: { name: 'requestDate', label: 'Anfragedatum', value: message?.createdAt ? new Date(message.createdAt).toLocaleDateString('de-DE') : '' },
    supportEmail: { name: 'supportEmail', label: 'Support Email', value: 'support@fixithub.com' },
    supportPhone: { name: 'supportPhone', label: 'Support Telefon', value: '+49 30 40368895' },
    companyName: { name: 'companyName', label: 'Unternehmensname', value: 'McRepair.de' },
    replyMessage: { name: 'replyMessage', label: 'Antworttext (roh)', value: messageText },
    replyMessageHtml: { name: 'replyMessageHtml', label: 'Antworttext (HTML)', value: messageText },
  };

  useEffect(() => {
    if (open && message) {
      // Initialize with default values
      const defaultSubject = buildSmartReplySubject(message);
      setSubject(defaultSubject);
      setMessageText('');
      setHtmlContent('');
      setVariables({
        senderName: message.name,
        senderEmail: message.email,
        senderPhone: message.phone,
        subject: message.subject,
        inquiryType: getInquiryTypeLabel(message.subject),
        orderNumber: message.orderNumber,
        messageContent: message.message,
        requestDate: formatGermanDate(message.createdAt),
        supportEmail: 'support@fixithub.com',
        supportPhone: '+49 30 40368895',
        companyName: 'McRepair.de',
      });
      setSent(false);
    }
  }, [open, message]);

  const handleInsertVariable = (varName: string) => {
    const placeholder = `{{${varName}}}`;
    const newText = messageText + placeholder;
    setMessageText(newText);
  };

  const handleApplyTemplate = () => {
    setHtmlContent(EMAIL_TEMPLATE);
    setViewMode('preview');
    toast({
      title: 'Erfolg',
      description: 'HTML-Template wurde geladen. Sie können es jetzt im HTML-Editor anpassen.',
    });
  };

  const handleSendReply = async (draft: boolean = false) => {
    if (!messageText.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie eine Antwortnachricht ein.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // Replace variables in message text
      const resolvedReplyMessage = substituteTemplateVariables(
        messageText,
        variables
      );

      const templateVariables: Record<string, unknown> = {
        ...variables,
        replyMessage: resolvedReplyMessage,
        replyMessageHtml: escapeHtml(resolvedReplyMessage).replace(/\n/g, '<br />'),
        originalMessageHtml: escapeHtml(String(variables.messageContent || '')).replace(/\n/g, '<br />'),
      };

      const finalMessage = substituteTemplateVariables(
        resolvedReplyMessage,
        templateVariables
      );
      const finalHtml = htmlContent
        ? substituteTemplateVariables(htmlContent, templateVariables)
        : '';

      await sendContactMessageReply(message!._id, {
        subject: subject || `Re: Kontaktanfrage`,
        message: finalMessage,
        htmlContent: finalHtml,
        variables,
        draft,
      });

      toast({
        title: 'Erfolg',
        description: draft
          ? 'Antwort als Entwurf gespeichert.'
          : 'Antwort erfolgreich versendet.',
      });

      setSent(true);
      setTimeout(() => {
        onReplySuccess();
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      toast({
        title: 'Fehler',
        description:
          error instanceof Error
            ? error.message
            : 'Fehler beim Senden der Antwort.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Antwort auf Kontaktanfrage</DialogTitle>
          <DialogDescription>
            <span className="text-sm">
              Anfrage von <strong>{message.name}</strong> ({message.email})
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="space-y-6 pr-4">
            {/* Original Message */}
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-sm mb-2">Originale Anfrage:</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                {message.message}
              </p>
            </div>

            {/* Reply Form */}
            <div className="space-y-4">
              {/* Subject */}
              <div>
                <Label htmlFor="reply-subject" className="text-sm font-medium">
                  Betreffzeile
                </Label>
                <Input
                  id="reply-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Re: Kontaktanfrage"
                  className="mt-1"
                />
              </div>

              {/* View Mode Toggle */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={viewMode === 'editor' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('editor')}
                >
                  Text Editor
                </Button>
                <Button
                  variant={viewMode === 'html' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('html')}
                  className="gap-2"
                >
                  <Code className="w-4 h-4" />
                  HTML
                </Button>
                <Button
                  variant={viewMode === 'preview' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('preview')}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Vorschau
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyTemplate}
                  className="gap-2 ml-auto"
                >
                  <Plus className="w-4 h-4" />
                  Template laden
                </Button>
              </div>

              {/* Editor Mode */}
              {viewMode === 'editor' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">Nachricht</Label>
                    <span className="text-xs text-gray-500">
                      {messageText.length} Zeichen
                    </span>
                  </div>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Geben Sie Ihre Antwort ein. Sie können Variablen wie {{senderName}} verwenden."
                    className="min-h-64 font-mono text-sm"
                  />

                  {/* Variable Insertion */}
                  <div>
                    <Label className="text-xs font-medium block mb-2">
                      Verfügbare Variablen:
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(CONTACT_MESSAGE_VARIABLES).map(([key, varInfo]: any) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleInsertVariable(key)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {varInfo.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* HTML Mode */}
              {viewMode === 'html' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">HTML Inhalt</Label>
                  <Textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    placeholder="Geben Sie benutzerdefinierten HTML-Inhalt ein (optional)"
                    className="min-h-64 font-mono text-sm"
                  />
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Der HTML-Inhalt wird bevorzugt, wenn er vorhanden ist. Der Text oben wird als Fallback verwendet.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Preview Mode */}
              {viewMode === 'preview' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Vorschau</Label>
                  <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 min-h-64 max-h-64 overflow-auto">
                    {htmlContent ? (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: substituteTemplateVariables(htmlContent, {
                            ...variables,
                            replyMessage: substituteTemplateVariables(messageText, variables),
                            replyMessageHtml: escapeHtml(substituteTemplateVariables(messageText, variables)).replace(/\n/g, '<br />'),
                            originalMessageHtml: escapeHtml(String(variables.messageContent || '')).replace(/\n/g, '<br />'),
                          }),
                        }}
                        className="prose dark:prose-invert prose-sm max-w-none"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                        {messageText}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleSendReply(true)}
            disabled={loading || sent}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Als Entwurf speichern
          </Button>
          <Button
            onClick={() => handleSendReply(false)}
            disabled={loading || sent}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sent ? 'Versendet' : 'Senden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
