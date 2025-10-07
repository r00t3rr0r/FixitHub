import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import {
  DollarSign,
  FileText,
  TrendingUp,
  Settings,
  RefreshCw,
  Send,
  CreditCard,
  Plus,
  Search,
  Calendar,
  Download,
  Eye,
  Mail,
  Globe,
  Shield,
  Zap,
  AlertTriangle
} from 'lucide-react';
import {
  getPayments,
  getInvoices,
  getFinancialReports,
  getPaymentGateways,
  updatePaymentGateway,
  processRefund,
  createInvoice,
  sendInvoice,
  searchCustomers,
  type Payment,
  type Invoice,
  type FinancialReport,
  type PaymentGateway,
  type CustomerSearchResult
} from '@/api/financial';

export function FinancialManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [customers, setCustomers] = useState<CustomerSearchResult[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [invoiceForm, setInvoiceForm] = useState({
    orderId: '',
    customerId: '',
    customerName: '',
    customerEmail: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, type: 'service' as const }],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    paymentTerms: 'Net 30'
  });

  // Available payment methods for different providers
  const availablePaymentMethods = {
    stripe: ['credit_card', 'debit_card', 'apple_pay', 'google_pay', 'sepa_debit', 'bank_transfer', 'klarna'],
    paypal: ['paypal', 'paypal_credit', 'venmo', 'pay_in_4'],
    square: ['credit_card', 'debit_card', 'apple_pay', 'google_pay', 'cash_app'],
    authorize_net: ['credit_card', 'debit_card', 'echeck', 'apple_pay', 'google_pay']
  };

  // Available countries
  const availableCountries = [
    'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'LU', 'GR', 'CY', 'MT', 'SI', 'SK', 'EE', 'LV', 'LT', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'JP', 'SG', 'HK', 'MY', 'TH', 'PH', 'IN', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'UY', 'NZ'
  ];

  // Available currencies
  const availableCurrencies = [
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'SGD', 'HKD', 'MYR', 'THB', 'PHP', 'INR', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'NZD'
  ];

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    console.log('Fetching financial data...');
    setLoading(true);
    try {
      const [paymentsData, invoicesData, reportData, gatewaysData] = await Promise.all([
        getPayments(),
        getInvoices(),
        getFinancialReports(),
        getPaymentGateways()
      ]);

      setPayments(paymentsData.payments || []);
      setInvoices(invoicesData.invoices || []);
      setReport(reportData.report);
      setGateways(gatewaysData.gateways || []);
    } catch (error: any) {
      console.error('Error fetching financial data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch financial data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedPayment || !refundAmount || !refundReason) {
      toast({
        title: 'Error',
        description: 'Please fill in all refund details',
        variant: 'destructive'
      });
      return;
    }

    try {
      await processRefund(selectedPayment._id, parseFloat(refundAmount), refundReason);
      toast({
        title: 'Success',
        description: 'Refund processed successfully'
      });
      setRefundDialogOpen(false);
      setRefundAmount('');
      setRefundReason('');
      setSelectedPayment(null);
      fetchFinancialData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process refund',
        variant: 'destructive'
      });
    }
  };

  const handleCreateInvoice = async () => {
    try {
      const invoiceData = {
        ...invoiceForm,
        items: invoiceForm.items.map(item => ({
          ...item,
          total: item.quantity * item.unitPrice
        })),
        subtotal: invoiceForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
        tax: invoiceForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 0.08,
        total: invoiceForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 1.08
      };

      await createInvoice(invoiceData);
      toast({
        title: 'Success',
        description: 'Invoice created successfully'
      });
      setInvoiceDialogOpen(false);
      fetchFinancialData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invoice',
        variant: 'destructive'
      });
    }
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    try {
      await sendInvoice(invoice._id);
      toast({
        title: 'Success',
        description: 'Invoice sent successfully'
      });
      fetchFinancialData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invoice',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateGateway = async () => {
    if (!selectedGateway) return;

    console.log('Updating gateway configuration:', selectedGateway._id);
    try {
      await updatePaymentGateway(selectedGateway._id, selectedGateway);
      toast({
        title: 'Success',
        description: 'Payment gateway configuration updated successfully'
      });
      setConfigDialogOpen(false);
      setSelectedGateway(null);
      fetchFinancialData();
    } catch (error: any) {
      console.error('Error updating gateway:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payment gateway',
        variant: 'destructive'
      });
    }
  };

  const searchCustomersHandler = async (query: string) => {
    if (query.length < 2) {
      setCustomers([]);
      return;
    }

    try {
      const result = await searchCustomers(query);
      setCustomers(result.customers || []);
    } catch (error: any) {
      console.error('Error searching customers:', error);
    }
  };

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    console.log(`Updating invoice item ${index}, field: ${field}, value: ${value}`);
    const updatedItems = [...invoiceForm.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    console.log(`Updated item ${index}:`, updatedItems[index]);
    
    const updatedForm = { ...invoiceForm, items: updatedItems };
    console.log('New invoice form state:', updatedForm);
    setInvoiceForm(updatedForm);
  };

  const handlePaymentMethodToggle = (method: string, checked: boolean) => {
    if (!selectedGateway) return;

    const updatedMethods = checked
      ? [...selectedGateway.supportedMethods, method]
      : selectedGateway.supportedMethods.filter(m => m !== method);

    setSelectedGateway({
      ...selectedGateway,
      supportedMethods: updatedMethods
    });
  };

  const handleCountryToggle = (country: string, checked: boolean) => {
    if (!selectedGateway) return;

    const updatedCountries = checked
      ? [...selectedGateway.countries, country]
      : selectedGateway.countries.filter(c => c !== country);

    setSelectedGateway({
      ...selectedGateway,
      countries: updatedCountries
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Management</h1>
          <p className="text-muted-foreground">
            Manage payments, invoices, reports, and payment gateway configurations
          </p>
        </div>
        <Button onClick={fetchFinancialData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments">Payment Processing</TabsTrigger>
          <TabsTrigger value="invoices">Invoice Management</TabsTrigger>
          <TabsTrigger value="reports">Financial Reports</TabsTrigger>
          <TabsTrigger value="configuration">Payment Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Transactions</CardTitle>
              <CardDescription>
                View and manage all payment transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell className="font-mono">{payment.transactionId}</TableCell>
                      <TableCell>{payment.customerName}</TableCell>
                      <TableCell>${payment.amount.toFixed(2)}</TableCell>
                      <TableCell className="capitalize">{payment.paymentMethod.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <Badge variant={
                          payment.status === 'completed' ? 'default' :
                          payment.status === 'pending' ? 'secondary' :
                          payment.status === 'failed' ? 'destructive' : 'outline'
                        }>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {payment.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setRefundDialogOpen(true);
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Invoice Management</h2>
            <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                  <DialogDescription>
                    Create a new invoice for a customer
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer-search">Customer</Label>
                      <div className="relative">
                        <Input
                          id="customer-search"
                          placeholder="Search customers..."
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value);
                            searchCustomersHandler(e.target.value);
                          }}
                        />
                        {customers.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {customers.map((customer) => (
                              <div
                                key={customer._id}
                                className="p-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() => {
                                  setInvoiceForm({
                                    ...invoiceForm,
                                    customerId: customer._id,
                                    customerName: customer.name,
                                    customerEmail: customer.email
                                  });
                                  setCustomerSearch(customer.name);
                                  setCustomers([]);
                                }}
                              >
                                <div className="font-medium">{customer.name}</div>
                                <div className="text-sm text-gray-500">{customer.email}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="due-date">Due Date</Label>
                      <Input
                        id="due-date"
                        type="date"
                        value={invoiceForm.dueDate}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Invoice Items</Label>
                    {invoiceForm.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-5 gap-2 p-4 border rounded-lg">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                        />
                        <Input
                          type="number"
                          placeholder="Quantity"
                          value={item.quantity}
                          onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Unit Price"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const value = e.target.value;
                            console.log(`Unit price input changed for item ${index}: ${value}`);
                            const parsedValue = parseFloat(value) || 0;
                            console.log(`Parsed unit price value: ${parsedValue}`);
                            updateInvoiceItem(index, 'unitPrice', parsedValue);
                          }}
                        />
                        <Select
                          value={item.type}
                          onValueChange={(value) => updateInvoiceItem(index, 'type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="service">Service</SelectItem>
                            <SelectItem value="addon">Add-on</SelectItem>
                            <SelectItem value="product">Product</SelectItem>
                            <SelectItem value="fee">Fee</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center">
                          <span className="text-sm font-medium">
                            ${(item.quantity * item.unitPrice).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setInvoiceForm({
                          ...invoiceForm,
                          items: [...invoiceForm.items, { description: '', quantity: 1, unitPrice: 0, type: 'service' }]
                        });
                      }}
                    >
                      Add Item
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment-terms">Payment Terms</Label>
                      <Select
                        value={invoiceForm.paymentTerms}
                        onValueChange={(value) => setInvoiceForm({ ...invoiceForm, paymentTerms: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 60">Net 60</SelectItem>
                          <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Additional notes..."
                        value={invoiceForm.notes}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateInvoice}>Create Invoice</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice._id}>
                      <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.customerName}</TableCell>
                      <TableCell>${invoice.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          invoice.status === 'paid' ? 'default' :
                          invoice.status === 'sent' ? 'secondary' :
                          invoice.status === 'overdue' ? 'destructive' : 'outline'
                        }>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {(invoice.status === 'draft' || invoice.status === 'sent') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendInvoice(invoice)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          {report && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${report.totalRevenue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    {report.period}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${report.netProfit.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    {report.grossMargin}% margin
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Add-on Revenue</CardTitle>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${report.addonRevenue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    {((report.addonRevenue / report.totalRevenue) * 100).toFixed(1)}% of total
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Refunds & Disputes</CardTitle>
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${(report.refundAmount + report.disputeAmount).toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    {(((report.refundAmount + report.disputeAmount) / report.totalRevenue) * 100).toFixed(1)}% of revenue
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Gateway Configuration</CardTitle>
              <CardDescription>
                Manage payment gateway settings and configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gateway Name</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processing Fee</TableHead>
                    <TableHead>Supported Methods</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gateways.map((gateway) => (
                    <TableRow key={gateway._id}>
                      <TableCell className="font-medium">{gateway.name}</TableCell>
                      <TableCell className="capitalize">{gateway.provider}</TableCell>
                      <TableCell>
                        <Badge variant={gateway.isActive ? 'default' : 'secondary'}>
                          {gateway.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{gateway.configuration.processingFee}%</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {gateway.supportedMethods.slice(0, 2).map((method) => (
                            <Badge key={method} variant="outline" className="text-xs">
                              {method.replace('_', ' ')}
                            </Badge>
                          ))}
                          {gateway.supportedMethods.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{gateway.supportedMethods.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Dialog open={configDialogOpen && selectedGateway?._id === gateway._id} onOpenChange={(open) => {
                          console.log('Configuration dialog state changed:', open, 'for gateway:', gateway._id);
                          setConfigDialogOpen(open);
                          if (!open) {
                            setSelectedGateway(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                console.log('Settings icon clicked for gateway:', gateway._id);
                                setSelectedGateway(gateway);
                                setConfigDialogOpen(true);
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Configure {gateway.name}
                              </DialogTitle>
                              <DialogDescription>
                                Complete payment gateway configuration with all available options
                              </DialogDescription>
                            </DialogHeader>
                            {selectedGateway && (
                              <div className="space-y-6">
                                {/* Basic Configuration */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Settings className="h-4 w-4" />
                                    <h3 className="text-lg font-semibold">Basic Configuration</h3>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="gateway-name">Gateway Name</Label>
                                      <Input
                                        id="gateway-name"
                                        value={selectedGateway.name}
                                        onChange={(e) => setSelectedGateway({
                                          ...selectedGateway,
                                          name: e.target.value
                                        })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="provider">Provider</Label>
                                      <Select
                                        value={selectedGateway.provider}
                                        onValueChange={(value: any) => setSelectedGateway({
                                          ...selectedGateway,
                                          provider: value
                                        })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="stripe">Stripe</SelectItem>
                                          <SelectItem value="paypal">PayPal</SelectItem>
                                          <SelectItem value="square">Square</SelectItem>
                                          <SelectItem value="authorize_net">Authorize.Net</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="processing-fee">Processing Fee (%)</Label>
                                      <Input
                                        id="processing-fee"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="10"
                                        value={selectedGateway.configuration.processingFee}
                                        onChange={(e) => setSelectedGateway({
                                          ...selectedGateway,
                                          configuration: {
                                            ...selectedGateway.configuration,
                                            processingFee: parseFloat(e.target.value) || 0
                                          }
                                        })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="currency">Default Currency</Label>
                                      <Select
                                        value={selectedGateway.configuration.currency}
                                        onValueChange={(value) => setSelectedGateway({
                                          ...selectedGateway,
                                          configuration: {
                                            ...selectedGateway.configuration,
                                            currency: value
                                          }
                                        })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableCurrencies.map((currency) => (
                                            <SelectItem key={currency} value={currency}>
                                              {currency}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>

                                <Separator />

                                {/* API Configuration */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4" />
                                    <h3 className="text-lg font-semibold">API Configuration</h3>
                                  </div>
                                  <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="public-key">Public Key / Client ID</Label>
                                      <Input
                                        id="public-key"
                                        value={selectedGateway.configuration.publicKey || ''}
                                        onChange={(e) => setSelectedGateway({
                                          ...selectedGateway,
                                          configuration: {
                                            ...selectedGateway.configuration,
                                            publicKey: e.target.value
                                          }
                                        })}
                                        placeholder="Enter your public key or client ID"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="secret-key">Secret Key / Client Secret</Label>
                                      <Input
                                        id="secret-key"
                                        type="password"
                                        value={selectedGateway.configuration.secretKey || ''}
                                        onChange={(e) => setSelectedGateway({
                                          ...selectedGateway,
                                          configuration: {
                                            ...selectedGateway.configuration,
                                            secretKey: e.target.value
                                          }
                                        })}
                                        placeholder="Enter your secret key or client secret"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="webhook-url">Webhook URL</Label>
                                      <Input
                                        id="webhook-url"
                                        value={selectedGateway.configuration.webhookUrl || ''}
                                        onChange={(e) => setSelectedGateway({
                                          ...selectedGateway,
                                          configuration: {
                                            ...selectedGateway.configuration,
                                            webhookUrl: e.target.value
                                          }
                                        })}
                                        placeholder="https://your-domain.com/webhooks/payment"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <Separator />

                                {/* Payment Methods */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    <h3 className="text-lg font-semibold">Supported Payment Methods</h3>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    {availablePaymentMethods[selectedGateway.provider as keyof typeof availablePaymentMethods]?.map((method) => (
                                      <div key={method} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`method-${method}`}
                                          checked={selectedGateway.supportedMethods.includes(method)}
                                          onCheckedChange={(checked) => handlePaymentMethodToggle(method, checked as boolean)}
                                        />
                                        <Label htmlFor={`method-${method}`} className="capitalize">
                                          {method.replace('_', ' ')}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <Separator />

                                {/* Supported Countries */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    <h3 className="text-lg font-semibold">Supported Countries</h3>
                                  </div>
                                  <div className="grid grid-cols-4 gap-4 max-h-40 overflow-y-auto">
                                    {availableCountries.map((country) => (
                                      <div key={country} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`country-${country}`}
                                          checked={selectedGateway.countries.includes(country)}
                                          onCheckedChange={(checked) => handleCountryToggle(country, checked as boolean)}
                                        />
                                        <Label htmlFor={`country-${country}`} className="text-sm">
                                          {country}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <Separator />

                                {/* Security & Features */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    <h3 className="text-lg font-semibold">Security & Features</h3>
                                  </div>
                                  <div className="grid grid-cols-2 gap-6">
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        id="gateway-active"
                                        checked={selectedGateway.isActive}
                                        onCheckedChange={(checked) => setSelectedGateway({
                                          ...selectedGateway,
                                          isActive: checked
                                        })}
                                      />
                                      <Label htmlFor="gateway-active" className="flex items-center gap-2">
                                        <Zap className="h-4 w-4" />
                                        Gateway Active
                                      </Label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        id="fraud-protection"
                                        checked={selectedGateway.configuration.fraudProtection}
                                        onCheckedChange={(checked) => setSelectedGateway({
                                          ...selectedGateway,
                                          configuration: {
                                            ...selectedGateway.configuration,
                                            fraudProtection: checked
                                          }
                                        })}
                                      />
                                      <Label htmlFor="fraud-protection" className="flex items-center gap-2">
                                        <Shield className="h-4 w-4" />
                                        Fraud Protection
                                      </Label>
                                    </div>
                                  </div>
                                </div>

                                <Separator />

                                {/* Test Configuration */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    <h3 className="text-lg font-semibold">Test Configuration</h3>
                                  </div>
                                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800 mb-2">
                                      <strong>Test Mode:</strong> Use test credentials for development and testing
                                    </p>
                                    <div className="text-xs text-yellow-700">
                                      <p>• Test transactions will not be charged</p>
                                      <p>• Use test card numbers provided by your payment provider</p>
                                      <p>• Switch to live credentials for production</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="outline" onClick={() => {
                                setConfigDialogOpen(false);
                                setSelectedGateway(null);
                              }}>
                                Cancel
                              </Button>
                              <Button onClick={handleUpdateGateway}>
                                <Settings className="h-4 w-4 mr-2" />
                                Save Configuration
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Process a refund for payment {selectedPayment?.transactionId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount</Label>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                max={selectedPayment?.amount || 0}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Enter refund amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason</Label>
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason for refund"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRefund}>Process Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}