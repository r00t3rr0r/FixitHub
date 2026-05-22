import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import {
  getContactMessages,
  getContactMessageStats,
  getContactMessageById,
  updateContactMessageStatus,
  deleteContactMessage,
  ContactMessage,
  ContactMessageStats,
} from '@/api/contactMessages';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Mail,
  Search,
  Filter,
  Clock,
  CheckCircle,
  Archive,
  MessageSquare,
  Trash2,
  Eye,
  Loader2,
} from 'lucide-react';
import { ContactMessageReplyDialog } from './ContactMessageReplyDialog';

const SUBJECT_LABELS: Record<string, string> = {
  repair: 'Reparaturanfrage',
  status: 'Statusanfrage',
  business: 'Geschäftliche Anfrage',
  complaint: 'Reklamation',
  other: 'Sonstige',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  read: 'Gelesen',
  replied: 'Beantwortet',
  closed: 'Geschlossen',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500 text-white',
  read: 'bg-yellow-500 text-white',
  replied: 'bg-green-500 text-white',
  closed: 'bg-gray-500 text-white',
};

const STATUS_CLASSNAMES: Record<string, string> = {
  new: 'status-reviewing',
  read: 'status-pending',
  replied: 'status-approved',
  closed: 'status-rejected',
};

export function ContactMessagesPanel() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [stats, setStats] = useState<ContactMessageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [totalPages, setTotalPages] = useState(1);

  // Dialog states
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastHandledMessageId, setLastHandledMessageId] = useState<string | null>(null);

  const queryMessageId = searchParams.get('messageId');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [searchTerm, statusFilter, page]);

  useEffect(() => {
    if (!queryMessageId || queryMessageId === lastHandledMessageId) return;

    const openMessageFromQuery = async () => {
      try {
        const fullMessage = await getContactMessageById(queryMessageId);
        setSelectedMessage(fullMessage);
        setShowDetailsDialog(true);
      } catch (error) {
        toast({
          title: 'Fehler',
          description: 'Die verlinkte Kontaktanfrage konnte nicht geladen werden.',
          variant: 'destructive',
        });
      } finally {
        setLastHandledMessageId(queryMessageId);
      }
    };

    openMessageFromQuery();
  }, [queryMessageId, lastHandledMessageId, toast]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [messagesData, statsData] = await Promise.all([
        getContactMessages({ page: 1, limit }),
        getContactMessageStats(),
      ]);

      setMessages(messagesData.messages);
      setTotalPages(messagesData.totalPages);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Abrufen von Kontaktanfragen.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const data = await getContactMessages({
        search: searchTerm,
        status: statusFilter === 'all' ? '' : statusFilter,
        page,
        limit,
      });

      setMessages(data.messages);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Abrufen von Kontaktanfragen.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (message: ContactMessage) => {
    try {
      const fullMessage = await getContactMessageById(message._id);
      setSelectedMessage(fullMessage);
      setShowDetailsDialog(true);
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        nextParams.set('messageId', message._id);
        return nextParams;
      }, { replace: true });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Fehler beim Laden der Kontaktanfrage.',
        variant: 'destructive',
      });
    }
  };

  const handleDetailsDialogOpenChange = (open: boolean) => {
    setShowDetailsDialog(open);
    if (open) return;

    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.delete('messageId');
      return nextParams;
    }, { replace: true });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedMessage) return;

    try {
      setActionLoading(true);
      const updated = await updateContactMessageStatus(
        selectedMessage._id,
        newStatus as any
      );
      setSelectedMessage(updated);

      // Update list
      setMessages(prev =>
        prev.map(m => (m._id === updated._id ? updated : m))
      );

      toast({
        title: 'Erfolg',
        description: 'Status aktualisiert.',
      });

      // Refresh stats
      const statsData = await getContactMessageStats();
      setStats(statsData);
    } catch (error) {
      toast({
        title: 'Fehler',
        description:
          error instanceof Error
            ? error.message
            : 'Fehler beim Aktualisieren des Status.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;

    try {
      setActionLoading(true);
      await deleteContactMessage(selectedMessage._id);

      toast({
        title: 'Erfolg',
        description: 'Kontaktanfrage gelöscht.',
      });

      setShowDeleteDialog(false);
      setShowDetailsDialog(false);
      setSelectedMessage(null);
      fetchMessages();

      // Refresh stats
      const statsData = await getContactMessageStats();
      setStats(statsData);
    } catch (error) {
      toast({
        title: 'Fehler',
        description:
          error instanceof Error
            ? error.message
            : 'Fehler beim Löschen der Kontaktanfrage.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="repair-requests-management">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p style={{ color: 'var(--gray-500)', fontSize: '1.1rem', fontWeight: 500 }}>
            Lade Kontaktanfragen...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="repair-requests-management">
      <div className="space-y-4 mt-4">
        <div className="repair-requests-header">
          <h1>
            <Mail className="h-6 w-6" />
            Kontaktanfragen
          </h1>
          <p>Kontaktformular-Anfragen mit Status und Antwortfunktion verwalten</p>
        </div>

        {stats && (
          <div className="stats-grid">
            <div className="stat-card stat-total">
              <div className="stat-card-header">
                <div className="stat-card-title">Gesamt</div>
                <div className="stat-card-icon">
                  <MessageSquare className="h-5 w-5" />
                </div>
              </div>
              <div className="stat-card-value">{stats.total}</div>
            </div>

            <div className="stat-card stat-reviewing">
              <div className="stat-card-header">
                <div className="stat-card-title">Neu</div>
                <div className="stat-card-icon">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <div className="stat-card-value">{stats.new}</div>
            </div>

            <div className="stat-card stat-converted">
              <div className="stat-card-header">
                <div className="stat-card-title">Beantwortet</div>
                <div className="stat-card-icon">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
              <div className="stat-card-value">{stats.replied}</div>
            </div>

            <div className="stat-card stat-closed">
              <div className="stat-card-header">
                <div className="stat-card-title">Geschlossen</div>
                <div className="stat-card-icon">
                  <Archive className="h-5 w-5" />
                </div>
              </div>
              <div className="stat-card-value">{stats.closed}</div>
            </div>
          </div>
        )}

        <div className="filter-card">
          <div className="filter-container">
            <div className="search-wrapper">
              <Search />
              <Input
                placeholder="Suchen nach Name, Email, Nachricht..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="search-input"
              />
            </div>

            <div className="filter-row">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[200px] bg-white border-2 border-[var(--gray-200)] h-9 text-xs">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-[var(--gray-500)]" />
                    <SelectValue placeholder="Nach Status filtern" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="new">Neu</SelectItem>
                  <SelectItem value="read">Gelesen</SelectItem>
                  <SelectItem value="replied">Beantwortet</SelectItem>
                  <SelectItem value="closed">Geschlossen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="requests-table-card">
          <div className="requests-table-header">
            <h3 className="requests-table-title">Kontaktanfragen</h3>
            <p className="requests-table-description">Alle eingehenden Kontaktanfragen im Überblick</p>
          </div>

          <div className="requests-table-content">
            {loading ? (
              <div className="loading-state">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                <MessageSquare />
                <p>Keine Kontaktanfragen gefunden.</p>
              </div>
            ) : (
              <div className="requests-table-wrapper">
                <table className="requests-table contact-requests-table">
                  <thead>
                    <tr>
                      <th>Nr./Datum</th>
                      <th>Absender</th>
                      <th>Email</th>
                      <th>Anliegen</th>
                      <th>Vorschau</th>
                      <th>Status</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((message) => (
                      <tr key={message._id} onClick={() => handleViewDetails(message)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="request-number">{message.messageNumber}</div>
                          <div className="request-date">
                            {new Date(message.createdAt).toLocaleDateString('de-DE')}
                          </div>
                        </td>
                        <td>
                          <div className="customer-info">
                            <div className="customer-avatar">{message.name.charAt(0).toUpperCase()}</div>
                            <div className="customer-details">
                              <div className="customer-name">{message.name}</div>
                              <div className="customer-email">{message.phone || 'Kein Telefon'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="customer-email contact-email-cell">{message.email}</div>
                        </td>
                        <td>
                          <Badge variant="outline" className="contact-subject-badge">
                            {SUBJECT_LABELS[message.subject] || message.subject}
                          </Badge>
                        </td>
                        <td>
                          <div className="issue-description">
                            {message.message}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${STATUS_CLASSNAMES[message.status] || 'status-pending'}`}>
                            {STATUS_LABELS[message.status]}
                          </span>
                        </td>
                        <td>
                          <button
                            className="actions-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleViewDetails(message);
                            }}
                          >
                            <span className="contact-open-action">
                              <Eye className="w-3.5 h-3.5" />
                              Öffnen
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="contact-pagination-row">
            <p className="request-date">
              Seite {page} von {totalPages}
            </p>
            <div className="contact-pagination-buttons">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Zurück
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Details Dialog */}
      {selectedMessage && (
        <Dialog open={showDetailsDialog} onOpenChange={handleDetailsDialogOpenChange}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col repair-request-details-dialog">
            <DialogHeader className="mcrepair-dialog-header">
              <DialogTitle className="mcrepair-dialog-title">Kontaktanfrage Details</DialogTitle>
              <DialogDescription className="mcrepair-dialog-description">{selectedMessage.messageNumber}</DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 overflow-hidden">
              <div className="space-y-4 pr-4">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-semibold">{selectedMessage.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-blue-600 break-all">
                      {selectedMessage.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Telefon</p>
                    <p className="font-semibold">
                      {selectedMessage.phone || 'Nicht angegeben'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Auftragsnummer</p>
                    <p className="font-semibold">
                      {selectedMessage.orderNumber || 'Keine'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Anliegen</p>
                    <p className="font-semibold">
                      {SUBJECT_LABELS[selectedMessage.subject]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <Badge className={STATUS_COLORS[selectedMessage.status]}>
                      {STATUS_LABELS[selectedMessage.status]}
                    </Badge>
                  </div>
                </div>

                {/* Message */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-sm mb-2">Nachricht:</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedMessage.message}
                  </p>
                </div>

                {/* Replies */}
                {selectedMessage.replies && selectedMessage.replies.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Antworten:</h4>
                    <div className="space-y-2">
                      {selectedMessage.replies.map((reply, idx) => (
                        <div
                          key={idx}
                          className="bg-green-50 p-4 rounded-lg border border-green-200"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-semibold text-sm">
                                {reply.repliedBy}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(reply.repliedAt).toLocaleString(
                                  'de-DE'
                                )}
                              </p>
                            </div>
                            <Badge variant="outline">{
                              reply.status === 'sent'
                                ? 'Versendet'
                                : reply.status === 'draft'
                                  ? 'Entwurf'
                                  : 'Fehler'
                            }</Badge>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {reply.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 flex-wrap">
              <Select value={selectedMessage.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Neu</SelectItem>
                  <SelectItem value="read">Gelesen</SelectItem>
                  <SelectItem value="replied">Beantwortet</SelectItem>
                  <SelectItem value="closed">Geschlossen</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={actionLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Löschen
              </Button>

              <Button
                onClick={() => setShowReplyDialog(true)}
                disabled={actionLoading}
                className="gap-2"
              >
                <Mail className="w-4 h-4" />
                Antworten
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reply Dialog */}
      <ContactMessageReplyDialog
        message={selectedMessage}
        open={showReplyDialog}
        onOpenChange={setShowReplyDialog}
        onReplySuccess={() => {
          setShowReplyDialog(false);
          fetchMessages();
          getContactMessageStats().then(setStats);
          if (selectedMessage) {
            getContactMessageById(selectedMessage._id).then(
              setSelectedMessage
            );
          }
        }}
      />

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kontaktanfrage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die
              Kontaktanfrage wird permanent gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
