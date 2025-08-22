import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getPayments, getInvoices, getFinancialReports, getPaymentGateways, processRefund, sendInvoice, Payment, Invoice, FinancialReport, PaymentGateway } from "@/api/financial"
import {
  DollarSign,
  Search,
  Filter,
  Plus,
  Eye,
  RefreshCw,
  Send,
  Download,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Settings
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function FinancialManagement() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [reports, setReports] = useState<FinancialReport | null>(null)
  const [gateways, setGateways] = useState<PaymentGateway[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; payment: Payment | null }>({ open: false, payment: null })
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching financial data...")
        const [paymentsResponse, invoicesResponse, reportsResponse, gatewaysResponse] = await Promise.all([
          getPayments(),
          getInvoices(),
          getFinancialReports(),
          getPaymentGateways()
        ])

        setPayments((paymentsResponse as any).payments || [])
        setInvoices((invoicesResponse as any).invoices || [])
        setReports((reportsResponse as any).report || null)
        setGateways((gatewaysResponse as any).gateways || [])
      } catch (error) {
        console.error("Error fetching financial data:", error)
        toast({
          title: "Error",
          description: "Failed to load financial data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  const handleRefund = async () => {
    if (!refundDialog.payment || !refundAmount || !refundReason) return

    try {
      setProcessing(true)
      await processRefund(refundDialog.payment._id, parseFloat(refundAmount), refundReason)

      toast({
        title: "Success!",
        description: "Refund processed successfully"
      })

      // Refresh payments
      const response = await getPayments()
      setPayments((response as any).payments || [])

      setRefundDialog({ open: false, payment: null })
      setRefundAmount("")
      setRefundReason("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process refund",
        variant: "destructive"
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      await sendInvoice(invoiceId)
      toast({
        title: "Success!",
        description: "Invoice sent successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invoice",
        variant: "destructive"
      })
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white'
      case 'pending':
        return 'bg-yellow-500 text-black'
      case 'processing':
        return 'bg-blue-500 text-white'
      case 'failed':
        return 'bg-red-500 text-white'
      case 'refunded':
        return 'bg-gray-500 text-white'
      case 'disputed':
        return 'bg-orange-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500 text-white'
      case 'sent':
        return 'bg-blue-500 text-white'
      case 'viewed':
        return 'bg-purple-500 text-white'
      case 'overdue':
        return 'bg-red-500 text-white'
      case 'draft':
        return 'bg-gray-500 text-white'
      case 'cancelled':
        return 'bg-red-600 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.transactionId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Financial Management
          </h1>
          <p className="text-muted-foreground">
            Manage payments, invoices, reports, and payment configurations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      {reports && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                Total Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                ${reports.totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">
                {reports.period}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Net Profit
              </CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                ${reports.netProfit.toLocaleString()}
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                {reports.grossMargin.toFixed(1)}% margin
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Add-on Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                ${reports.addonRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                {((reports.addonRevenue / reports.totalRevenue) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
                Refunds & Disputes
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                ${(reports.refundAmount + reports.disputeAmount).toLocaleString()}
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                {(((reports.refundAmount + reports.disputeAmount) / reports.totalRevenue) * 100).toFixed(1)}% of revenue
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments">Payment Processing</TabsTrigger>
          <TabsTrigger value="invoices">Invoice Management</TabsTrigger>
          <TabsTrigger value="reports">Financial Reports</TabsTrigger>
          <TabsTrigger value="gateways">Payment Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search payments by order, customer, or transaction ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                      <SelectItem value="disputed">Disputed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments Table */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Transactions</CardTitle>
              <CardDescription>
                Manage payment processing, refunds, and disputes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No payments found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">{payment.transactionId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{payment.customerName}</p>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">${payment.amount.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">{payment.currency}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {payment.paymentMethod.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPaymentStatusColor(payment.status)}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {new Date(payment.createdAt).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {payment.status === 'completed' && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setRefundDialog({ open: true, payment })}
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-background">
                                  <DialogHeader>
                                    <DialogTitle>Process Refund</DialogTitle>
                                    <DialogDescription>
                                      Process a refund for payment {payment.transactionId}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="refund-amount">Refund Amount</Label>
                                      <Input
                                        id="refund-amount"
                                        type="number"
                                        placeholder="0.00"
                                        value={refundAmount}
                                        onChange={(e) => setRefundAmount(e.target.value)}
                                        max={payment.amount}
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Maximum: ${payment.amount.toFixed(2)}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="refund-reason">Reason</Label>
                                      <Textarea
                                        id="refund-reason"
                                        placeholder="Enter refund reason..."
                                        value={refundReason}
                                        onChange={(e) => setRefundReason(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button 
                                      variant="outline" 
                                      onClick={() => {
                                        setRefundDialog({ open: false, payment: null })
                                        setRefundAmount("")
                                        setRefundReason("")
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      onClick={handleRefund}
                                      disabled={processing || !refundAmount || !refundReason}
                                    >
                                      {processing ? "Processing..." : "Process Refund"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Management</CardTitle>
              <CardDescription>
                Create, send, and track invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice._id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {invoice.items.length} item{invoice.items.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.customerName}</p>
                          <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">${invoice.total.toFixed(2)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={getInvoiceStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(invoice.status === 'draft' || invoice.status === 'sent') && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleSendInvoice(invoice._id)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
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
          {reports && (
            <>
              {/* Payment Method Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method Breakdown</CardTitle>
                  <CardDescription>Revenue distribution by payment method</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reports.paymentMethodBreakdown.map((method, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{method.method}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            ${method.amount.toLocaleString()}
                          </span>
                          <Badge variant="outline">
                            {method.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trends</CardTitle>
                  <CardDescription>Monthly revenue and order trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reports.monthlyTrends.map((trend, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{trend.month}</p>
                          <p className="text-sm text-muted-foreground">{trend.orders} orders</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${trend.revenue.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">
                            Avg: ${trend.avgOrderValue.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="gateways" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Gateway Configuration</CardTitle>
              <CardDescription>
                Manage payment gateways and processing settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gateways.map((gateway) => (
                  <div key={gateway._id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{gateway.name}</h4>
                          <p className="text-sm text-muted-foreground">{gateway.provider}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={gateway.isActive ? "default" : "secondary"}>
                          {gateway.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Processing Fee</p>
                        <p className="text-sm text-muted-foreground">
                          {gateway.configuration.processingFee}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Currency</p>
                        <p className="text-sm text-muted-foreground">
                          {gateway.configuration.currency}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Fraud Protection</p>
                        <div className="flex items-center gap-1">
                          {gateway.configuration.fraudProtection ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-orange-600" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {gateway.configuration.fraudProtection ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">Supported Methods</p>
                      <div className="flex flex-wrap gap-1">
                        {gateway.supportedMethods.map((method) => (
                          <Badge key={method} variant="outline" className="text-xs">
                            {method.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}