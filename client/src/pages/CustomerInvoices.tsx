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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-amber-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="h-8 w-8 text-[#f5b800]" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('invoices.myInvoices')}</h1>
            </div>
            <p className="text-blue-100 text-base md:text-lg">{t('invoices.manageYourInvoices')}</p>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.totalInvoices')}</CardTitle>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#1a2a5e] to-[#2a3f7e] flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-3xl font-extrabold text-[#1a2a5e]">{stats.totalInvoices}</div>
                <p className="text-sm text-slate-500 mt-1">Alle Rechnungen</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.totalAmount')}</CardTitle>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-3xl font-extrabold text-[#1a2a5e]">${stats.totalAmount?.toFixed(2) || '0.00'}</div>
                <p className="text-sm text-slate-500 mt-1">Gesamtbetrag</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.unpaid')}</CardTitle>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#f5b800] to-[#e5ab00] flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-3xl font-extrabold text-[#f5b800]">${stats.unpaidAmount?.toFixed(2) || '0.00'}</div>
                <p className="text-sm text-slate-500 mt-1">
                  {stats.unpaidInvoices} {t('invoices.invoices')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.overdue')}</CardTitle>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-3xl font-extrabold text-red-600">{stats.overdueInvoices}</div>
                <p className="text-sm text-slate-500 mt-1">Überfällige Rechnungen</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="border-none shadow-lg bg-white">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[#1a2a5e]">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#f5b800] to-[#e5ab00] flex items-center justify-center flex-shrink-0">
                  <Filter className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-sm uppercase tracking-wide whitespace-nowrap">{t('common.filter')}</span>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('invoices.searchByInvoiceNumber')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]"
                  />
                </div>
              </div>
              <div className="min-w-[180px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]">
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
          <Card className="border-none shadow-lg bg-white">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
                  <FileText className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-[#1a2a5e] mb-2">{t('invoices.noInvoices')}</h3>
                <p className="text-slate-500 text-base">{t('invoices.noInvoicesDescription')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-[#1a2a5e]">{t('invoices.invoiceList')}</CardTitle>
              <CardDescription className="text-base text-slate-500">
                {t('invoices.viewAndManageInvoices')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50 border-b-2 border-slate-200">
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('invoices.invoiceNumber')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('invoices.date')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('invoices.dueDate')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('invoices.amount')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('common.status')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice._id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-bold text-base text-[#1a2a5e] py-5">{invoice.invoiceNumber}</TableCell>
                        <TableCell className="text-base text-slate-600 py-5">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-5">
                          <span className={new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' ? 'text-red-600 font-bold text-base' : 'text-base text-slate-600'}>
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold text-base text-[#1a2a5e] py-5">
                          ${invoice.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-5">
                          <Badge variant={getStatusBadgeVariant(invoice.status)} className="flex items-center gap-1.5 w-fit text-sm px-3 py-1.5 font-semibold">
                            {getStatusIcon(invoice.status)}
                            {t(`invoiceStatus.${invoice.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewInvoice(invoice)}
                              className="h-10 text-sm px-4 border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white transition-colors font-semibold"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {t('common.view')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadInvoice(invoice)}
                              className="h-10 text-sm px-4 border-[#f5b800] text-[#f5b800] hover:bg-[#f5b800] hover:text-white transition-colors font-semibold"
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Details Dialog */}
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader className="border-b border-slate-100 pb-4">
              <DialogTitle className="text-2xl font-bold text-[#1a2a5e] flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#1a2a5e] to-[#2a3f7e] flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                {t('invoices.invoiceDetails')}
              </DialogTitle>
              <DialogDescription className="text-base text-slate-500">
                {selectedInvoice?.invoiceNumber}
              </DialogDescription>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-6 pt-4">
                {/* Invoice Header */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wide">{t('invoices.invoiceNumber')}</h3>
                    <p className="text-lg font-bold text-[#1a2a5e]">{selectedInvoice.invoiceNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wide">{t('common.status')}</h3>
                    <Badge variant={getStatusBadgeVariant(selectedInvoice.status)} className="text-sm font-semibold px-3 py-1">
                      {t(`invoiceStatus.${selectedInvoice.status}`)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wide">{t('invoices.issueDate')}</h3>
                    <p className="text-base font-semibold text-slate-700">{new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wide">{t('invoices.dueDate')}</h3>
                    <p className={new Date(selectedInvoice.dueDate) < new Date() && selectedInvoice.status !== 'paid' ? 'text-red-600 font-bold text-base' : 'text-base font-semibold text-slate-700'}>
                      {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                    <h3 className="font-bold text-base text-[#1a2a5e]">{t('invoices.items')}</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-slate-50 border-b border-slate-200">
                        <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.description')}</TableHead>
                        <TableHead className="text-right text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.quantity')}</TableHead>
                        <TableHead className="text-right text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.unitPrice')}</TableHead>
                        <TableHead className="text-right text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.total')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.items.map((item) => (
                        <TableRow key={item._id} className="hover:bg-slate-50">
                          <TableCell className="py-4">
                            <div>
                              <p className="font-bold text-base text-slate-700">{item.description}</p>
                              <Badge variant="outline" className="mt-1.5 text-xs font-semibold border-[#f5b800] text-[#f5b800]">{item.type}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-base font-semibold text-slate-700 py-4">{item.quantity}</TableCell>
                          <TableCell className="text-right text-base font-semibold text-slate-700 py-4">${item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-base text-[#1a2a5e] py-4">${item.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="space-y-3 border-t-2 border-slate-200 pt-4">
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-slate-600">{t('invoices.subtotal')}</span>
                    <span className="font-bold text-slate-700">${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.tax > 0 && (
                    <div className="flex justify-between text-base">
                      <span className="font-semibold text-slate-600">{t('invoices.tax')}</span>
                      <span className="font-bold text-slate-700">${selectedInvoice.tax.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 text-base">
                      <span className="font-semibold">{t('invoices.discount')}</span>
                      <span className="font-bold">-${selectedInvoice.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-extrabold border-t-2 border-slate-200 pt-3">
                    <span className="text-[#1a2a5e]">{t('invoices.total')}</span>
                    <span className="text-[#1a2a5e]">${selectedInvoice.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Notes */}
                {selectedInvoice.notes && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-bold mb-2 text-base text-[#1a2a5e]">{t('invoices.notes')}</h3>
                    <p className="text-slate-600 text-base leading-relaxed">{selectedInvoice.notes}</p>
                  </div>
                )}

                {/* Payment Terms */}
                <div className="text-sm text-slate-500 bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="font-semibold">{t('invoices.paymentTerms')}: {selectedInvoice.paymentTerms}</p>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                  <Button 
                    variant="outline" 
                    onClick={() => handleDownloadInvoice(selectedInvoice)} 
                    className="h-12 text-base px-6 border-slate-300 hover:border-slate-400 font-semibold"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    {t('common.download')}
                  </Button>
                  {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                    <Button 
                      onClick={() => toast({ title: t('invoices.paymentComingSoon') })} 
                      className="h-12 text-base px-6 bg-gradient-to-r from-[#f5b800] to-[#e5ab00] hover:from-[#e5ab00] hover:to-[#d9a400] text-white font-bold shadow-lg"
                    >
                      <DollarSign className="h-5 w-5 mr-2" />
                      {t('invoices.payNow')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
