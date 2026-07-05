export interface Event {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  date: string;
  time: string;
  endDate?: string;
  endTime?: string;
  venue: string;
  city: string;
  image: string;
  gallery?: string[];
  organizerId: string;
  organizerName: string;
  organizerCategory?: OrganizerCategory;
  organizerSubtype?: string;
  ticketTypes: TicketType[];
  totalTickets: number;
  soldTickets: number;
  status: "draft" | "published" | "cancelled" | "completed";
  createdAt: string;
  updatedAt: string;
  platformMarkup?: number; // Admin can add markup percentage
  promoVideo?: {
    type: "video" | "slideshow";
    url: string;
    duration: number; // in seconds
    thumbnail?: string;
  };
  // Platform-negotiated event (trade secret - only for accounting)
  platformNegotiated?: {
    isPlatformEvent: boolean; // true if platform is selling on behalf of organizer
    originalOrganizerId: string; // actual event creator
    originalOrganizerName: string; // actual event creator name
    originalTicketPrices: Record<string, number>; // original prices by ticket type ID
    platformMarkupAmount: Record<string, number>; // markup amount by ticket type ID
  };
}

export type EventCategory =
  | "comedy"
  | "music"
  | "sports"
  | "marathon"
  | "conference"
  | "workshop"
  | "festival"
  | "theater"
  | "exhibition"
  | "other";

export interface TicketType {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: "USD";
  quantity: number;
  sold: number;
  markup?: number;
}

export interface Ticket {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ticketTypeName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  buyerName: string;
  buyerContact: string;
  buyerDisplayName: string;
  price: number;
  markup: number;
  totalPaid: number;
  currency: "USD";
  paymentMethod: PaymentMethod;
  paymentStatus: "pending" | "completed" | "failed" | "refunded";
  qrCode: string;
  validated: boolean;
  validatedAt?: string;
  validatedBy?: string;
  admittedAt?: string;
  admittedBy?: string;
  isAdmitted: boolean;
  purchasedAt: string;
  saleType: "online" | "gate";
}

export type PaymentMethod = "ecocash" | "innbucks" | "visa" | "mastercard" | "cash" | "stripe" | "paynow" | "epay";

export type PaymentProvider = "stripe" | "paynow" | "epay" | "mobile_money" | "card" | "cash";

export interface Banner {
  id: string;
  type: "hero" | "section";
  position: number;
  image?: string;
  link?: string;
  title?: string;
  organizerId?: string;
  startDate?: string;
  endDate?: string;
  pricePerDay: number;
  status: "active" | "available" | "pending" | "expired";
}

export interface Organizer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  organizerCategory?: OrganizerCategory;
  organizerSubtype?: string;
  verified: boolean;
  totalEvents: number;
  totalRevenue: number;
  pendingPayout: number;
  joinedAt: string;
}

export interface StaffMember {
  id: string;
  organizerId: string;
  name: string;
  email: string;
  phone: string;
  role: "gate_manager" | "ticket_seller";
  assignedEvents: string[];
  isActive: boolean;
  createdAt: string;
}

export interface PayoutRequest {
  id: string;
  organizerId: string;
  organizerName: string;
  amount: number;
  currency: "USD";
  status: "pending" | "processing" | "approved" | "declined";
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  declineReason?: string;
  paymentMethod: string;
  paymentDetails: string;
  transactionCost: number;
}

export type UserRole = "super_admin" | "admin" | "organizer" | "staff" | "customer";

export type OrganizerCategory =
  | "music_entertainment"
  | "event_lifestyle"
  | "education_professional"
  | "digital_creator";

export const ORGANIZER_CATEGORIES: { value: OrganizerCategory; label: string; subtypes: string[] }[] = [
  {
    value: "music_entertainment",
    label: "Music & Entertainment",
    subtypes: [
      "Music Artist / DJ",
      "Record Label",
      "Artist Manager / Talent Manager",
      "Comedy Club / Stand-up Comedian",
      "Theatre Production Company",
    ],
  },
  {
    value: "event_lifestyle",
    label: "Event & Lifestyle",
    subtypes: [
      "Event Planner / Management Company",
      "Nightclub / Lounge",
      "Festival Organizer",
      "Fashion Designer / Fashion House",
      "Wedding / Expo Organizer",
    ],
  },
  {
    value: "education_professional",
    label: "Education & Professional",
    subtypes: [
      "Conference Organizer / Corporate Firm",
      "Startup Community / Tech Hub",
      "Professional Trainer / Coach",
      "University / College",
      "NGO / Non-Profit",
    ],
  },
  {
    value: "digital_creator",
    label: "Digital & Creator Economy",
    subtypes: [
      "Content Creator / Influencer",
      "Podcast Host / Media Creator",
      "Gaming Community / Esports Organizer",
      "YouTube / TikTok Collective",
      "Online Course Creator",
    ],
  },
];

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  organizerId?: string;
  organizerCategory?: OrganizerCategory;
  organizerSubtype?: string;
  avatar?: string;
  verified: boolean;
  isSuspended?: boolean;
  createdAt: string;
  password?: string;
}

export interface GateSale {
  id: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerName: string;
  buyerContact?: string;
  totalAmount: number;
  currency: "USD";
  soldBy: string;
  soldAt: string;
  tickets: string[];
}

export interface PurchaseFormData {
  ticketTypeId: string;
  quantity: number;
  buyerName: string;
  buyerContact: string;
  buyerDisplayName: string;
  paymentMethod: PaymentMethod;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string; provider: PaymentProvider }[] = [
  { value: "stripe", label: "Card Payment", icon: "credit-card", provider: "stripe" },
  { value: "paynow", label: "Paynow", icon: "phone", provider: "paynow" },
  { value: "epay", label: "ePay", icon: "credit-card", provider: "epay" },
  { value: "ecocash", label: "EcoCash", icon: "phone", provider: "mobile_money" },
  { value: "innbucks", label: "InnBucks", icon: "phone", provider: "mobile_money" },
  { value: "visa", label: "Visa Card", icon: "credit-card", provider: "card" },
  { value: "mastercard", label: "Mastercard", icon: "credit-card", provider: "card" },
];

export const GATE_PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "ecocash", label: "EcoCash" },
  { value: "innbucks", label: "InnBucks" },
];

export const ONLINE_PAYMENT_PROVIDERS = [
  {
    id: "stripe" as PaymentProvider,
    name: "Stripe",
    description: "International card payments — powered by Stripe",
    banner: "/payments/stripe-banner.png",
    active: true,
    methods: [],
  },
  {
    id: "paynow" as PaymentProvider,
    name: "Paynow",
    description: "Zimbabwe's local payment gateway — powered by Paynow",
    banner: "/payments/paynow-banner.png",
    active: true,
    methods: [],
  },
  {
    id: "epay" as PaymentProvider,
    name: "ePay",
    description: "Coming soon - Visa, Mastercard & more",
    banner: "/payments/e-pay-banner.png",
    active: false,
    methods: [],
  },
  {
    id: "zglobal" as PaymentProvider,
    name: "Z-Global Chat n Pay",
    description: "Coming soon - Chat-based payment solution",
    banner: "/payments/Z-Global-Pay-Banner.png",
    active: false,
    methods: [],
  },
];

export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "comedy", label: "Comedy" },
  { value: "music", label: "Music" },
  { value: "sports", label: "Sports" },
  { value: "marathon", label: "Marathon" },
  { value: "conference", label: "Conference" },
  { value: "workshop", label: "Workshop" },
  { value: "festival", label: "Festival" },
  { value: "theater", label: "Theater" },
  { value: "exhibition", label: "Exhibition" },
  { value: "other", label: "Other" },
];

export const PLATFORM_FEE_PERCENTAGE = 10;
export const HERO_BANNER_PRICE_PER_DAY = 20;
export const SECTION_BANNER_PRICE_PER_DAY = 10;
export const ANNOUNCEMENT_AD_PRICE_PER_2_WEEKS = 50;
export const MINIMUM_PAYOUT = 10;
export const PAYOUT_TRANSACTION_COST_PERCENTAGE = 5;

export interface PayoutField {
  label: string;
  placeholder: string;
  type?: "text" | "number" | "email";
  required?: boolean;
}

export const PAYOUT_METHODS: { value: string; label: string; fields: PayoutField[] }[] = [
  {
    value: "ecocash",
    label: "EcoCash",
    fields: [
      { label: "EcoCash Number", placeholder: "e.g., 0771234567", type: "text", required: true },
      { label: "Account Holder Name", placeholder: "Name on EcoCash account", type: "text", required: true },
      { label: "Reference (Optional)", placeholder: "Transaction reference", type: "text", required: false },
    ],
  },
  {
    value: "innbucks",
    label: "InnBucks",
    fields: [
      { label: "InnBucks Number", placeholder: "Enter InnBucks number", type: "text", required: true },
      { label: "Account Name", placeholder: "Account holder name", type: "text", required: true },
    ],
  },
  {
    value: "omari",
    label: "Omari",
    fields: [
      { label: "Omari Number", placeholder: "Enter Omari number", type: "text", required: true },
      { label: "Account Name", placeholder: "Account holder name", type: "text", required: true },
    ],
  },
  {
    value: "bank_transfer",
    label: "Bank Transfer (ZIPIT)",
    fields: [
      { label: "Bank Name", placeholder: "e.g., CBZ, FBC, Stanbic", type: "text", required: true },
      { label: "Account Number", placeholder: "Your bank account number", type: "text", required: true },
      { label: "Account Holder Name", placeholder: "Name on bank account", type: "text", required: true },
      { label: "Branch (Optional)", placeholder: "Bank branch name", type: "text", required: false },
    ],
  },
  {
    value: "zglobal_pay",
    label: "Z-Global Pay",
    fields: [
      { label: "Z-Global Pay ID", placeholder: "Enter Z-Global Pay ID", type: "text", required: true },
      { label: "Phone Number", placeholder: "Linked phone number", type: "text", required: true },
    ],
  },
  {
    value: "one_money",
    label: "OneMoney",
    fields: [
      { label: "OneMoney Number", placeholder: "Enter OneMoney number", type: "text", required: true },
      { label: "Account Name", placeholder: "Account holder name", type: "text", required: true },
    ],
  },
  {
    value: "telecash",
    label: "Telecash",
    fields: [
      { label: "Telecash Number", placeholder: "Enter Telecash number", type: "text", required: true },
      { label: "Account Name", placeholder: "Account holder name", type: "text", required: true },
    ],
  },
  {
    value: "zipit",
    label: "ZIPIT",
    fields: [
      { label: "Bank Name", placeholder: "e.g., CBZ, FBC, Stanbic", type: "text", required: true },
      { label: "Account Number", placeholder: "Your bank account number", type: "text", required: true },
      { label: "Account Holder Name", placeholder: "Name on bank account", type: "text", required: true },
    ],
  },
  {
    value: "cash_pickup",
    label: "Cash Pick-Up",
    fields: [
      { label: "Pickup Location", placeholder: "City/Location for pickup", type: "text", required: true },
      { label: "Preferred Date", placeholder: "Preferred pickup date", type: "text", required: true },
      { label: "Contact Number", placeholder: "Contact number for coordination", type: "text", required: true },
      { label: "ID Type", placeholder: "ID type for verification", type: "text", required: true },
    ],
  },
  {
    value: "crypto",
    label: "Cryptocurrency",
    fields: [
      { label: "Wallet Address", placeholder: "Your wallet address", type: "text", required: true },
      { label: "Cryptocurrency", placeholder: "e.g., Bitcoin, Ethereum, USDT", type: "text", required: true },
      { label: "Network", placeholder: "e.g., TRC20, ERC20, BEP20", type: "text", required: true },
    ],
  },
];
