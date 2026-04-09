import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Search,
  Send,
  TrendingUp,
  User,
} from "lucide-react";

import {
  completeGuestBookingOrderAction,
  getGuestBookingOrderCommunication,
  GuestOrderCommunication,
  respondGuestBookingOrderFeedback,
  sendGuestBookingOrderMessage,
  trackBooking,
  trackBookingByNumber,
  TrackedOrder,
} from "@/api/orderTracking";
import { useToast } from "@/hooks/useToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export function GuestBookingTracking() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [bookingNumber, setBookingNumber] = useState("");

  const [communicationByOrderId, setCommunicationByOrderId] = useState<Record<string, GuestOrderCommunication | null>>({});
  const [communicationUpdatedAtByOrderId, setCommunicationUpdatedAtByOrderId] = useState<Record<string, string>>({});
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [selectedOrderForCommunication, setSelectedOrderForCommunication] = useState<TrackedOrder | null>(null);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [guestMessage, setGuestMessage] = useState("");
  const [sendingGuestMessage, setSendingGuestMessage] = useState(false);
  const [respondingToMessageId, setRespondingToMessageId] = useState<string | null>(null);
  const [pendingOption, setPendingOption] = useState<{ label: string; value: string } | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const trackAccess = useMemo(
    () => ({
      email,
      token: token || undefined,
      bookingNumber: bookingNumber || undefined,
    }),
    [email, token, bookingNumber]
  );

  useEffect(() => {
    if (!orders.length || !trackAccess.email) {
      return;
    }

    let isCancelled = false;

    const preloadCommunication = async () => {
      try {
        const results = await Promise.all(
          orders.map(async (order) => {
            try {
              const response = await getGuestBookingOrderCommunication(order._id, trackAccess);
              return [order._id, response.communication] as const;
            } catch {
              return [order._id, null] as const;
            }
          })
        );

        if (isCancelled) {
          return;
        }

        setCommunicationByOrderId((previous) => {
          const next = { ...previous };
          results.forEach(([orderId, communication]) => {
            next[orderId] = communication;
          });
          return next;
        });

        const refreshedAt = new Date().toISOString();
        setCommunicationUpdatedAtByOrderId((previous) => {
          const next = { ...previous };
          results.forEach(([orderId]) => {
            next[orderId] = refreshedAt;
          });
          return next;
        });
      } catch {
        // Do not block booking UI if communication preload fails.
      }
    };

    preloadCommunication();

    return () => {
      isCancelled = true;
    };
  }, [orders, trackAccess]);

  useEffect(() => {
    if (!communicationDialogOpen || !selectedOrderForCommunication || !trackAccess.email) {
      return;
    }

    const interval = window.setInterval(() => {
      loadCommunication(selectedOrderForCommunication._id, { silent: true });
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [communicationDialogOpen, selectedOrderForCommunication, trackAccess.email]);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    const urlEmail = searchParams.get("email");
    const urlBookingNumber = searchParams.get("bookingNumber");

    if (urlBookingNumber && urlEmail) {
      setEmail(urlEmail);
      setBookingNumber(urlBookingNumber);
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

  const handleTrackByNumber = async (trackingBookingNumber: string, trackingEmail: string) => {
    try {
      setLoading(true);
      const response = await trackBookingByNumber({
        bookingNumber: trackingBookingNumber,
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
      setBookingNumber("");

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

  const locale = i18n.language?.toLowerCase().startsWith("de") ? "de-DE" : "en-US";
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }),
    [locale]
  );

  const formatStatus = (status: string) =>
    t(`orderTracking.statuses.${status}`, {
      defaultValue: String(status || "-").replace(/-/g, " "),
    });
  const formatDate = (value?: string | Date) => (value ? new Date(value).toLocaleString(locale) : "-");

  const totalOrders = booking?.totalOrders || orders.length;
  const totalCost = typeof booking?.totalCost === "number" ? booking.totalCost : 0;
  const progress = typeof booking?.overallProgress === "number" ? booking.overallProgress : 0;

  const completedOrders = useMemo(
    () => orders.filter((order) => ["completed", "ready-for-pickup"].includes(order.status)).length,
    [orders]
  );

  const selectedCommunication = selectedOrderForCommunication
    ? communicationByOrderId[selectedOrderForCommunication._id] || null
    : null;

  const canGuestWriteMessage = useMemo(() => {
    if (!selectedCommunication) {
      return false;
    }

    const hasInboundMessage = (selectedCommunication.messages || []).some(
      (message) => message.senderType === "staff" || message.senderType === "system"
    );

    return hasInboundMessage
      || (selectedCommunication.pendingFeedbackCount || 0) > 0
      || (selectedCommunication.pendingActionsCount || 0) > 0;
  }, [selectedCommunication]);

  const loadCommunication = async (orderId: string, options: { silent?: boolean } = {}) => {
    const { silent = false } = options;
    try {
      if (!silent) {
        setCommunicationLoading(true);
      }
      const response = await getGuestBookingOrderCommunication(orderId, trackAccess);
      setCommunicationByOrderId((previous) => ({
        ...previous,
        [orderId]: response.communication,
      }));
      setCommunicationUpdatedAtByOrderId((previous) => ({
        ...previous,
        [orderId]: new Date().toISOString(),
      }));
    } catch (error: any) {
      if (!silent) {
        toast({
          title: t("common.error"),
          description: error.message || t("orderTracking.communication.loadFailed", { defaultValue: "Communication could not be loaded." }),
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) {
        setCommunicationLoading(false);
      }
    }
  };

  const openCommunicationDialog = async (order: TrackedOrder) => {
    setSelectedOrderForCommunication(order);
    setCommunicationDialogOpen(true);
    setGuestMessage("");
    setRespondingToMessageId(null);
    setPendingOption(null);
    await loadCommunication(order._id);
  };

  const handleGuestMessageSend = async () => {
    if (!selectedOrderForCommunication || !guestMessage.trim() || !canGuestWriteMessage) {
      return;
    }

    try {
      setSendingGuestMessage(true);
      const response = await sendGuestBookingOrderMessage(
        selectedOrderForCommunication._id,
        trackAccess,
        guestMessage.trim()
      );

      setCommunicationByOrderId((previous) => ({
        ...previous,
        [selectedOrderForCommunication._id]: response.communication,
      }));
      setCommunicationUpdatedAtByOrderId((previous) => ({
        ...previous,
        [selectedOrderForCommunication._id]: new Date().toISOString(),
      }));
      setGuestMessage("");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("orderTracking.communication.sendFailed", { defaultValue: "Message could not be sent." }),
        variant: "destructive",
      });
    } finally {
      setSendingGuestMessage(false);
    }
  };

  const handleFeedbackResponse = async (messageId: string, responseOption: { label: string; value: string }) => {
    if (!selectedOrderForCommunication) {
      return;
    }

    try {
      setActionBusyId(messageId);
      const response = await respondGuestBookingOrderFeedback(
        selectedOrderForCommunication._id,
        messageId,
        responseOption,
        trackAccess
      );

      setCommunicationByOrderId((previous) => ({
        ...previous,
        [selectedOrderForCommunication._id]: response.communication,
      }));
      setCommunicationUpdatedAtByOrderId((previous) => ({
        ...previous,
        [selectedOrderForCommunication._id]: new Date().toISOString(),
      }));
      setRespondingToMessageId(null);
      setPendingOption(null);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("orderTracking.communication.respondFailed", { defaultValue: "Feedback response failed." }),
        variant: "destructive",
      });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleQuickActionComplete = async (messageId: string) => {
    if (!selectedOrderForCommunication) {
      return;
    }

    try {
      setActionBusyId(messageId);
      const response = await completeGuestBookingOrderAction(selectedOrderForCommunication._id, messageId, trackAccess);
      setCommunicationByOrderId((previous) => ({
        ...previous,
        [selectedOrderForCommunication._id]: response.communication,
      }));
      setCommunicationUpdatedAtByOrderId((previous) => ({
        ...previous,
        [selectedOrderForCommunication._id]: new Date().toISOString(),
      }));
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("orderTracking.communication.completeFailed", { defaultValue: "Action could not be completed." }),
        variant: "destructive",
      });
    } finally {
      setActionBusyId(null);
    }
  };

  const getPendingCommunicationCount = (orderId: string) => {
    const communication = communicationByOrderId[orderId];
    if (!communication) {
      return 0;
    }

    return Number(communication.pendingFeedbackCount || 0) + Number(communication.pendingActionsCount || 0);
  };

  const getCommunicationUpdatedAtLabel = (orderId: string) => {
    const updatedAt = communicationUpdatedAtByOrderId[orderId];
    if (!updatedAt) {
      return "-";
    }

    return formatDate(updatedAt);
  };

  const formatShippingStatus = (status?: string) =>
    t(`orderTracking.shipping.statuses.${status || "pending"}`, {
      defaultValue: String(status || "pending").replace(/-/g, " "),
    });

  return (
    <div className="min-h-[calc(100vh-100px)] bg-slate-50">
      <div className="container max-w-6xl py-6 sm:py-10">
        <div className="mb-8">
          <div className="mb-6 w-full overflow-hidden rounded-[18px] border-b border-[#2a3f7e] bg-gradient-to-br from-[#1a2a5e] to-[#0f1d45] px-6 py-8 text-white max-[480px]:rounded-[12px] max-[480px]:px-3 max-[360px]:px-[10px] max-[360px]:py-5">
            <Link
              to="/"
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-[#f5b800]"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("common.back")}
            </Link>

            <div className="flex items-start gap-4 sm:items-center max-[480px]:gap-[10px]">
              <FileText className="h-11 w-11 flex-shrink-0 text-[#f5b800] max-[480px]:h-8 max-[480px]:w-8" />
              <div>
                <h1 className="m-0 text-[2rem] font-extrabold leading-[1.2] tracking-[-0.5px] break-words max-[480px]:text-[1.1rem] max-[360px]:text-[1rem]">
                  {t("orderTracking.trackBooking")}
                </h1>
                <p className="mt-1 text-[0.95rem] leading-[1.35] text-white/85 max-[480px]:text-[0.76rem] max-[360px]:text-[0.72rem]">
                  {t("orderTracking.trackBookingDescription")}
                </p>
              </div>
            </div>
          </div>
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
            <Card className="border-none bg-white shadow-lg overflow-hidden">
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
                    <p className="mt-1 text-2xl font-bold text-[#1a2a5e]">{currencyFormatter.format(totalCost)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orderTracking.bookingSummary")}</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{completedOrders}/{totalOrders}</p>
                  </div>
                </div>

                {(booking?.returnLabelUrl || booking?.returnTrackingNumber || booking?.returnShipmentStatus) && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Package className="h-4 w-4 text-[#1a2a5e]" />
                      {t("orderTracking.shipping.bookingTitle", { defaultValue: "Shipping information" })}
                    </h3>

                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("orderTracking.shipping.carrier", { defaultValue: "Carrier" })}
                        </p>
                        <p className="mt-1 font-medium text-slate-800">{booking?.carrier || "DHL"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("orderTracking.shipping.trackingNumber", { defaultValue: "Tracking number" })}
                        </p>
                        <p className="mt-1 font-medium text-slate-800 break-all">{booking?.returnTrackingNumber || booking?.trackingNumber || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("orderTracking.shipping.status", { defaultValue: "Shipping status" })}
                        </p>
                        <p className="mt-1 font-medium text-slate-800">{formatShippingStatus(booking?.returnShipmentStatus || booking?.shippingStatus)}</p>
                      </div>
                    </div>

                    {(booking?.returnLabelUrl || booking?.shippingLabelUrl) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {booking?.returnLabelUrl && (
                          <a
                            href={booking.returnLabelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-md bg-[#1a2a5e] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2a3f7e]"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t("orderTracking.shipping.downloadLabel", { defaultValue: "Download shipping label" })}
                          </a>
                        )}
                        {booking?.shippingLabelUrl && !booking?.returnLabelUrl && (
                          <a
                            href={booking.shippingLabelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-md bg-[#1a2a5e] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2a3f7e]"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t("orderTracking.shipping.downloadLabel", { defaultValue: "Download shipping label" })}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                          <p className="text-sm font-semibold text-slate-800">{formatStatus(String(event?.status || ""))}</p>
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
                    setBookingNumber("");
                    setCommunicationByOrderId({});
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
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-slate-900 break-all">{order.orderNumber}</p>
                          <p className="text-sm text-slate-600 break-words">{order.deviceBrand} {order.deviceModel}</p>
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
                              <span className="font-semibold text-[#1a2a5e]">{currencyFormatter.format(Number(service?.price || 0))}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-sm font-semibold text-slate-700">{t("orderTracking.totalCost")}</span>
                        <span className="text-lg font-bold text-[#1a2a5e]">{currencyFormatter.format(Number(order.totalCost || 0))}</span>
                      </div>

                      <Button
                        variant="outline"
                        className="mt-3 w-full border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white"
                        onClick={() => openCommunicationDialog(order)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        {t("orderTracking.communication.open", { defaultValue: "Open communication" })}
                        {getPendingCommunicationCount(order._id) > 0 && (
                          <span className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#f5b800] px-1.5 py-0.5 text-[11px] font-bold text-[#1a2a5e]">
                            {getPendingCommunicationCount(order._id)}
                          </span>
                        )}
                      </Button>

                      {(order?.shippingLabelUrl || order?.trackingNumber || order?.shippingStatus) && (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <p>
                              <span className="font-semibold text-slate-900">{t("orderTracking.shipping.carrier", { defaultValue: "Carrier" })}: </span>
                              {order.carrier || "DHL"}
                            </p>
                            <p className="break-all">
                              <span className="font-semibold text-slate-900">{t("orderTracking.shipping.trackingNumber", { defaultValue: "Tracking number" })}: </span>
                              {order.trackingNumber || "-"}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900">{t("orderTracking.shipping.status", { defaultValue: "Shipping status" })}: </span>
                              {formatShippingStatus(order.shippingStatus)}
                            </p>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {order.shippingLabelUrl && (
                              <a
                                href={order.shippingLabelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 font-semibold text-[#1a2a5e] ring-1 ring-slate-200 hover:bg-slate-100"
                              >
                                <Download className="h-3.5 w-3.5" />
                                {t("orderTracking.shipping.downloadLabel", { defaultValue: "Download shipping label" })}
                              </a>
                            )}
                            {order.trackingNumber && (
                              <a
                                href={`https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(order.trackingNumber)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 font-semibold text-[#1a2a5e] ring-1 ring-slate-200 hover:bg-slate-100"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {t("orderTracking.shipping.openTracking", { defaultValue: "Open tracking" })}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={communicationDialogOpen && !!selectedOrderForCommunication}
        onOpenChange={(isOpen) => {
          setCommunicationDialogOpen(isOpen);
          if (!isOpen) {
            setGuestMessage("");
            setRespondingToMessageId(null);
            setPendingOption(null);
            setSelectedOrderForCommunication(null);
          }
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-3xl my-0 sm:my-3 max-h-dvh sm:max-h-[92vh] p-0 gap-0 overflow-hidden border-none rounded-[16px] sm:rounded-[24px] shadow-[0_20px_60px_rgba(26,42,94,0.3)] flex flex-col [&>button]:hidden">
          {selectedOrderForCommunication && (
            <>
              <DialogHeader className="relative overflow-hidden flex-shrink-0 px-4 py-4 sm:px-6 sm:py-5 pr-12 bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e]">
                <DialogTitle className="!text-[#f5b800] font-extrabold tracking-tight text-[clamp(1rem,3vw,1.35rem)] break-all">
                  {t("orderTracking.communication.title", { defaultValue: "Customer communication" })}
                </DialogTitle>
                <DialogDescription className="text-white/85 text-xs sm:text-sm">
                  {selectedOrderForCommunication.orderNumber} • {selectedOrderForCommunication.deviceBrand} {selectedOrderForCommunication.deviceModel}
                </DialogDescription>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={`border ${statusStyle(selectedOrderForCommunication.status)} inline-flex items-center gap-1.5`}>
                    {statusIcon(selectedOrderForCommunication.status)}
                    {formatStatus(selectedOrderForCommunication.status)}
                  </Badge>
                  <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
                    {selectedCommunication?.pendingFeedbackCount || 0} {t("orderTracking.communication.pendingFeedback", { defaultValue: "pending feedback" })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
                    {selectedCommunication?.pendingActionsCount || 0} {t("orderTracking.communication.pendingActions", { defaultValue: "pending actions" })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
                    {t("orderTracking.communication.lastUpdated", { defaultValue: "Last updated" })}: {getCommunicationUpdatedAtLabel(selectedOrderForCommunication._id)}
                  </span>
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-gradient-to-b from-white to-slate-50 p-3 sm:p-5">
                {communicationLoading ? (
                  <div className="text-sm text-slate-500">{t("common.loading")}</div>
                ) : !selectedCommunication ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                    {t("orderTracking.communication.empty", { defaultValue: "No communication thread exists yet for this order." })}
                  </div>
                ) : selectedCommunication.messages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                    {t("orderTracking.communication.noMessages", { defaultValue: "No messages yet." })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCommunication.messages.map((message) => (
                      <div key={message._id} className="rounded-xl border border-slate-200 bg-white p-3">
                        {(message.messageType === "text" || message.messageType === "system_notification") && (
                          <>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-800">{message.senderName}</p>
                              <span className="text-[11px] text-slate-500">{formatDate(message.createdAt)}</span>
                            </div>
                            <p className="text-sm text-slate-700 break-words">{message.content}</p>
                          </>
                        )}

                        {message.messageType === "feedback_request" && message.feedbackRequest && (
                          <>
                            <p className="text-sm font-semibold text-slate-900">{t("orderTracking.communication.feedbackRequired", { defaultValue: "Feedback required" })}</p>
                            <p className="mt-1 text-sm text-slate-700">{message.feedbackRequest.question}</p>

                            {message.feedbackRequest.status === "pending" && (
                              <div className="mt-3 space-y-2">
                                {respondingToMessageId === message._id ? (
                                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                                    <p className="mb-2 text-slate-700">
                                      {t("orderTracking.communication.confirmSelection", { defaultValue: "Confirm selection" })}: <strong>{pendingOption?.label}</strong>
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        className="bg-[#1a2a5e] hover:bg-[#2a3f7e]"
                                        disabled={actionBusyId === message._id || !pendingOption}
                                        onClick={() => pendingOption && handleFeedbackResponse(message._id, pendingOption)}
                                      >
                                        {t("common.confirm")}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setRespondingToMessageId(null);
                                          setPendingOption(null);
                                        }}
                                      >
                                        {t("common.cancel")}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid gap-2">
                                    {message.feedbackRequest.options.map((option) => (
                                      <Button
                                        key={option.value}
                                        variant="outline"
                                        className="justify-start"
                                        disabled={actionBusyId === message._id}
                                        onClick={() => {
                                          setRespondingToMessageId(message._id);
                                          setPendingOption(option);
                                        }}
                                      >
                                        {option.label}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {message.feedbackRequest.status === "responded" && message.feedbackRequest.response && (
                              <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs font-medium text-emerald-800">
                                {t("orderTracking.communication.response", { defaultValue: "Your response" })}: {message.feedbackRequest.response.label}
                              </div>
                            )}
                          </>
                        )}

                        {message.messageType === "quick_action" && message.quickAction && (
                          <>
                            <p className="text-sm font-semibold text-slate-900">{t("orderTracking.communication.actionRequired", { defaultValue: "Action required" })}</p>
                            <p className="mt-1 text-sm text-slate-700">{message.quickAction.actionLabel}</p>
                            {message.quickAction.description && (
                              <p className="mt-1 text-xs text-slate-500">{message.quickAction.description}</p>
                            )}

                            {message.quickAction.status === "pending" ? (
                              <Button
                                size="sm"
                                className="mt-3 bg-[#1a2a5e] hover:bg-[#2a3f7e]"
                                disabled={actionBusyId === message._id}
                                onClick={() => handleQuickActionComplete(message._id)}
                              >
                                {t("orderTracking.communication.markCompleted", { defaultValue: "Mark as completed" })}
                              </Button>
                            ) : (
                              <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs font-medium text-emerald-800">
                                {t("orderTracking.communication.actionCompleted", { defaultValue: "Action completed" })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-2">
                {canGuestWriteMessage ? (
                  <>
                    <div className="flex items-end gap-2">
                      <textarea
                        className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a2a5e]"
                        placeholder={t("orderTracking.communication.messagePlaceholder", { defaultValue: "Write your message..." })}
                        rows={2}
                        value={guestMessage}
                        onChange={(event) => setGuestMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            handleGuestMessageSend();
                          }
                        }}
                      />
                      <Button
                        className="bg-[#1a2a5e] hover:bg-[#2a3f7e]"
                        disabled={sendingGuestMessage || !guestMessage.trim()}
                        onClick={handleGuestMessageSend}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      {t("orderTracking.communication.messageHint", { defaultValue: "You can reply because this order has an active request or inbound message." })}
                    </p>
                  </>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    {t("orderTracking.communication.waitForContact", {
                      defaultValue: "Messaging is enabled once support contacts you or when a feedback/action request is pending.",
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
