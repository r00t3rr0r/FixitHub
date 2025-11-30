import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Calendar,
  DollarSign,
  Eye,
  Download,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCustomerInvoices, getInvoiceStats, markInvoiceAsViewed, Invoice } from "@/api/invoices";
import { useToast } from "@/hooks/useToast";

export function CustomerInvoices() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      console.log('CustomerInvoices: Fetching invoices with status filter:', statusFilter);

      const filters: any = {};
      if (statusFilter !== "all") {
        filters.status = statusFilter;
      }

      const response = await getCustomerInvoices(filters);
      console.log('CustomerInvoices: Received invoices:', response.invoices?.length);

      setInvoices(response.invoices || []);
    } catch (error: any) {
      console.error('CustomerInvoices: Error fetching invoices:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('invoices.errorFetchingInvoices'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      console.log('CustomerInvoices: Fetching invoice statistics');
      const response = await getInvoiceStats();
      console.log('CustomerInvoices: Received stats:', response.stats);
      setStats(response.stats);
    } catch (error: any) {
      console.error('CustomerInvoices: Error fetching stats:', error);
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      console.log('CustomerInvoices: Viewing invoice:', invoice._id);
      setSelectedInvoice(invoice);
      setShowInvoiceDialog(true);

      // Mark as viewed if it was sent
      if (invoice.status === 'sent') {
        await markInvoiceAsViewed(invoice._id);
        // Update local state
        setInvoices((prev) =>
          prev.map((inv) =>
            inv._id === invoice._id ? { ...inv, status: 'viewed' as const } : inv
          )
        );
      }
    } catch (error: any) {
      console.error('CustomerInvoices: Error marking invoice as viewed:', error);
    }
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    // This would typically trigger a PDF download
    console.log('CustomerInvoices: Downloading invoice:', invoice.invoiceNumber);
    toast({
      title: t('common.success'),
      description: t('invoices.downloadStarted'),
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'sent':
      case 'viewed':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'draft':
        return 'outline';
      case 'cancelled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out;
        }

        .stagger-item {
          animation: fadeInUp 0.5s ease-out;
        }

        .stagger-item:nth-child(1) { animation-delay: 0s; }
        .stagger-item:nth-child(2) { animation-delay: 0.1s; }
        .stagger-item:nth-child(3) { animation-delay: 0.2s; }
        .stagger-item:nth-child(4) { animation-delay: 0.3s; }
        .stagger-item:nth-child(5) { animation-delay: 0.4s; }
      `}</style>

      <div className="space-y-6 animate-fade-in-up">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('invoices.myInvoices')}</h1>
            <p className="text-muted-foreground">{t('invoices.manageYourInvoices')}</p>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="stagger-item">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('invoices.totalInvoices')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            </CardContent>
            </Card>

            <Card className="stagger-item">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('invoices.totalAmount')}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalAmount?.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>

            <Card className="stagger-item">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('invoices.unpaid')}</CardTitle>
                <TrendingUp className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.unpaidAmount?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.unpaidInvoices} {t('invoices.invoices')}
              </p>
              </CardContent>
            </Card>

            <Card className="stagger-item">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('invoices.overdue')}</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.overdueInvoices}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="stagger-item">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('common.filter')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('invoices.searchByInvoiceNumber')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.status')}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.selectStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="draft">{t('invoiceStatus.draft')}</SelectItem>
                  <SelectItem value="sent">{t('invoiceStatus.sent')}</SelectItem>
                  <SelectItem value="viewed">{t('invoiceStatus.viewed')}</SelectItem>
                  <SelectItem value="paid">{t('invoiceStatus.paid')}</SelectItem>
                  <SelectItem value="overdue">{t('invoiceStatus.overdue')}</SelectItem>
                  <SelectItem value="cancelled">{t('invoiceStatus.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        {filteredInvoices.length === 0 ? (
          <Card className="stagger-item">
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">{t('invoices.noInvoices')}</h3>
              <p className="text-muted-foreground">{t('invoices.noInvoicesDescription')}</p>
            </div>
          </CardContent>
          </Card>
        ) : (
          <Card className="stagger-item">
          <CardHeader>
            <CardTitle>{t('invoices.invoiceList')}</CardTitle>
            <CardDescription>
              {t('invoices.viewAndManageInvoices')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoices.invoiceNumber')}</TableHead>
                  <TableHead>{t('invoices.date')}</TableHead>
                  <TableHead>{t('invoices.dueDate')}</TableHead>
                  <TableHead>{t('invoices.amount')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice._id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className={new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' ? 'text-red-600 font-medium' : ''}>
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${invoice.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invoice.status)} className="flex items-center gap-1 w-fit">
                        {getStatusIcon(invoice.status)}
                        {t(`invoiceStatus.${invoice.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {t('common.view')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {t('common.download')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Invoice Details Dialog */}
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('invoices.invoiceDetails')}</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">{t('invoices.invoiceNumber')}</h3>
                  <p className="text-lg font-medium">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">{t('common.status')}</h3>
                  <Badge variant={getStatusBadgeVariant(selectedInvoice.status)} className="mt-1">
                    {t(`invoiceStatus.${selectedInvoice.status}`)}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">{t('invoices.issueDate')}</h3>
                  <p>{new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">{t('invoices.dueDate')}</h3>
                  <p className={new Date(selectedInvoice.dueDate) < new Date() && selectedInvoice.status !== 'paid' ? 'text-red-600 font-medium' : ''}>
                    {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="font-semibold mb-3">{t('invoices.items')}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('invoices.description')}</TableHead>
                      <TableHead className="text-right">{t('invoices.quantity')}</TableHead>
                      <TableHead className="text-right">{t('invoices.unitPrice')}</TableHead>
                      <TableHead className="text-right">{t('invoices.total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items.map((item) => (
                      <TableRow key={item._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.description}</p>
                            <Badge variant="outline" className="mt-1">{item.type}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">${item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('invoices.subtotal')}</span>
                  <span className="font-medium">${selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                {selectedInvoice.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('invoices.tax')}</span>
                    <span className="font-medium">${selectedInvoice.tax.toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t('invoices.discount')}</span>
                    <span>-${selectedInvoice.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>{t('invoices.total')}</span>
                  <span>${selectedInvoice.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div>
                  <h3 className="font-semibold mb-2">{t('invoices.notes')}</h3>
                  <p className="text-muted-foreground">{selectedInvoice.notes}</p>
                </div>
              )}

              {/* Payment Terms */}
              <div className="text-sm text-muted-foreground">
                <p>{t('invoices.paymentTerms')}: {selectedInvoice.paymentTerms}</p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleDownloadInvoice(selectedInvoice)}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('common.download')}
                </Button>
                {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                  <Button onClick={() => toast({ title: t('invoices.paymentComingSoon') })}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    {t('invoices.payNow')}
                  </Button>
                )}
              </div>
            </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
