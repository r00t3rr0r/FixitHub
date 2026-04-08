import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Mail,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  TrendingUp,
  User,
  Wrench,
} from "lucide-react";

import { useToast } from "@/hooks/useToast";
import { trackOrder, TrackedOrder } from "@/api/orderTracking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export function GuestOrderTracking() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [relatedOrders, setRelatedOrders] = useState<any[]>([]);
  const [booking, setBooking] = useState<any | null>(null);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    const urlEmail = searchParams.get("email");

    if (urlToken && urlEmail) {
      setToken(urlToken);
      setEmail(urlEmail);
      handleTrackOrder(urlToken, urlEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const locale = i18n.language?.toLowerCase().startsWith("de") ? "de-DE" : "en-US";
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }),
    [locale]
  );

  const handleTrackOrder = async (trackingToken?: string, trackingEmail?: string) => {
    const finalToken = trackingToken || token;
    const finalEmail = trackingEmail || email;

    if (!finalToken || !finalEmail) {
      toast({
        title: t("common.error"),
        description: t("orderTracking.enterTokenAndEmail"),
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await trackOrder({ token: finalToken, email: finalEmail });

      setOrder(response.order);
      setRelatedOrders(response.relatedOrders || []);
      setBooking(response.booking);
      setActiveOrder(response.order);
      setDetailOpen(true);

      toast({
        title: t("common.success"),
        description: t("orderTracking.orderFound"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error?.message || t("orderTracking.orderNotFound"),
        variant: "destructive",
      });
      setOrder(null);
      setRelatedOrders([]);
      setBooking(null);
      setActiveOrder(null);
      setDetailOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case "pending":
      case "payment-pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "in-progress":
      case "diagnostic-assessment":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "quality-check":
        return "bg-violet-100 text-violet-800 border-violet-200";
      case "completed":
      case "ready-for-pickup":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "cancelled":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending":
      case "payment-pending":
        return <Clock className="h-3.5 w-3.5" />;
      case "in-progress":
      case "diagnostic-assessment":
        return <TrendingUp className="h-3.5 w-3.5" />;
      case "quality-check":
        return <Wrench className="h-3.5 w-3.5" />;
      case "completed":
      case "ready-for-pickup":
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "cancelled":
        return <AlertCircle className="h-3.5 w-3.5" />;
      default:
        return <Package className="h-3.5 w-3.5" />;
    }
  };

  const formatDate = (value?: string | Date) => (value ? new Date(value).toLocaleString(locale) : "-");
  const formatPrice = (value: number) => currencyFormatter.format(Number(value || 0));
  const formatStatus = (status: string) =>
    t(`orderTracking.statuses.${status}`, {
      defaultValue: String(status || "-").replace(/-/g, " "),
    });

  const openOrderDetails = (targetOrder: any) => {
    setActiveOrder(targetOrder);
    setDetailOpen(true);
  };

  const resetTracking = () => {
    setOrder(null);
    setRelatedOrders([]);
    setBooking(null);
    setEmail("");
    setToken("");
    setActiveOrder(null);
    setDetailOpen(false);
  };

  const detailOrder = activeOrder || order;

  return (
    <div className="min-h-[calc(100vh-100px)] bg-slate-50">
      <div className="container max-w-6xl py-6 sm:py-10">
        <div className="mb-6 w-full overflow-hidden rounded-[18px] border-b border-[#2a3f7e] bg-gradient-to-br from-[#1a2a5e] to-[#0f1d45] px-6 py-8 text-white max-[480px]:rounded-[12px] max-[480px]:px-3 max-[360px]:px-[10px] max-[360px]:py-5">
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-[#f5b800]"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>

          <div className="flex items-start gap-4 sm:items-center max-[480px]:gap-[10px]">
            <Package className="h-11 w-11 flex-shrink-0 text-[#f5b800] max-[480px]:h-8 max-[480px]:w-8" />
            <div>
              <h1 className="m-0 text-[2rem] font-extrabold leading-[1.2] tracking-[-0.5px] max-[480px]:text-[1.1rem] max-[360px]:text-[1rem]">
                {t("orderTracking.title")}
              </h1>
              <p className="mt-1 text-[0.95rem] leading-[1.35] text-white/85 max-[480px]:text-[0.76rem] max-[360px]:text-[0.72rem]">
                {t("orderTracking.description")}
              </p>
            </div>
          </div>
        </div>

        {!order && (
          <Card className="border-none bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-[#1a2a5e]">{t("orderTracking.trackYourOrder")}</CardTitle>
              <CardDescription>{t("orderTracking.enterDetails")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleTrackOrder();
                }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{t("checkout.email")}</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={t("checkout.emailPlaceholder")}
                      className="h-11 pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{t("orderTracking.trackingToken")}</label>
                  <div className="relative">
                    <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      required
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder={t("orderTracking.tokenPlaceholder")}
                      className="h-11 pl-10"
                    />
                  </div>
                  <p className="text-xs text-slate-500">{t("orderTracking.tokenHint")}</p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00]"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {loading ? t("common.loading") : t("orderTracking.trackOrder")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {order && (
          <div className="space-y-6">
            <Card className="border-none bg-white shadow-lg">
              <CardHeader className="gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-xl text-[#1a2a5e] max-[480px]:text-base">
                      <Package className="h-5 w-5" />
                      <span className="break-all">{order.orderNumber}</span>
                    </CardTitle>
                    <CardDescription className="mt-1 max-[480px]:text-xs">
                      {t("orderTracking.created")}: {formatDate(order.createdAt)}
                    </CardDescription>
                  </div>

                  <Badge className={`border ${statusStyle(order.status)} inline-flex items-center gap-1.5`}>
                    {statusIcon(order.status)}
                    {formatStatus(order.status)}
                  </Badge>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 max-[480px]:p-3">
                  <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700 max-[480px]:text-xs">
                    <span>{t("orderTracking.progress")}</span>
                    <span className="text-[#1a2a5e]">{order.progress}%</span>
                  </div>
                  <Progress value={order.progress} className="h-2" />
                </div>
              </CardHeader>

              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 max-[480px]:p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.deviceType")}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 break-words">{order.deviceType || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 max-[480px]:p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.model")}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 break-words">{order.deviceBrand} {order.deviceModel}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 max-[480px]:p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.totalCost")}</p>
                  <p className="mt-1 text-sm font-bold text-[#1a2a5e]">{formatPrice(order.totalCost)}</p>
                </div>

                <div className="sm:col-span-3">
                  <Button className="w-full bg-[#1a2a5e] text-white hover:bg-[#2a3f7e]" onClick={() => openOrderDetails(order)}>
                    {t("common.view")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {booking && (
              <Card className="border-none bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg text-[#1a2a5e]">{t("orderTracking.bookingDetails")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 max-[480px]:p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.bookingNumber")}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 break-words">{booking.bookingNumber || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 max-[480px]:p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("common.status")}</p>
                    <Badge className={`mt-2 inline-flex items-center gap-1.5 border ${statusStyle(booking.status)}`}>
                      {statusIcon(booking.status)}
                      {formatStatus(booking.status)}
                    </Badge>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 max-[480px]:p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.orderDate")}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(booking.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {relatedOrders.length > 0 && (
              <Card className="border-none bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg text-[#1a2a5e]">{t("orderTracking.relatedOrders")}</CardTitle>
                  <CardDescription>{t("orderTracking.relatedOrdersDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {relatedOrders.map((relOrder: any) => (
                    <div
                      key={relOrder._id}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#f5b800]"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-slate-900 break-all">{relOrder.orderNumber}</p>
                          <p className="text-sm text-slate-600 break-words">{relOrder.deviceBrand} {relOrder.deviceModel}</p>
                        </div>
                        <Badge className={`border ${statusStyle(relOrder.status)} inline-flex items-center gap-1.5`}>
                          {statusIcon(relOrder.status)}
                          {formatStatus(relOrder.status)}
                        </Badge>
                      </div>

                      <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                        <span>{t("orderTracking.progress")}</span>
                        <span>{Number(relOrder.progress || 0)}%</span>
                      </div>
                      <Progress value={Number(relOrder.progress || 0)} className="h-1.5" />

                      <Button
                        variant="outline"
                        className="mt-3 w-full border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white"
                        onClick={() => openOrderDetails(relOrder)}
                      >
                        {t("common.view")}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Button
              variant="outline"
              className="w-full border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white"
              onClick={resetTracking}
            >
              {t("orderTracking.trackAnotherOrder")}
            </Button>
          </div>
        )}

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-[96vw] sm:max-w-3xl my-0 sm:my-3 max-h-dvh sm:max-h-[92vh] p-0 gap-0 overflow-hidden border-none rounded-[14px] sm:rounded-[24px] shadow-[0_20px_60px_rgba(26,42,94,0.3)] flex flex-col">
            <DialogHeader className="relative overflow-hidden flex-shrink-0 px-3 py-3 sm:px-6 sm:py-5 pr-11 sm:pr-12 bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e]">
              <div className="absolute top-0 right-0 h-40 w-40 rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(245,184,0,0.12)_0%,transparent_70%)]" />
              <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(245,184,0,0.08)_0%,transparent_70%)]" />

              <div className="relative z-10">
                <DialogTitle className="text-[#f5b800] font-extrabold tracking-tight text-[clamp(0.92rem,3vw,1.35rem)] break-all">
                  {detailOrder?.orderNumber || t("orderTracking.title")}
                </DialogTitle>
                <p className="mt-1 text-white/85 text-xs sm:text-sm break-words">
                  {detailOrder ? `${t("orderTracking.created")}: ${formatDate(detailOrder.createdAt)}` : t("orderTracking.notAvailable")}
                </p>

                {detailOrder && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge className={`border ${statusStyle(detailOrder.status)} inline-flex items-center gap-1 text-[11px] max-[360px]:px-2 max-[360px]:py-0.5`}>
                      {statusIcon(detailOrder.status)}
                      {formatStatus(detailOrder.status)}
                    </Badge>
                    <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white max-[360px]:text-[10px]">
                      {detailOrder.progress}% {t("orderTracking.progress")}
                    </span>
                  </div>
                )}
              </div>
            </DialogHeader>

            {detailOrder ? (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-gradient-to-b from-white to-slate-50">
                <div className="p-2.5 sm:p-5 space-y-3.5">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Wrench className="h-4 w-4 text-[#1a2a5e]" />
                      {t("orderTracking.deviceInformation")}
                    </h3>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.deviceType")}</p>
                        <p className="mt-1 text-sm font-medium text-slate-800 break-all">{detailOrder.deviceType || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.brand")}</p>
                        <p className="mt-1 text-sm font-medium text-slate-800 break-all">{detailOrder.deviceBrand || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.model")}</p>
                        <p className="mt-1 text-sm font-medium text-slate-800 break-all">{detailOrder.deviceModel || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(detailOrder.services) && detailOrder.services.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.services")}</h3>
                      {detailOrder.services.map((service: any, index: number) => (
                        <div key={`${detailOrder._id || "detail"}-service-${index}`} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{service?.serviceId?.name || t("common.service")}</p>
                            {service?.serviceId?.description && <p className="text-xs text-slate-500">{service.serviceId.description}</p>}
                          </div>
                          <span className="text-sm font-semibold text-[#1a2a5e]">{formatPrice(Number(service?.price || 0))}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {Array.isArray(detailOrder.addOns) && detailOrder.addOns.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.addOns")}</h3>
                      {detailOrder.addOns.map((addOn: any, index: number) => (
                        <div key={`${detailOrder._id || "detail"}-addon-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                          <span className="text-sm text-slate-700 break-words">{addOn?.name || "-"}</span>
                          <span className="text-sm font-semibold text-[#1a2a5e]">{formatPrice(Number(addOn?.price || 0))}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {Array.isArray(detailOrder.shopProducts) && detailOrder.shopProducts.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2">
                      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <ShoppingCart className="h-3.5 w-3.5 text-[#1a2a5e]" />
                        {t("orderTracking.products")}
                      </h3>
                      {detailOrder.shopProducts.map((product: any, index: number) => {
                        const lineTotal = Number(product?.priceAtOrder || 0) * Number(product?.quantity || 0);
                        return (
                          <div key={`${detailOrder._id || "detail"}-product-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-slate-800 break-words">{product?.productId?.name || t("common.product")}</p>
                              <p className="text-xs text-slate-500">{t("orderTracking.quantity")}: {Number(product?.quantity || 0)}</p>
                            </div>
                            <span className="text-sm font-semibold text-[#1a2a5e]">{formatPrice(lineTotal)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-xl bg-[#1a2a5e] p-3 sm:p-4 text-white">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-100">{t("orderTracking.totalCost")}</span>
                      <span className="text-lg sm:text-xl font-bold text-[#f5b800]">{formatPrice(detailOrder.totalCost || 0)}</span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <User className="h-4 w-4 text-[#1a2a5e]" />
                        {t("orderTracking.customerInformation")}
                      </h3>
                      <div className="space-y-1.5 text-sm text-slate-700">
                        <p><span className="font-medium">{t("common.name")}: </span>{detailOrder?.guestInfo?.firstName} {detailOrder?.guestInfo?.lastName}</p>
                        <p className="break-all"><span className="font-medium">{t("checkout.email")}: </span>{detailOrder?.guestInfo?.email || "-"}</p>
                        {detailOrder?.guestInfo?.phone && <p><span className="font-medium">{t("checkout.phone")}: </span>{detailOrder.guestInfo.phone}</p>}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <MapPin className="h-4 w-4 text-[#1a2a5e]" />
                        {t("checkout.billingAddress")}
                      </h3>
                      <div className="text-sm text-slate-700 break-words">
                        {detailOrder?.guestInfo?.billingAddress ? (
                          <>
                            <p>{detailOrder.guestInfo.billingAddress.street}</p>
                            <p>{detailOrder.guestInfo.billingAddress.zipCode} {detailOrder.guestInfo.billingAddress.city}</p>
                            <p>
                              {detailOrder.guestInfo.billingAddress.state ? `${detailOrder.guestInfo.billingAddress.state}, ` : ""}
                              {detailOrder.guestInfo.billingAddress.country}
                            </p>
                          </>
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {Array.isArray(detailOrder.timeline) && detailOrder.timeline.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Calendar className="h-4 w-4 text-[#1a2a5e]" />
                        {t("orderTracking.timeline")}
                      </h3>
                      <div className="space-y-4">
                        {detailOrder.timeline.map((event: any, index: number) => (
                          <div key={`${event.status}-${index}`} className="relative pl-6">
                            <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[#1a2a5e]" />
                            {index < detailOrder.timeline.length - 1 && <div className="absolute left-1 top-4 h-[calc(100%+8px)] w-px bg-slate-200" />}
                            <p className="text-sm font-semibold text-slate-800">{formatStatus(String(event?.status || ""))}</p>
                            <p className="text-sm text-slate-600 break-words">{event?.description || t("orderTracking.notAvailable")}</p>
                            <p className="text-xs text-slate-500">{formatDate(event?.completedAt)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm text-slate-600">{t("orderTracking.notAvailable")}</div>
            )}

            <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 sm:px-5 sm:py-4">
              <Button className="w-full bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white h-10 max-[360px]:h-9 max-[360px]:text-xs" onClick={() => setDetailOpen(false)}>
                {t("common.close")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
