// Static search index for the Admin Sidebar search field.
// Each entry represents a destination the search can jump to: either a top-level
// sidebar menu item, or a specific setting/tab/function that lives on one of the
// admin pages. Keep `keywords` rich (German + English + common synonyms) so users
// can find a page by typing what they are looking for, not just its menu label.

export interface AdminSearchItem {
  /** Unique id */
  id: string
  /** Primary label shown in the results list */
  title: string
  /** Route to navigate to when selected */
  path: string
  /** Group heading used to cluster results (matches sidebar sections) */
  group: string
  /** Name of a lucide-react icon (must be mapped in AdminSidebarSearch's iconMap) */
  icon: string
  /** Extra search terms: synonyms, tab names, settings, functions on that page */
  keywords: string[]
  /** Optional short description shown under the title */
  description?: string
}

export const adminSearchIndex: AdminSearchItem[] = [
  // Allgemein
  {
    id: "dashboard",
    title: "Dashboard",
    path: "/admin",
    group: "Allgemein",
    icon: "Home",
    keywords: ["übersicht", "start", "startseite", "home"],
  },

  // Kunden & Aufträge
  {
    id: "users",
    title: "Kunden",
    path: "/admin/users",
    group: "Kunden & Aufträge",
    icon: "Users",
    description: "Kundenverwaltung",
    keywords: ["nutzer", "benutzer", "kundenverwaltung", "user management", "kundendetails", "kunde bearbeiten", "kunde löschen"],
  },
  {
    id: "bookings",
    title: "Aufträge",
    path: "/admin/bookings",
    group: "Kunden & Aufträge",
    icon: "BookMarked",
    description: "Buchungsverwaltung",
    keywords: [
      "buchungen", "buchungsverwaltung", "bookings", "rechnung erstellen", "erinnerung erstellen",
      "reklamation erfassen", "versandlabel erstellen", "buchung stornieren", "auftrag details",
    ],
  },
  {
    id: "orders",
    title: "Bestellungen",
    path: "/admin/orders",
    group: "Kunden & Aufträge",
    icon: "ExternalLink",
    description: "Order Directory",
    keywords: ["order management", "order directory", "order details", "bestellverwaltung", "auftragsdetails"],
  },
  {
    id: "financial",
    title: "Rechnungen",
    path: "/admin/financial",
    group: "Kunden & Aufträge",
    icon: "DollarSign",
    description: "Finanzverwaltung",
    keywords: [
      "financial management", "invoices", "rechnungsübersicht", "mahnwesen", "dunning", "mahnlauf",
      "zahlungsprozesse", "zahlungsgateways", "payment gateways", "teilzahlung", "gutschrift erstellen",
      "erstattung", "refund", "steuer", "währung", "fristen", "rabatte", "zahlungslogik",
      "rechnungs meta daten", "berichte export", "csv export", "json export", "einstellungen rechnung",
    ],
  },

  // Anfragen
  {
    id: "repair-requests",
    title: "Reparaturanfragen",
    path: "/admin/repair-requests",
    group: "Anfragen",
    icon: "FileText",
    keywords: [
      "anfragen", "reparaturanfrage details", "nachricht senden", "mitarbeiter zuweisen",
      "in auftrag umwandeln", "anfrage löschen",
    ],
  },
  {
    id: "contact-requests",
    title: "Kontaktanfragen",
    path: "/admin/contact-requests",
    group: "Anfragen",
    icon: "MessageSquare",
    keywords: ["kontaktformular", "nachrichten kunden", "contact requests"],
  },
  {
    id: "complaints",
    title: "Reklamationen",
    path: "/admin/complaints",
    group: "Anfragen",
    icon: "AlertCircle",
    description: "Reklamationsmanagement",
    keywords: ["reklamationsmanagement", "beschwerden", "complaints management", "aktionen reklamation"],
  },

  // Teile & Personal
  {
    id: "epart-orders",
    title: "Ersatzteilbestellungen",
    path: "/admin/epart-orders",
    group: "Teile & Personal",
    icon: "Boxes",
    keywords: ["epart order management", "ersatzteile bestellen", "teile bestellung"],
  },
  {
    id: "parts",
    title: "Teileverwaltung",
    path: "/admin/parts",
    group: "Teile & Personal",
    icon: "Package2",
    keywords: ["parts management", "ersatzteile", "basic info", "versions", "additional", "lagerbestand"],
  },
  {
    id: "staff",
    title: "Personalverwaltung",
    path: "/admin/staff",
    group: "Teile & Personal",
    icon: "UserCheck",
    keywords: [
      "staff management", "mitarbeiter", "team", "teams", "status", "arbeitslast", "workload",
      "performance", "leistung", "aufgaben", "tasks", "mitarbeiter anlegen", "team anlegen",
      "zeiterfassung", "time tracking",
    ],
  },

  // Analysen
  {
    id: "analytics",
    title: "Analysen",
    path: "/admin/analytics",
    group: "Analysen",
    icon: "BarChart3",
    keywords: [
      "analytics", "monatsverlauf", "statistiken", "berichte", "backend konfiguration",
      "controlling ansicht", "order datensätze", "preiskalkulation", "zeit", "material",
      "gemeinkosten", "rechenweg", "garantie", "kennzahlen", "kpi",
    ],
  },

  // System Management
  {
    id: "customer-groups",
    title: "Kundengruppen",
    path: "/admin/customer-groups",
    group: "System Management",
    icon: "Layers",
    keywords: [
      "customer groups", "gruppen", "regeln", "regel engine", "zuweisungen", "primärgruppe",
      "finanzeinstellungen", "affiliate", "provisionen", "commissions", "reporting", "audit",
    ],
  },
  {
    id: "services",
    title: "Dienstverwaltung",
    path: "/admin/services",
    group: "System Management",
    icon: "Wrench",
    keywords: [
      "service management", "reparaturdienste", "repair services", "basic info", "device repair",
      "knowledge base", "dienstleistungen bearbeiten",
    ],
  },
  {
    id: "service-categories",
    title: "Service Categories",
    path: "/admin/service-categories",
    group: "System Management",
    icon: "FolderTree",
    keywords: [
      "servicekategorien", "kategorien filtern", "repair categories", "add-on categories",
      "aktive kategorien",
    ],
  },
  {
    id: "addons",
    title: "Zusatzdienste",
    path: "/admin/addons",
    group: "System Management",
    icon: "Plus",
    keywords: ["addon service management", "add-ons", "zusatzleistungen"],
  },
  {
    id: "devices",
    title: "Gerätemarken",
    path: "/admin/devices",
    group: "System Management",
    icon: "Smartphone",
    keywords: [
      "device brands", "gerätetypen", "modelle", "marken", "dashboard geräte", "quick actions",
      "bulk changes", "update parameter", "geräteverwaltung",
    ],
  },
  {
    id: "workflow",
    title: "Workflowverwaltung",
    path: "/admin/workflow",
    group: "System Management",
    icon: "GitBranch",
    keywords: ["workflow management", "reparaturworkflow", "prozessverwaltung"],
  },
  {
    id: "system",
    title: "Systemkonfiguration",
    path: "/admin/system",
    group: "System Management",
    icon: "Settings",
    keywords: [
      "system configuration", "allgemeine einstellungen", "general settings", "benachrichtigungen einstellungen",
      "notifications", "sms push providers", "integrationen", "integrations", "workflows einstellungen",
      "sicherheit", "security", "inhalte", "content", "sprachen", "languages", "system actions",
    ],
  },
  {
    id: "database",
    title: "Datenbankverwaltung",
    path: "/admin/database",
    group: "System Management",
    icon: "Database",
    keywords: [
      "database management", "übersicht datenbank", "collections", "operations", "backups",
      "maintenance", "wartung", "datenbankgröße", "indexes", "collection statistics",
    ],
  },
  {
    id: "security",
    title: "Sicherheitseinstellungen",
    path: "/admin/security",
    group: "System Management",
    icon: "Shield",
    keywords: [
      "security settings", "einstellungen sicherheit", "monitoring", "security events",
      "audit log", "protokoll", "2fa", "zugriffskontrolle",
    ],
  },
  {
    id: "email",
    title: "Email-Verwaltung",
    path: "/admin/email",
    group: "System Management",
    icon: "Mail",
    keywords: [
      "email administration", "statistiken email", "verlauf", "history", "protokolle", "logs",
      "smtp konfiguration", "smtp config", "email einstellungen", "email settings",
    ],
  },
  {
    id: "live-tracking",
    title: "Live Tracking",
    path: "/admin/live-tracking",
    group: "System Management",
    icon: "Activity",
    keywords: [
      "tracking live", "aktive sessions", "live event stream", "analytics tracking", "events",
      "besucher tracking",
    ],
  },

  // Content Management
  {
    id: "shop",
    title: "Webshop-Verwaltung",
    path: "/admin/shop",
    group: "Content Management",
    icon: "ShoppingBag",
    keywords: ["webshop management", "produkte", "products", "shop verwalten"],
  },
  {
    id: "blog",
    title: "Blog-Verwaltung",
    path: "/admin/blog",
    group: "Content Management",
    icon: "FileText",
    keywords: [
      "blog management", "beiträge", "posts", "veröffentlicht", "published", "entwürfe", "draft",
      "aufrufe", "views",
    ],
  },
  {
    id: "faq",
    title: "FAQ-Verwaltung",
    path: "/admin/faq",
    group: "Content Management",
    icon: "HelpCircle",
    keywords: [
      "faq management", "häufige fragen", "kategorien faq", "aufrufe", "hilfreiche stimmen",
      "helpful votes",
    ],
  },
  {
    id: "homepage",
    title: "Homepage-Verwaltung",
    path: "/admin/homepage",
    group: "Content Management",
    icon: "Layout",
    keywords: [
      "homepage management", "content", "layout", "design", "animation", "advanced", "section",
      "block", "startseite bearbeiten",
    ],
  },
  {
    id: "website-builder",
    title: "Website Builder",
    path: "/admin/website-builder",
    group: "Content Management",
    icon: "Layout",
    keywords: ["visual page builder", "seiten erstellen", "seiteneditor"],
  },
  {
    id: "seo",
    title: "SEO-Verwaltung",
    path: "/admin/seo",
    group: "Content Management",
    icon: "Search",
    keywords: [
      "seo management", "seo einstellungen", "seo settings", "sitemap", "seitentypen", "page types",
      "indexierbare seiten", "indexable pages", "meta tags",
    ],
  },

  // Marketing/Promo
  {
    id: "marketing-promo",
    title: "Marketing/Promo Übersicht",
    path: "/admin/marketing-promo",
    group: "Marketing/Promo",
    icon: "Megaphone",
    keywords: ["marketing overview", "promo übersicht"],
  },
  {
    id: "marketing-promo-newsletters",
    title: "Newsletter",
    path: "/admin/marketing-promo/newsletters",
    group: "Marketing/Promo",
    icon: "Mail",
    keywords: ["newsletter verwaltung", "email kampagnen", "newsletter versenden"],
  },
  {
    id: "marketing-promo-codes",
    title: "Promo Codes",
    path: "/admin/marketing-promo/promo-codes",
    group: "Marketing/Promo",
    icon: "DollarSign",
    keywords: ["gutscheincodes", "rabattcodes", "coupons", "promo code erstellen"],
  },
  {
    id: "marketing-promo-segments",
    title: "Segmente",
    path: "/admin/marketing-promo/segments",
    group: "Marketing/Promo",
    icon: "Layers",
    keywords: ["kundensegmente", "segments", "zielgruppen"],
  },
  {
    id: "marketing-promo-reports",
    title: "Marketing Reports",
    path: "/admin/marketing-promo/reports",
    group: "Marketing/Promo",
    icon: "BarChart3",
    keywords: ["marketing berichte", "reports", "kampagnenauswertung"],
  },
  {
    id: "marketing-promo-settings",
    title: "Marketing Einstellungen",
    path: "/admin/marketing-promo/settings",
    group: "Marketing/Promo",
    icon: "Settings",
    keywords: ["marketing settings", "promo einstellungen"],
  },
  {
    id: "marketing-promo-adcell",
    title: "ADCELL Tracking",
    path: "/admin/marketing-promo/adcell",
    group: "Marketing/Promo",
    icon: "Radio",
    keywords: ["adcell", "affiliate tracking", "partnerprogramm tracking"],
  },

  // Persönlich
  {
    id: "messages",
    title: "Nachrichten",
    path: "/messages",
    group: "Persönlich",
    icon: "MessageSquare",
    keywords: ["messages", "chat", "kommunikation"],
  },
  {
    id: "notifications",
    title: "Benachrichtigungen",
    path: "/notifications",
    group: "Persönlich",
    icon: "Bell",
    keywords: ["notifications", "benachrichtigungen einstellungen"],
  },
  {
    id: "profile",
    title: "Profil",
    path: "/profile",
    group: "Persönlich",
    icon: "User",
    keywords: ["profile", "eigenes profil", "account einstellungen"],
  },
]
