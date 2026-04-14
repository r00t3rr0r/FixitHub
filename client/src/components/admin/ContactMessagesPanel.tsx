import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export function ContactMessagesPanel() {
  const { toast } = useToast();

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

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [searchTerm, statusFilter, page]);

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
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Fehler beim Laden der Kontaktanfrage.',
        variant: 'destructive',
      });
    }
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

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {stats.new}
                </div>
                <p className="text-xs text-gray-500 mt-1">Neue Anfragen</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {stats.total}
                </div>
                <p className="text-xs text-gray-500 mt-1">Gesamt</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {stats.replied}
                </div>
                <p className="text-xs text-gray-500 mt-1">Beantwortet</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">
                  {stats.closed}
                </div>
                <p className="text-xs text-gray-500 mt-1">Geschlossen</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Kontaktanfragen
          </CardTitle>
          <CardDescription>
            Verwaltung aller Kontaktformular-Anfragen mit Antwortfunktion
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-col md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Suchen nach Name, Email, Nachricht..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Nach Status filtern" />
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

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Keine Kontaktanfragen gefunden.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Abgesendet</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Anliegen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow key={message._id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <TableCell className="text-xs text-gray-500">
                        {new Date(message.createdAt).toLocaleDateString('de-DE')}
                      </TableCell>
                      <TableCell className="font-medium">{message.name}</TableCell>
                      <TableCell className="text-sm">{message.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {SUBJECT_LABELS[message.subject] || message.subject}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[message.status]}>
                          {STATUS_LABELS[message.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(message)}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden md:inline">Öffnen</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-600">
                Seite {page} von {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Zurück
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Weiter
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      {selectedMessage && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Kontaktanfrage Details</DialogTitle>
              <DialogDescription>
                {selectedMessage.messageNumber}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 overflow-hidden">
              <div className="space-y-4 pr-4">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
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
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-sm mb-2">Nachricht:</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
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
                          className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800"
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
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
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
