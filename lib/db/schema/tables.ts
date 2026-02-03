import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import {
	AgentType,
	BillingInterval,
	ChannelType,
	ContactAgreementStatus,
	ContactAgreementType,
	ContactNoteType,
	ContactSourceType,
	ContactStatus,
	ConversationStatus,
	CreditTransactionType,
	enumToPgEnum,
	FormPostSubmitAction,
	InvitationStatus,
	LeadSource,
	LeadStatus,
	MemberRole,
	MessageContentType,
	MessageDeliveryStatus,
	MessageDirection,
	MessageRole,
	OrderStatus,
	PriceModel,
	PriceType,
	SubscriptionStatus,
	UserRole,
	VoiceCallDirection,
	VoiceCallStatus,
	VoiceProvider,
} from "./enums";

export const accountTable = pgTable(
	"account",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		password: text("password"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("account_user_id_idx").on(table.userId),
		uniqueIndex("account_provider_account_idx").on(
			table.providerId,
			table.accountId,
		),
	],
);

export const invitationTable = pgTable(
	"invitation",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role", { enum: enumToPgEnum(MemberRole) })
			.$type<MemberRole>()
			.notNull()
			.default(MemberRole.member),
		status: text("status", { enum: enumToPgEnum(InvitationStatus) })
			.$type<InvitationStatus>()
			.notNull()
			.default(InvitationStatus.pending),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		inviterId: uuid("inviter_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("invitation_organization_id_idx").on(table.organizationId),
		index("invitation_email_idx").on(table.email),
		index("invitation_status_idx").on(table.status),
		index("invitation_expires_at_idx").on(table.expiresAt),
		index("invitation_inviter_id_idx").on(table.inviterId),
	],
);

export const memberTable = pgTable(
	"member",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		role: text("role", { enum: enumToPgEnum(MemberRole) })
			.$type<MemberRole>()
			.notNull()
			.default(MemberRole.member),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("member_user_org_idx").on(table.userId, table.organizationId),
		index("member_organization_id_idx").on(table.organizationId),
		index("member_user_id_idx").on(table.userId),
		index("member_role_idx").on(table.role),
	],
);

export const organizationTable = pgTable(
	"organization",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		slug: text("slug"),
		logo: text("logo"),
		metadata: text("metadata"),
		stripeCustomerId: text("stripe_customer_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("organization_slug_idx").on(table.slug),
		index("organization_name_idx").on(table.name),
		index("organization_stripe_customer_id_idx").on(table.stripeCustomerId),
	],
);

export const sessionTable = pgTable(
	"session",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		impersonatedBy: uuid("impersonated_by").references(() => userTable.id),
		activeOrganizationId: uuid("active_organization_id"),
		token: text("token").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("session_token_idx").on(table.token),
		index("session_user_id_idx").on(table.userId),
		index("session_expires_at_idx").on(table.expiresAt),
		index("session_active_organization_id_idx").on(table.activeOrganizationId),
	],
);

export const twoFactorTable = pgTable(
	"two_factor",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [uniqueIndex("two_factor_user_id_idx").on(table.userId)],
);

export const userTable = pgTable(
	"user",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: boolean("email_verified").notNull().default(false),
		image: text("image"),
		username: text("username").unique(),
		role: text("role", { enum: enumToPgEnum(UserRole) })
			.$type<UserRole>()
			.notNull()
			.default(UserRole.user),
		banned: boolean("banned").default(false),
		banReason: text("ban_reason"),
		banExpires: timestamp("ban_expires", { withTimezone: true }),
		onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
		twoFactorEnabled: boolean("two_factor_enabled").default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("user_email_idx").on(table.email),
		uniqueIndex("user_username_idx").on(table.username),
		index("user_role_idx").on(table.role),
		index("user_banned_idx").on(table.banned),
	],
);

export const verificationTable = pgTable(
	"verification",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("verification_identifier_idx").on(table.identifier),
		index("verification_value_idx").on(table.value),
		index("verification_expires_at_idx").on(table.expiresAt),
	],
);

// ============================================================================
// BILLING TABLES
// ============================================================================

/**
 * Subscription table - stores active subscriptions from Stripe
 * This is a more detailed approach than a simple "order" table,
 * allowing for proper subscription lifecycle management.
 */
export const subscriptionTable = pgTable(
	"subscription",
	{
		id: text("id").primaryKey(), // Stripe subscription ID (sub_xxx)
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		stripeCustomerId: text("stripe_customer_id").notNull(),
		status: text("status", { enum: enumToPgEnum(SubscriptionStatus) })
			.$type<SubscriptionStatus>()
			.notNull(),
		// Price/Product info
		stripePriceId: text("stripe_price_id").notNull(),
		stripeProductId: text("stripe_product_id"),
		// Quantity (for per-seat billing)
		quantity: integer("quantity").notNull().default(1),
		// Billing interval
		interval: text("interval", { enum: enumToPgEnum(BillingInterval) })
			.$type<BillingInterval>()
			.notNull(),
		intervalCount: integer("interval_count").notNull().default(1),
		// Pricing
		unitAmount: integer("unit_amount"), // Amount in cents
		currency: text("currency").notNull().default("usd"),
		// Period dates
		currentPeriodStart: timestamp("current_period_start", {
			withTimezone: true,
		}).notNull(),
		currentPeriodEnd: timestamp("current_period_end", {
			withTimezone: true,
		}).notNull(),
		// Trial dates
		trialStart: timestamp("trial_start", { withTimezone: true }),
		trialEnd: timestamp("trial_end", { withTimezone: true }),
		// Cancellation
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		canceledAt: timestamp("canceled_at", { withTimezone: true }),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("subscription_organization_id_idx").on(table.organizationId),
		index("subscription_stripe_customer_id_idx").on(table.stripeCustomerId),
		index("subscription_status_idx").on(table.status),
		index("subscription_stripe_price_id_idx").on(table.stripePriceId),
		// Composite index for common query: active subscriptions by organization
		index("subscription_org_status_idx").on(table.organizationId, table.status),
	],
);

/**
 * Subscription item table - stores individual line items for a subscription
 * Supports per-seat pricing, metered billing, and multiple prices per subscription
 */
export const subscriptionItemTable = pgTable(
	"subscription_item",
	{
		id: text("id").primaryKey(), // Stripe subscription item ID (si_xxx)
		subscriptionId: text("subscription_id")
			.notNull()
			.references(() => subscriptionTable.id, { onDelete: "cascade" }),
		// Price/Product info
		stripePriceId: text("stripe_price_id").notNull(),
		stripeProductId: text("stripe_product_id"),
		// Quantity (for per-seat billing)
		quantity: integer("quantity").notNull().default(1),
		// Price details
		priceAmount: integer("price_amount"), // Amount in cents per unit
		// Pricing model
		priceType: text("price_type", { enum: enumToPgEnum(PriceType) })
			.$type<PriceType>()
			.notNull()
			.default(PriceType.recurring),
		priceModel: text("price_model", { enum: enumToPgEnum(PriceModel) })
			.$type<PriceModel>()
			.notNull()
			.default(PriceModel.flat),
		// Billing interval (for recurring)
		interval: text("interval", {
			enum: enumToPgEnum(BillingInterval),
		}).$type<BillingInterval>(),
		intervalCount: integer("interval_count").default(1),
		// Metered billing
		meterId: text("meter_id"), // Stripe meter ID for usage-based billing
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("subscription_item_subscription_id_idx").on(table.subscriptionId),
		index("subscription_item_stripe_price_id_idx").on(table.stripePriceId),
		index("subscription_item_price_model_idx").on(table.priceModel),
	],
);

/**
 * Order table - stores one-time payments (lifetime deals, credits, etc.)
 * This is the order header; individual items are stored in order_item
 */
export const orderTable = pgTable(
	"order",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		stripeCustomerId: text("stripe_customer_id").notNull(),
		stripePaymentIntentId: text("stripe_payment_intent_id"), // pi_xxx
		stripeCheckoutSessionId: text("stripe_checkout_session_id"), // cs_xxx
		// Totals (sum of all items)
		totalAmount: integer("total_amount").notNull(), // Total amount in cents
		currency: text("currency").notNull().default("usd"),
		// Status
		status: text("status", { enum: enumToPgEnum(OrderStatus) })
			.$type<OrderStatus>()
			.notNull()
			.default(OrderStatus.completed),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("order_organization_id_idx").on(table.organizationId),
		index("order_stripe_customer_id_idx").on(table.stripeCustomerId),
		index("order_status_idx").on(table.status),
		index("order_payment_intent_id_idx").on(table.stripePaymentIntentId),
		index("order_checkout_session_id_idx").on(table.stripeCheckoutSessionId),
	],
);

/**
 * Order item table - stores individual line items for an order
 * Supports multiple products/prices per order
 */
export const orderItemTable = pgTable(
	"order_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orderTable.id, { onDelete: "cascade" }),
		// Price/Product info
		stripePriceId: text("stripe_price_id").notNull(),
		stripeProductId: text("stripe_product_id"),
		// Quantity and pricing
		quantity: integer("quantity").notNull().default(1),
		unitAmount: integer("unit_amount").notNull(), // Price per unit in cents
		totalAmount: integer("total_amount").notNull(), // quantity * unitAmount
		// Description (from Stripe line item)
		description: text("description"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("order_item_order_id_idx").on(table.orderId),
		index("order_item_stripe_price_id_idx").on(table.stripePriceId),
	],
);

/**
 * Billing event log - audit trail for all billing events
 * Useful for debugging and customer support
 */
export const billingEventTable = pgTable(
	"billing_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id").references(
			() => organizationTable.id,
			{ onDelete: "set null" },
		),
		stripeEventId: text("stripe_event_id").notNull().unique(), // evt_xxx
		eventType: text("event_type").notNull(), // e.g., "customer.subscription.created"
		// Reference to related entities
		subscriptionId: text("subscription_id"),
		orderId: uuid("order_id"),
		// Raw event data for debugging
		eventData: text("event_data"), // JSON stringified
		// Processing status
		processed: boolean("processed").notNull().default(true),
		error: text("error"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("billing_event_organization_id_idx").on(table.organizationId),
		index("billing_event_event_type_idx").on(table.eventType),
		index("billing_event_subscription_id_idx").on(table.subscriptionId),
		index("billing_event_created_at_idx").on(table.createdAt),
	],
);

/**
 * Credit balance per organization
 * Denormalized for fast reads - single row per org
 */
export const creditBalanceTable = pgTable(
	"credit_balance",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.unique()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Current balance (can be large for high-volume orgs)
		balance: integer("balance").notNull().default(0),
		// Lifetime stats for analytics
		lifetimePurchased: integer("lifetime_purchased").notNull().default(0),
		lifetimeGranted: integer("lifetime_granted").notNull().default(0), // Free/promo
		lifetimeUsed: integer("lifetime_used").notNull().default(0),
		lifetimeExpired: integer("lifetime_expired").notNull().default(0),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("credit_balance_organization_id_idx").on(table.organizationId),
	],
);

/**
 * Credit deduction failure log - tracks failed deductions for reconciliation
 * When credit deduction fails after AI response is already sent, we log it here
 */
export const creditDeductionFailureTable = pgTable(
	"credit_deduction_failure",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Amount that should have been deducted
		amount: integer("amount").notNull(),
		// Error details
		errorCode: text("error_code").notNull(), // 'INSUFFICIENT_CREDITS', 'DB_ERROR', etc.
		errorMessage: text("error_message"),
		// Context
		model: text("model"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		referenceType: text("reference_type"), // 'ai_chat', etc.
		referenceId: text("reference_id"),
		// Who triggered the request
		userId: uuid("user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Resolution tracking
		resolved: boolean("resolved").notNull().default(false),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		resolvedBy: uuid("resolved_by").references(() => userTable.id, {
			onDelete: "set null",
		}),
		resolutionNotes: text("resolution_notes"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("credit_deduction_failure_org_idx").on(table.organizationId),
		index("credit_deduction_failure_resolved_idx").on(table.resolved),
		index("credit_deduction_failure_created_idx").on(table.createdAt),
	],
);

/**
 * Credit transaction ledger - immutable audit trail
 * Every credit change is recorded here
 */
export const creditTransactionTable = pgTable(
	"credit_transaction",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Transaction type
		type: text("type", { enum: enumToPgEnum(CreditTransactionType) })
			.$type<CreditTransactionType>()
			.notNull(),
		// Amount: positive = add credits, negative = deduct credits
		amount: integer("amount").notNull(),
		// Running balance after this transaction
		balanceAfter: integer("balance_after").notNull(),
		// Description shown to user
		description: text("description"),
		// Reference to source (order, subscription, chat, etc.)
		referenceType: text("reference_type"), // 'order', 'subscription', 'ai_chat', 'admin', etc.
		referenceId: text("reference_id"),
		// AI usage details (for usage transactions)
		model: text("model"), // 'gpt-4o-mini', 'gpt-4o', etc.
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		// Who initiated this transaction
		createdBy: uuid("created_by").references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Metadata for additional context
		metadata: text("metadata"), // JSON stringified
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("credit_transaction_organization_id_idx").on(table.organizationId),
		index("credit_transaction_type_idx").on(table.type),
		index("credit_transaction_created_at_idx").on(table.createdAt),
		index("credit_transaction_reference_idx").on(
			table.referenceType,
			table.referenceId,
		),
		// Composite for org history queries
		index("credit_transaction_org_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
		// Composite index for org+type filtering
		index("credit_transaction_org_type_idx").on(
			table.organizationId,
			table.type,
		),
		// Unique constraint for checkout session idempotency (partial index)
		// This prevents double-crediting from webhook retries
		uniqueIndex("credit_transaction_checkout_unique")
			.on(table.referenceType, table.referenceId)
			.where(sql`${table.referenceType} = 'checkout_session'`),
		// Unique constraint for bonus credits idempotency (partial index)
		// This prevents double bonus credits from webhook retries
		uniqueIndex("credit_transaction_bonus_unique")
			.on(table.referenceType, table.referenceId)
			.where(sql`${table.referenceType} = 'checkout_session_bonus'`),
	],
);

// ============================================================================
// AI CHAT TABLE
// ============================================================================

/**
 * AI Chat table - stores chat conversations with AI
 * Supports both user-level and organization-level chats
 * Note: At least one of organizationId or userId must be non-null (enforced by check constraint)
 */
export const aiChatTable = pgTable(
	"ai_chat",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id").references(
			() => organizationTable.id,
			{ onDelete: "cascade" },
		),
		userId: uuid("user_id").references(() => userTable.id, {
			onDelete: "cascade",
		}),
		title: text("title"),
		messages: text("messages"), // JSON stringified array of messages
		pinned: boolean("pinned").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("ai_chat_organization_id_idx").on(table.organizationId),
		index("ai_chat_user_id_idx").on(table.userId),
		index("ai_chat_created_at_idx").on(table.createdAt),
		// Ensure at least one owner is set - prevent orphaned chats
		check(
			"ai_chat_has_owner",
			sql`${table.organizationId} IS NOT NULL OR ${table.userId} IS NOT NULL`,
		),
	],
);

// ============================================================================
// LEADS TABLE
// ============================================================================

/**
 * Lead table - stores leads/prospects for an organization
 */
export const leadTable = pgTable(
	"lead",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Contact information
		firstName: text("first_name").notNull(),
		lastName: text("last_name").notNull(),
		email: text("email").notNull(),
		phone: text("phone"),
		company: text("company"),
		jobTitle: text("job_title"),
		// Lead details
		status: text("status", { enum: enumToPgEnum(LeadStatus) })
			.$type<LeadStatus>()
			.notNull()
			.default(LeadStatus.new),
		source: text("source", { enum: enumToPgEnum(LeadSource) })
			.$type<LeadSource>()
			.notNull()
			.default(LeadSource.other),
		// Value and notes
		estimatedValue: integer("estimated_value"), // Amount in cents
		notes: text("notes"),
		// Assigned to
		assignedToId: uuid("assigned_to_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("lead_organization_id_idx").on(table.organizationId),
		index("lead_status_idx").on(table.status),
		index("lead_source_idx").on(table.source),
		index("lead_assigned_to_id_idx").on(table.assignedToId),
		index("lead_email_idx").on(table.email),
		index("lead_created_at_idx").on(table.createdAt),
		// Composite index for common query: leads by organization and status
		index("lead_org_status_idx").on(table.organizationId, table.status),
	],
);

// ============================================================================
// EMBER CRM TABLES
// ============================================================================

/**
 * Contact table - Enhanced contact management with multi-source tracking and fusion support
 * Replaces/extends the lead concept with richer profiling and AI interaction tracking
 */
// biome-ignore lint/suspicious/noExplicitAny: Circular self-reference requires any
export const contactTable: any = pgTable(
	"contact",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Basic information
		firstName: text("first_name").notNull(),
		lastName: text("last_name").notNull(),
		email: text("email"),
		phone: text("phone"),
		company: text("company"),
		// Ember-specific fields
		heatScore: integer("heat_score").notNull().default(0), // 0-100
		tags: text("tags"), // JSON array
		channelPreference: text("channel_preference"),
		timezone: text("timezone"),
		language: text("language").default("es"),
		// Interaction tracking
		lastInteractionAt: timestamp("last_interaction_at", {
			withTimezone: true,
		}),
		lastInteractionChannel: text("last_interaction_channel"),
		interactionCount: integer("interaction_count").notNull().default(0),
		// Business tracking
		lifetimeValue: integer("lifetime_value").default(0), // in cents
		averageResponseTime: integer("average_response_time"), // in seconds
		// Assignment
		assignedToId: uuid("assigned_to_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Custom fields
		customFields: text("custom_fields"), // JSON
		status: text("status", { enum: enumToPgEnum(ContactStatus) })
			.$type<ContactStatus>()
			.notNull()
			.default(ContactStatus.active),
		// Contact fusion/merge support
		mergedWithId: uuid("merged_with_id").references(
			// biome-ignore lint/suspicious/noExplicitAny: Circular reference
			() => (contactTable as any).id,
			{
				onDelete: "set null",
			},
		),
		mergedContactIds: text("merged_contact_ids"), // JSON array of UUIDs
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("contact_organization_id_idx").on(table.organizationId),
		index("contact_heat_score_idx").on(table.heatScore),
		index("contact_email_idx").on(table.email),
		index("contact_phone_idx").on(table.phone),
		index("contact_assigned_to_idx").on(table.assignedToId),
		index("contact_last_interaction_idx").on(table.lastInteractionAt),
		index("contact_status_idx").on(table.status),
		// Composite for hot leads filtering
		index("contact_org_heat_idx").on(table.organizationId, table.heatScore),
	],
);

/**
 * Contact source table - Tracks multiple sources for a single contact
 * Enables understanding which channels/campaigns brought in the contact
 */
export const contactSourceTable = pgTable(
	"contact_source",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contactTable.id, { onDelete: "cascade" }),
		sourceType: text("source_type", { enum: enumToPgEnum(ContactSourceType) })
			.$type<ContactSourceType>()
			.notNull(),
		sourceIdentifier: text("source_identifier"), // form_id, phone_number, social_id, email
		sourceMetadata: text("source_metadata"), // JSON - campaign, utm params, etc
		firstSeen: timestamp("first_seen", { withTimezone: true })
			.notNull()
			.defaultNow(),
		lastSeen: timestamp("last_seen", { withTimezone: true })
			.notNull()
			.defaultNow(),
		interactionCount: integer("interaction_count").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("contact_source_contact_id_idx").on(table.contactId),
		index("contact_source_type_idx").on(table.sourceType),
		index("contact_source_identifier_idx").on(table.sourceIdentifier),
		// Composite for tracking contact's sources
		index("contact_source_contact_type_idx").on(
			table.contactId,
			table.sourceType,
		),
	],
);

/**
 * Contact agreement table - Tracks agreements, promises, and commitments made with contacts
 * Critical for maintaining consistency across conversations
 */
export const contactAgreementTable = pgTable(
	"contact_agreement",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contactTable.id, { onDelete: "cascade" }),
		conversationId: uuid("conversation_id").references(
			() => conversationTable.id,
			{ onDelete: "set null" },
		),
		type: text("type", { enum: enumToPgEnum(ContactAgreementType) })
			.$type<ContactAgreementType>()
			.notNull(),
		description: text("description").notNull(),
		details: text("details"), // JSON with structured data
		status: text("status", { enum: enumToPgEnum(ContactAgreementStatus) })
			.$type<ContactAgreementStatus>()
			.notNull()
			.default(ContactAgreementStatus.active),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("contact_agreement_contact_id_idx").on(table.contactId),
		index("contact_agreement_organization_id_idx").on(table.organizationId),
		index("contact_agreement_status_idx").on(table.status),
		index("contact_agreement_type_idx").on(table.type),
	],
);

/**
 * Contact note table - Internal notes about contacts for team collaboration
 */
export const contactNoteTable = pgTable(
	"contact_note",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contactTable.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		type: text("type", { enum: enumToPgEnum(ContactNoteType) })
			.$type<ContactNoteType>()
			.notNull()
			.default(ContactNoteType.general),
		createdById: uuid("created_by_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("contact_note_contact_id_idx").on(table.contactId),
		index("contact_note_created_by_id_idx").on(table.createdById),
		index("contact_note_type_idx").on(table.type),
	],
);

/**
 * Channel configuration table - Stores credentials and settings for each communication channel per organization
 */
export const channelConfigTable = pgTable(
	"channel_config",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		channelType: text("channel_type", { enum: enumToPgEnum(ChannelType) })
			.$type<ChannelType>()
			.notNull(),
		enabled: boolean("enabled").notNull().default(false),
		credentials: text("credentials"), // JSON with encrypted keys
		autoReply: boolean("auto_reply").notNull().default(true),
		businessHoursOnly: boolean("business_hours_only").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("channel_config_organization_id_idx").on(table.organizationId),
		// Unique constraint: one config per channel per organization
		uniqueIndex("channel_config_org_type_idx").on(
			table.organizationId,
			table.channelType,
		),
	],
);

/**
 * Conversation table - Unified conversation threads across all channels
 */
export const conversationTable = pgTable(
	"conversation",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contactTable.id, { onDelete: "cascade" }),
		status: text("status", { enum: enumToPgEnum(ConversationStatus) })
			.$type<ConversationStatus>()
			.notNull()
			.default(ConversationStatus.active),
		channel: text("channel", { enum: enumToPgEnum(ChannelType) })
			.$type<ChannelType>()
			.notNull(),
		// AI handling
		handledByAi: boolean("handled_by_ai").notNull().default(true),
		transferredToHuman: boolean("transferred_to_human")
			.notNull()
			.default(false),
		transferredToId: uuid("transferred_to_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		transferReason: text("transfer_reason"),
		// Tracking
		messageCount: integer("message_count").notNull().default(0),
		lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
		// Context
		summary: text("summary"), // AI-generated conversation summary
		sentiment: text("sentiment"), // positive, neutral, negative
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		closedAt: timestamp("closed_at", { withTimezone: true }),
	},
	(table) => [
		index("conversation_organization_id_idx").on(table.organizationId),
		index("conversation_contact_id_idx").on(table.contactId),
		index("conversation_status_idx").on(table.status),
		index("conversation_channel_idx").on(table.channel),
		index("conversation_last_message_idx").on(table.lastMessageAt),
		// Composite for active conversations by org
		index("conversation_org_status_idx").on(table.organizationId, table.status),
	],
);

/**
 * Conversation message table - Individual messages in conversations across all channels
 */
export const conversationMessageTable = pgTable(
	"conversation_message",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversationTable.id, { onDelete: "cascade" }),
		// Message content
		direction: text("direction", { enum: enumToPgEnum(MessageDirection) })
			.$type<MessageDirection>()
			.notNull(),
		role: text("role", { enum: enumToPgEnum(MessageRole) })
			.$type<MessageRole>()
			.notNull(),
		content: text("content").notNull(),
		contentType: text("content_type", {
			enum: enumToPgEnum(MessageContentType),
		})
			.$type<MessageContentType>()
			.notNull()
			.default(MessageContentType.text),
		// Channel info
		channel: text("channel", { enum: enumToPgEnum(ChannelType) })
			.$type<ChannelType>()
			.notNull(),
		externalId: text("external_id"), // ID from external system
		// Media attachments
		mediaUrl: text("media_url"),
		mediaMimeType: text("media_mime_type"),
		// AI metadata
		generatedByAi: boolean("generated_by_ai").notNull().default(false),
		model: text("model"),
		creditsUsed: integer("credits_used"),
		// Actions triggered
		actionTriggered: text("action_triggered"), // JSON array of actions
		// Status
		deliveryStatus: text("delivery_status", {
			enum: enumToPgEnum(MessageDeliveryStatus),
		}).$type<MessageDeliveryStatus>(),
		errorMessage: text("error_message"),
		// User who sent (if human agent)
		sentById: uuid("sent_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("conversation_message_conversation_id_idx").on(table.conversationId),
		index("conversation_message_created_at_idx").on(table.createdAt),
		index("conversation_message_external_id_idx").on(table.externalId),
		index("conversation_message_channel_idx").on(table.channel),
		// Composite for loading conversation messages
		index("conversation_message_conv_created_idx").on(
			table.conversationId,
			table.createdAt,
		),
	],
);

/**
 * Agent table - AI agents with configurable personalities, objectives, and voice providers
 */
export const agentTable = pgTable(
	"agent",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		type: text("type", { enum: enumToPgEnum(AgentType) })
			.$type<AgentType>()
			.notNull(),
		// Voice provider configuration
		voiceProvider: text("voice_provider", {
			enum: enumToPgEnum(VoiceProvider),
		})
			.$type<VoiceProvider>()
			.notNull()
			.default(VoiceProvider.none),
		voiceProviderId: text("voice_provider_id"), // agent_id in the provider
		voiceProviderConfig: text("voice_provider_config"), // JSON - voice settings, language, etc
		// LLM configuration
		systemPrompt: text("system_prompt").notNull(),
		temperature: integer("temperature").default(70), // 0-100, stored as integer
		maxTokens: integer("max_tokens").default(2000),
		model: text("model").notNull().default("gpt-4"),
		// Behavior
		objectives: text("objectives"), // JSON array
		escalationRules: text("escalation_rules"), // JSON
		allowedActions: text("allowed_actions"), // JSON array
		knowledgeBase: text("knowledge_base"), // JSON
		// Assignment
		assignToChannels: text("assign_to_channels"), // JSON array
		assignToCampaigns: text("assign_to_campaigns"), // JSON array
		active: boolean("active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("agent_organization_id_idx").on(table.organizationId),
		index("agent_type_idx").on(table.type),
		index("agent_active_idx").on(table.active),
		// Composite for active agents by org
		index("agent_org_active_idx").on(table.organizationId, table.active),
	],
);

/**
 * Agent assignment table - Tracks which agent is handling which conversation
 */
export const agentAssignmentTable = pgTable(
	"agent_assignment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversationTable.id, { onDelete: "cascade" }),
		agentId: uuid("agent_id")
			.notNull()
			.references(() => agentTable.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contactTable.id, { onDelete: "cascade" }),
		assignedAt: timestamp("assigned_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
		reasonForUnassignment: text("reason_for_unassignment"),
		// Performance tracking
		messagesHandled: integer("messages_handled").notNull().default(0),
		creditsUsed: integer("credits_used").notNull().default(0),
		satisfaction: integer("satisfaction"), // 1-5, nullable
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("agent_assignment_conversation_id_idx").on(table.conversationId),
		index("agent_assignment_agent_id_idx").on(table.agentId),
		index("agent_assignment_contact_id_idx").on(table.contactId),
		index("agent_assignment_assigned_at_idx").on(table.assignedAt),
	],
);

/**
 * Form table - Form builder for lead capture
 */
export const formTable = pgTable(
	"form",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		slug: text("slug").notNull(), // URL-friendly
		// Form configuration
		fields: text("fields").notNull(), // JSON field definitions
		settings: text("settings"), // JSON - theme, redirect, etc
		// Integration
		webhookUrl: text("webhook_url"),
		emailNotification: text("email_notification"),
		// Tracking
		views: integer("views").notNull().default(0),
		submissions: integer("submissions").notNull().default(0),
		conversionRate: integer("conversion_rate").default(0), // stored as integer (percentage * 100)
		// After submission
		postSubmitAction: text("post_submit_action", {
			enum: enumToPgEnum(FormPostSubmitAction),
		})
			.$type<FormPostSubmitAction>()
			.notNull()
			.default(FormPostSubmitAction.showMessage),
		postSubmitConfig: text("post_submit_config"), // JSON
		assignToAgentId: uuid("assign_to_agent_id").references(
			() => agentTable.id,
			{
				onDelete: "set null",
			},
		),
		active: boolean("active").notNull().default(true),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("form_organization_id_idx").on(table.organizationId),
		index("form_active_idx").on(table.active),
		index("form_assign_to_agent_idx").on(table.assignToAgentId),
		// Unique slug per organization
		uniqueIndex("form_org_slug_idx").on(table.organizationId, table.slug),
	],
);

/**
 * Form submission table - Responses from form submissions
 */
export const formSubmissionTable = pgTable(
	"form_submission",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		formId: uuid("form_id")
			.notNull()
			.references(() => formTable.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contactTable.id, { onDelete: "cascade" }),
		data: text("data").notNull(), // JSON - responses
		// Tracking
		ip: text("ip"),
		userAgent: text("user_agent"),
		referrer: text("referrer"),
		utmParams: text("utm_params"), // JSON
		submittedAt: timestamp("submitted_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("form_submission_form_id_idx").on(table.formId),
		index("form_submission_contact_id_idx").on(table.contactId),
		index("form_submission_submitted_at_idx").on(table.submittedAt),
	],
);

/**
 * Voice call table - Tracks voice calls with AI agents
 */
export const voiceCallTable = pgTable(
	"voice_call",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		conversationId: uuid("conversation_id").references(
			() => conversationTable.id,
			{ onDelete: "set null" },
		),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contactTable.id, { onDelete: "cascade" }),
		agentId: uuid("agent_id").references(() => agentTable.id, {
			onDelete: "set null",
		}),
		// Call info
		direction: text("direction", { enum: enumToPgEnum(VoiceCallDirection) })
			.$type<VoiceCallDirection>()
			.notNull(),
		fromNumber: text("from_number").notNull(),
		toNumber: text("to_number").notNull(),
		// Provider info
		provider: text("provider").notNull(), // twilio/vapi/retell/elevenlabs
		providerCallId: text("provider_call_id"),
		providerRecordingUrl: text("provider_recording_url"),
		// Timing
		startedAt: timestamp("started_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		answeredAt: timestamp("answered_at", { withTimezone: true }),
		endedAt: timestamp("ended_at", { withTimezone: true }),
		duration: integer("duration"), // seconds
		// AI handling
		handledByAI: boolean("handled_by_ai").notNull().default(true),
		transcript: text("transcript"),
		summary: text("summary"),
		// Cost
		costInCents: integer("cost_in_cents"),
		creditsUsed: integer("credits_used"),
		// Status
		status: text("status", { enum: enumToPgEnum(VoiceCallStatus) })
			.$type<VoiceCallStatus>()
			.notNull()
			.default(VoiceCallStatus.queued),
		failureReason: text("failure_reason"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("voice_call_organization_id_idx").on(table.organizationId),
		index("voice_call_contact_id_idx").on(table.contactId),
		index("voice_call_agent_id_idx").on(table.agentId),
		index("voice_call_provider_call_id_idx").on(table.providerCallId),
		index("voice_call_started_at_idx").on(table.startedAt),
		index("voice_call_status_idx").on(table.status),
		// Composite for contact call history
		index("voice_call_contact_started_idx").on(
			table.contactId,
			table.startedAt,
		),
	],
);

/**
 * Product table - Inventory/catalog management
 */
export const productTable = pgTable(
	"product",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Basic info
		sku: text("sku").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		// Categorization
		categoryId: uuid("category_id").references(() => productCategoryTable.id, {
			onDelete: "set null",
		}),
		tags: text("tags"), // JSON array
		// Pricing
		price: integer("price").notNull(), // in cents
		compareAtPrice: integer("compare_at_price"), // Original price for discounts
		currency: text("currency").notNull().default("usd"),
		// Inventory
		trackInventory: boolean("track_inventory").notNull().default(true),
		stockQuantity: integer("stock_quantity").default(0),
		lowStockThreshold: integer("low_stock_threshold").default(10),
		// Media
		images: text("images"), // JSON array of image URLs
		// Status
		active: boolean("active").notNull().default(true),
		// External sync
		externalId: text("external_id"),
		externalSource: text("external_source"), // shopify, woocommerce, etc
		lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("product_organization_id_idx").on(table.organizationId),
		index("product_sku_idx").on(table.sku),
		index("product_category_id_idx").on(table.categoryId),
		index("product_active_idx").on(table.active),
		index("product_external_id_idx").on(table.externalId),
		// Unique SKU per organization
		uniqueIndex("product_org_sku_idx").on(table.organizationId, table.sku),
	],
);

/**
 * Product category table - Product categorization
 */
// biome-ignore lint/suspicious/noExplicitAny: Circular self-reference requires any
export const productCategoryTable: any = pgTable(
	"product_category",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		parentId: uuid("parent_id").references(
			// biome-ignore lint/suspicious/noExplicitAny: Circular reference
			() => (productCategoryTable as any).id,
			{
				onDelete: "set null",
			},
		), // Self-reference for nested categories
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("product_category_organization_id_idx").on(table.organizationId),
		index("product_category_parent_id_idx").on(table.parentId),
	],
);
