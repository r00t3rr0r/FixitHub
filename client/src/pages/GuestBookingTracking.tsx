import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileText,
  Mail,
  Package,
  Search,
  TrendingUp,
  User,
  MapPin,
} from "lucide-react";

import { useToast } from "@/hooks/useToast";
import { trackBooking, trackBookingByNumber, TrackedOrder } from "@/api/orderTracking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export function GuestBookingTracking() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const urlToken = searchParams.get("token");
    const urlEmail = searchParams.get("email");
    const urlBookingNumber = searchParams.get("bookingNumber");

    if (urlBookingNumber && urlEmail) {
      setEmail(urlEmail);
      handleTrackByNumber(urlBookingNumber, urlEmail);
      return;
    }

    if (urlToken && urlEmail) {
      setToken(urlToken);
      setEmail(urlEmail);
      handleTrackBooking(urlToken, urlEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTrackByNumber = async (bookingNumber: string, trackingEmail: string) => {
    try {
      setLoading(true);
      const response = await trackBookingByNumber({
        bookingNumber,
        email: trackingEmail,
      });

      setBooking(response.booking);
      setOrders(response.orders || []);

      toast({
        title: t("common.success"),
        description: t("orderTracking.bookingFound"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("orderTracking.bookingNotFound"),
        variant: "destructive",
      });
      setBooking(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTrackBooking = async (trackingToken?: string, trackingEmail?: string) => {
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
      const response = await trackBooking({ token: finalToken, email: finalEmail });
      setBooking(response.booking);
      setOrders(response.orders || []);

      toast({
        title: t("common.success"),
        description: t("orderTracking.bookingFound"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("orderTracking.bookingNotFound"),
        variant: "destructive",
      });
      setBooking(null);
      setOrders([]);
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
      case "completed":
      case "ready-for-pickup":
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "cancelled":
        return <AlertCircle className="h-3.5 w-3.5" />;
      default:
        return <Package className="h-3.5 w-3.5" />;
    }
  };

  const formatStatus = (status: string) => String(status || "-").replace(/-/g, " ");
  const formatDate = (value?: string | Date) => (value ? new Date(value).toLocaleString("de-DE") : "-");

  const totalOrders = booking?.totalOrders || orders.length;
  const totalCost = typeof booking?.totalCost === "number" ? booking.totalCost : 0;
  const progress = typeof booking?.overallProgress === "number" ? booking.overallProgress : 0;

  const completedOrders = useMemo(
    () => orders.filter((order) => ["completed", "ready-for-pickup"].includes(order.status)).length,
    [orders]
  );

  return (
    <div className="min-h-[calc(100vh-100px)] bg-slate-50">
      <div className="container max-w-6xl py-10">
        <div className="mb-8">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-[#1a2a5e]"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>

          <h1 className="text-3xl font-bold tracking-tight text-[#1a2a5e]">{t("orderTracking.trackBooking")}</h1>
          <p className="mt-2 text-slate-600">{t("orderTracking.trackBookingDescription")}</p>
        </div>

        {!booking && (
          <Card className="border-none bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-[#1a2a5e]">{t("orderTracking.trackYourBooking")}</CardTitle>
              <CardDescription>{t("orderTracking.enterDetailsBooking")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleTrackBooking();
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
                    <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      required
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder={t("orderTracking.tokenPlaceholder")}
                      className="h-11 pl-10"
                    />
                  </div>
                  <p className="text-xs text-slate-500">{t("orderTracking.tokenHintBooking")}</p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00]"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {loading ? t("common.loading") : t("orderTracking.trackBooking")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {booking && (
          <div className="space-y-6">
            <Card className="border-none bg-white shadow-lg">
              <CardHeader className="gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-[#1a2a5e]">
                      <FileText className="h-5 w-5" />
                      {booking.bookingNumber}
                    </CardTitle>
                    <CardDescription className="mt-1">{t("orderTracking.created")}: {formatDate(booking.createdAt)}</CardDescription>
                  </div>
                  <Badge className={`border ${statusStyle(booking.status)} inline-flex items-center gap-1.5`}>
                    {statusIcon(booking.status)}
                    {formatStatus(booking.status)}
                  </Badge>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
                    <span>{t("orderTracking.overallProgress")}</span>
                    <span className="text-[#1a2a5e]">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.totalOrders")}</p>
                    <p className="mt-1 text-2xl font-bold text-[#1a2a5e]">{totalOrders}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.totalCost")}</p>
                    <p className="mt-1 text-2xl font-bold text-[#1a2a5e]">€{totalCost.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.bookingSummary")}</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{completedOrders}/{totalOrders}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <User className="h-4 w-4 text-[#1a2a5e]" />
                      {t("orderTracking.customerInformation")}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p className="text-slate-700">
                        <span className="font-medium">{t("common.name")}: </span>
                        {booking?.guestInfo?.firstName} {booking?.guestInfo?.lastName}
                      </p>
                      <p className="text-slate-700">
                        <span className="font-medium">{t("checkout.email")}: </span>
                        {booking?.guestInfo?.email || "-"}
                      </p>
                      {booking?.guestInfo?.phone && (
                        <p className="text-slate-700">
                          <span className="font-medium">{t("checkout.phone")}: </span>
                          {booking.guestInfo.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <MapPin className="h-4 w-4 text-[#1a2a5e]" />
                      {t("checkout.billingAddress")}
                    </h3>
                    <div className="text-sm text-slate-700">
                      {booking?.guestInfo?.billingAddress ? (
                        <>
                          <p>{booking.guestInfo.billingAddress.street}</p>
                          <p>
                            {booking.guestInfo.billingAddress.zipCode} {booking.guestInfo.billingAddress.city}
                          </p>
                          <p>
                            {booking.guestInfo.billingAddress.state ? `${booking.guestInfo.billingAddress.state}, ` : ""}
                            {booking.guestInfo.billingAddress.country}
                          </p>
                        </>
                      ) : (
                        <p>-</p>
                      )}
                    </div>
                  </div>
                </div>

                {Array.isArray(booking.timeline) && booking.timeline.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Calendar className="h-4 w-4 text-[#1a2a5e]" />
                      {t("orderTracking.bookingTimeline")}
                    </h3>
                    <div className="space-y-4">
                      {booking.timeline.map((event: any, index: number) => (
                        <div key={`${event.status}-${index}`} className="relative pl-6">
                          <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[#1a2a5e]" />
                          {index < booking.timeline.length - 1 && (
                            <div className="absolute left-1 top-4 h-[calc(100%+8px)] w-px bg-slate-200" />
                          )}
                          <p className="text-sm font-semibold text-slate-800">{event.status}</p>
                          <p className="text-sm text-slate-600">{event.description}</p>
                          <p className="text-xs text-slate-500">{formatDate(event.completedAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />
                <Button
                  variant="outline"
                  className="w-full border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white"
                  onClick={() => {
                    setBooking(null);
                    setOrders([]);
                    setEmail("");
                    setToken("");
                  }}
                >
                  {t("orderTracking.trackAnotherBooking")}
                </Button>
              </CardContent>
            </Card>

            {orders.length > 0 && (
              <Card className="border-none bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg text-[#1a2a5e]">{t("orderTracking.ordersInBooking")}</CardTitle>
                  <CardDescription>{t("orderTracking.ordersInBookingDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order._id}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#f5b800]"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{order.orderNumber}</p>
                          <p className="text-sm text-slate-600">{order.deviceBrand} {order.deviceModel}</p>
                        </div>
                        <Badge className={`border ${statusStyle(order.status)} inline-flex items-center gap-1.5`}>
                          {statusIcon(order.status)}
                          {formatStatus(order.status)}
                        </Badge>
                      </div>

                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                          <span>{t("orderTracking.progress")}</span>
                          <span>{order.progress}%</span>
                        </div>
                        <Progress value={order.progress} className="h-1.5" />
                      </div>

                      {Array.isArray(order.services) && order.services.length > 0 && (
                        <div className="mb-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.services")}</p>
                          {order.services.map((service: any, index: number) => (
                            <div key={`${order._id}-service-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                              <span className="text-slate-700">{service?.serviceId?.name || t("common.service")}</span>
                              <span className="font-semibold text-[#1a2a5e]">€{Number(service?.price || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-sm font-semibold text-slate-700">{t("orderTracking.totalCost")}</span>
                        <span className="text-lg font-bold text-[#1a2a5e]">€{Number(order.totalCost || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
