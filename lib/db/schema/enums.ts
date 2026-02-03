// Invitation status enum (matches Better Auth)
export const InvitationStatus = {
	pending: "pending",
	accepted: "accepted",
	rejected: "rejected",
	canceled: "canceled",
} as const;
export type InvitationStatus =
	(typeof InvitationStatus)[keyof typeof InvitationStatus];
export const InvitationStatuses = Object.values(InvitationStatus);

// Member role enum
export const MemberRole = {
	owner: "owner",
	admin: "admin",
	member: "member",
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];
export const MemberRoles = Object.values(MemberRole);

// User role enum
export const UserRole = {
	user: "user",
	admin: "admin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const UserRoles = Object.values(UserRole);

// Order type enum (for billing)
export const OrderType = {
	subscription: "subscription",
	oneTime: "one_time",
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];
export const OrderTypes = Object.values(OrderType);

// Subscription status enum (matches Stripe subscription statuses)
export const SubscriptionStatus = {
	active: "active",
	canceled: "canceled",
	incomplete: "incomplete",
	incompleteExpired: "incomplete_expired",
	pastDue: "past_due",
	paused: "paused",
	trialing: "trialing",
	unpaid: "unpaid",
} as const;
export type SubscriptionStatus =
	(typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export const SubscriptionStatuses = Object.values(SubscriptionStatus);

// Billing interval enum
export const BillingInterval = {
	month: "month",
	year: "year",
	week: "week",
	day: "day",
} as const;
export type BillingInterval =
	(typeof BillingInterval)[keyof typeof BillingInterval];
export const BillingIntervals = Object.values(BillingInterval);

// Price type enum (recurring vs one-time)
export const PriceType = {
	recurring: "recurring",
	oneTime: "one_time",
} as const;
export type PriceType = (typeof PriceType)[keyof typeof PriceType];
export const PriceTypes = Object.values(PriceType);

// Price model enum (flat, per-seat, metered)
export const PriceModel = {
	flat: "flat",
	perSeat: "per_seat",
	metered: "metered",
} as const;
export type PriceModel = (typeof PriceModel)[keyof typeof PriceModel];
export const PriceModels = Object.values(PriceModel);

// Order status enum (for one-time payments)
export const OrderStatus = {
	pending: "pending",
	completed: "completed",
	failed: "failed",
	refunded: "refunded",
	partiallyRefunded: "partially_refunded",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const OrderStatuses = Object.values(OrderStatus);

// Lead status enum
export const LeadStatus = {
	new: "new",
	contacted: "contacted",
	qualified: "qualified",
	proposal: "proposal",
	negotiation: "negotiation",
	won: "won",
	lost: "lost",
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];
export const LeadStatuses = Object.values(LeadStatus);

// Lead source enum
export const LeadSource = {
	website: "website",
	referral: "referral",
	socialMedia: "social_media",
	advertising: "advertising",
	coldCall: "cold_call",
	email: "email",
	event: "event",
	other: "other",
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];
export const LeadSources = Object.values(LeadSource);

// Credit transaction type enum
export const CreditTransactionType = {
	purchase: "purchase", // User bought credits
	subscriptionGrant: "subscription_grant", // Monthly subscription allocation
	bonus: "bonus", // Bonus from package purchase
	promo: "promo", // Promotional credits (coupon, referral)
	usage: "usage", // Credits consumed by AI
	refund: "refund", // Credits refunded
	expire: "expire", // Credits expired
	adjustment: "adjustment", // Manual admin adjustment
} as const;
export type CreditTransactionType =
	(typeof CreditTransactionType)[keyof typeof CreditTransactionType];
export const CreditTransactionTypes = Object.values(CreditTransactionType);

// ============================================================================
// EMBER ENUMS
// ============================================================================

// Contact status enum
export const ContactStatus = {
	active: "active",
	inactive: "inactive",
	blocked: "blocked",
	merged: "merged",
} as const;
export type ContactStatus = (typeof ContactStatus)[keyof typeof ContactStatus];
export const ContactStatuses = Object.values(ContactStatus);

// Contact source type enum
export const ContactSourceType = {
	form: "form",
	whatsapp: "whatsapp",
	instagram: "instagram",
	facebook: "facebook",
	phone: "phone",
	email: "email",
	manual: "manual",
	api: "api",
} as const;
export type ContactSourceType =
	(typeof ContactSourceType)[keyof typeof ContactSourceType];
export const ContactSourceTypes = Object.values(ContactSourceType);

// Conversation status enum
export const ConversationStatus = {
	active: "active",
	closed: "closed",
	transferred: "transferred",
} as const;
export type ConversationStatus =
	(typeof ConversationStatus)[keyof typeof ConversationStatus];
export const ConversationStatuses = Object.values(ConversationStatus);

// Message direction enum
export const MessageDirection = {
	inbound: "inbound",
	outbound: "outbound",
} as const;
export type MessageDirection =
	(typeof MessageDirection)[keyof typeof MessageDirection];
export const MessageDirections = Object.values(MessageDirection);

// Message role enum
export const MessageRole = {
	user: "user",
	assistant: "assistant",
	system: "system",
	humanAgent: "human_agent",
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];
export const MessageRoles = Object.values(MessageRole);

// Message content type enum
export const MessageContentType = {
	text: "text",
	image: "image",
	audio: "audio",
	video: "video",
	document: "document",
} as const;
export type MessageContentType =
	(typeof MessageContentType)[keyof typeof MessageContentType];
export const MessageContentTypes = Object.values(MessageContentType);

// Message delivery status enum
export const MessageDeliveryStatus = {
	sent: "sent",
	delivered: "delivered",
	read: "read",
	failed: "failed",
} as const;
export type MessageDeliveryStatus =
	(typeof MessageDeliveryStatus)[keyof typeof MessageDeliveryStatus];
export const MessageDeliveryStatuses = Object.values(MessageDeliveryStatus);

// Channel type enum
export const ChannelType = {
	whatsapp: "whatsapp",
	instagram: "instagram",
	facebook: "facebook",
	email: "email",
	sms: "sms",
	calls: "calls",
	web: "web",
} as const;
export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];
export const ChannelTypes = Object.values(ChannelType);

// Agent type enum
export const AgentType = {
	sales: "sales",
	support: "support",
	scheduler: "scheduler",
	qualifier: "qualifier",
	custom: "custom",
} as const;
export type AgentType = (typeof AgentType)[keyof typeof AgentType];
export const AgentTypes = Object.values(AgentType);

// Voice provider enum
export const VoiceProvider = {
	elevenlabs: "elevenlabs",
	vapi: "vapi",
	retell: "retell",
	none: "none",
} as const;
export type VoiceProvider = (typeof VoiceProvider)[keyof typeof VoiceProvider];
export const VoiceProviders = Object.values(VoiceProvider);

// Contact agreement type enum
export const ContactAgreementType = {
	paymentPlan: "payment_plan",
	deliveryDate: "delivery_date",
	priceAgreement: "price_agreement",
	custom: "custom",
} as const;
export type ContactAgreementType =
	(typeof ContactAgreementType)[keyof typeof ContactAgreementType];
export const ContactAgreementTypes = Object.values(ContactAgreementType);

// Contact agreement status enum
export const ContactAgreementStatus = {
	active: "active",
	completed: "completed",
	cancelled: "cancelled",
} as const;
export type ContactAgreementStatus =
	(typeof ContactAgreementStatus)[keyof typeof ContactAgreementStatus];
export const ContactAgreementStatuses = Object.values(ContactAgreementStatus);

// Contact note type enum
export const ContactNoteType = {
	general: "general",
	important: "important",
	followUp: "follow_up",
} as const;
export type ContactNoteType =
	(typeof ContactNoteType)[keyof typeof ContactNoteType];
export const ContactNoteTypes = Object.values(ContactNoteType);

// Form post submit action enum
export const FormPostSubmitAction = {
	showMessage: "show_message",
	redirect: "redirect",
	startConversation: "start_conversation",
} as const;
export type FormPostSubmitAction =
	(typeof FormPostSubmitAction)[keyof typeof FormPostSubmitAction];
export const FormPostSubmitActions = Object.values(FormPostSubmitAction);

// Voice call direction enum
export const VoiceCallDirection = {
	inbound: "inbound",
	outbound: "outbound",
} as const;
export type VoiceCallDirection =
	(typeof VoiceCallDirection)[keyof typeof VoiceCallDirection];
export const VoiceCallDirections = Object.values(VoiceCallDirection);

// Voice call status enum
export const VoiceCallStatus = {
	queued: "queued",
	ringing: "ringing",
	inProgress: "in-progress",
	completed: "completed",
	failed: "failed",
	busy: "busy",
	noAnswer: "no-answer",
} as const;
export type VoiceCallStatus =
	(typeof VoiceCallStatus)[keyof typeof VoiceCallStatus];
export const VoiceCallStatuses = Object.values(VoiceCallStatus);

export function enumToPgEnum<T extends Record<string, string>>(myEnum: T) {
	return Object.values(myEnum).map((value) => value) as [
		T[keyof T],
		...T[keyof T][],
	];
}
