import { relations } from "drizzle-orm";
import {
	accountTable,
	agentAssignmentTable,
	agentTable,
	aiChatTable,
	billingEventTable,
	channelConfigTable,
	contactAgreementTable,
	contactNoteTable,
	contactSourceTable,
	contactTable,
	conversationMessageTable,
	conversationTable,
	creditBalanceTable,
	creditDeductionFailureTable,
	creditTransactionTable,
	formSubmissionTable,
	formTable,
	invitationTable,
	leadTable,
	memberTable,
	orderItemTable,
	orderTable,
	organizationTable,
	productCategoryTable,
	productTable,
	sessionTable,
	subscriptionItemTable,
	subscriptionTable,
	twoFactorTable,
	userTable,
	voiceCallTable,
} from "./tables";

export const accountRelations = relations(accountTable, ({ one }) => ({
	user: one(userTable, {
		fields: [accountTable.userId],
		references: [userTable.id],
	}),
}));

export const invitationRelations = relations(invitationTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [invitationTable.organizationId],
		references: [organizationTable.id],
	}),
	inviter: one(userTable, {
		fields: [invitationTable.inviterId],
		references: [userTable.id],
	}),
}));

export const memberRelations = relations(memberTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [memberTable.organizationId],
		references: [organizationTable.id],
	}),
	user: one(userTable, {
		fields: [memberTable.userId],
		references: [userTable.id],
	}),
}));

export const organizationRelations = relations(
	organizationTable,
	({ one, many }) => ({
		members: many(memberTable),
		invitations: many(invitationTable),
		subscriptions: many(subscriptionTable),
		orders: many(orderTable),
		billingEvents: many(billingEventTable),
		aiChats: many(aiChatTable),
		leads: many(leadTable),
		creditBalance: one(creditBalanceTable),
		creditTransactions: many(creditTransactionTable),
		// Ember relations
		contacts: many(contactTable),
		contactAgreements: many(contactAgreementTable),
		contactNotes: many(contactNoteTable),
		channelConfigs: many(channelConfigTable),
		conversations: many(conversationTable),
		agents: many(agentTable),
		forms: many(formTable),
		voiceCalls: many(voiceCallTable),
		products: many(productTable),
		productCategories: many(productCategoryTable),
	}),
);

export const sessionRelations = relations(sessionTable, ({ one }) => ({
	user: one(userTable, {
		fields: [sessionTable.userId],
		references: [userTable.id],
	}),
}));

export const twoFactorRelations = relations(twoFactorTable, ({ one }) => ({
	user: one(userTable, {
		fields: [twoFactorTable.userId],
		references: [userTable.id],
	}),
}));

export const userRelations = relations(userTable, ({ many }) => ({
	sessions: many(sessionTable),
	accounts: many(accountTable),
	invitations: many(invitationTable),
	memberships: many(memberTable),
	twoFactors: many(twoFactorTable),
	aiChats: many(aiChatTable),
	assignedLeads: many(leadTable),
	creditTransactions: many(creditTransactionTable),
	// Ember relations
	assignedContacts: many(contactTable),
	contactNotes: many(contactNoteTable),
	transferredConversations: many(conversationTable),
	sentMessages: many(conversationMessageTable),
}));

// Billing relations
export const subscriptionRelations = relations(
	subscriptionTable,
	({ one, many }) => ({
		organization: one(organizationTable, {
			fields: [subscriptionTable.organizationId],
			references: [organizationTable.id],
		}),
		items: many(subscriptionItemTable),
	}),
);

export const subscriptionItemRelations = relations(
	subscriptionItemTable,
	({ one }) => ({
		subscription: one(subscriptionTable, {
			fields: [subscriptionItemTable.subscriptionId],
			references: [subscriptionTable.id],
		}),
	}),
);

export const orderRelations = relations(orderTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [orderTable.organizationId],
		references: [organizationTable.id],
	}),
	items: many(orderItemTable),
}));

export const orderItemRelations = relations(orderItemTable, ({ one }) => ({
	order: one(orderTable, {
		fields: [orderItemTable.orderId],
		references: [orderTable.id],
	}),
}));

export const billingEventRelations = relations(
	billingEventTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [billingEventTable.organizationId],
			references: [organizationTable.id],
		}),
	}),
);

// AI Chat relations
export const aiChatRelations = relations(aiChatTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [aiChatTable.organizationId],
		references: [organizationTable.id],
	}),
	user: one(userTable, {
		fields: [aiChatTable.userId],
		references: [userTable.id],
	}),
}));

// Lead relations
export const leadRelations = relations(leadTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [leadTable.organizationId],
		references: [organizationTable.id],
	}),
	assignedTo: one(userTable, {
		fields: [leadTable.assignedToId],
		references: [userTable.id],
	}),
}));

// Credit relations
export const creditBalanceRelations = relations(
	creditBalanceTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [creditBalanceTable.organizationId],
			references: [organizationTable.id],
		}),
	}),
);

export const creditTransactionRelations = relations(
	creditTransactionTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [creditTransactionTable.organizationId],
			references: [organizationTable.id],
		}),
		createdByUser: one(userTable, {
			fields: [creditTransactionTable.createdBy],
			references: [userTable.id],
		}),
	}),
);

export const creditDeductionFailureRelations = relations(
	creditDeductionFailureTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [creditDeductionFailureTable.organizationId],
			references: [organizationTable.id],
		}),
		user: one(userTable, {
			fields: [creditDeductionFailureTable.userId],
			references: [userTable.id],
			relationName: "deductionFailureUser",
		}),
		resolvedByUser: one(userTable, {
			fields: [creditDeductionFailureTable.resolvedBy],
			references: [userTable.id],
			relationName: "deductionFailureResolvedBy",
		}),
	}),
);

// ============================================================================
// EMBER RELATIONS
// ============================================================================

// Contact relations
export const contactRelations = relations(contactTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [contactTable.organizationId],
		references: [organizationTable.id],
	}),
	assignedTo: one(userTable, {
		fields: [contactTable.assignedToId],
		references: [userTable.id],
	}),
	mergedWith: one(contactTable, {
		fields: [contactTable.mergedWithId],
		references: [contactTable.id],
		relationName: "contactMerge",
	}),
	sources: many(contactSourceTable),
	agreements: many(contactAgreementTable),
	notes: many(contactNoteTable),
	conversations: many(conversationTable),
	voiceCalls: many(voiceCallTable),
	formSubmissions: many(formSubmissionTable),
	agentAssignments: many(agentAssignmentTable),
}));

// Contact source relations
export const contactSourceRelations = relations(
	contactSourceTable,
	({ one }) => ({
		contact: one(contactTable, {
			fields: [contactSourceTable.contactId],
			references: [contactTable.id],
		}),
	}),
);

// Contact agreement relations
export const contactAgreementRelations = relations(
	contactAgreementTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [contactAgreementTable.organizationId],
			references: [organizationTable.id],
		}),
		contact: one(contactTable, {
			fields: [contactAgreementTable.contactId],
			references: [contactTable.id],
		}),
		conversation: one(conversationTable, {
			fields: [contactAgreementTable.conversationId],
			references: [conversationTable.id],
		}),
	}),
);

// Contact note relations
export const contactNoteRelations = relations(contactNoteTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [contactNoteTable.organizationId],
		references: [organizationTable.id],
	}),
	contact: one(contactTable, {
		fields: [contactNoteTable.contactId],
		references: [contactTable.id],
	}),
	createdBy: one(userTable, {
		fields: [contactNoteTable.createdById],
		references: [userTable.id],
	}),
}));

// Channel config relations
export const channelConfigRelations = relations(
	channelConfigTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [channelConfigTable.organizationId],
			references: [organizationTable.id],
		}),
	}),
);

// Conversation relations
export const conversationRelations = relations(
	conversationTable,
	({ one, many }) => ({
		organization: one(organizationTable, {
			fields: [conversationTable.organizationId],
			references: [organizationTable.id],
		}),
		contact: one(contactTable, {
			fields: [conversationTable.contactId],
			references: [contactTable.id],
		}),
		transferredTo: one(userTable, {
			fields: [conversationTable.transferredToId],
			references: [userTable.id],
		}),
		messages: many(conversationMessageTable),
		agreements: many(contactAgreementTable),
		agentAssignments: many(agentAssignmentTable),
		voiceCalls: many(voiceCallTable),
	}),
);

// Conversation message relations
export const conversationMessageRelations = relations(
	conversationMessageTable,
	({ one }) => ({
		conversation: one(conversationTable, {
			fields: [conversationMessageTable.conversationId],
			references: [conversationTable.id],
		}),
		sentBy: one(userTable, {
			fields: [conversationMessageTable.sentById],
			references: [userTable.id],
		}),
	}),
);

// Agent relations
export const agentRelations = relations(agentTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [agentTable.organizationId],
		references: [organizationTable.id],
	}),
	assignments: many(agentAssignmentTable),
	forms: many(formTable),
	voiceCalls: many(voiceCallTable),
}));

// Agent assignment relations
export const agentAssignmentRelations = relations(
	agentAssignmentTable,
	({ one }) => ({
		conversation: one(conversationTable, {
			fields: [agentAssignmentTable.conversationId],
			references: [conversationTable.id],
		}),
		agent: one(agentTable, {
			fields: [agentAssignmentTable.agentId],
			references: [agentTable.id],
		}),
		contact: one(contactTable, {
			fields: [agentAssignmentTable.contactId],
			references: [contactTable.id],
		}),
	}),
);

// Form relations
export const formRelations = relations(formTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [formTable.organizationId],
		references: [organizationTable.id],
	}),
	assignToAgent: one(agentTable, {
		fields: [formTable.assignToAgentId],
		references: [agentTable.id],
	}),
	submissions: many(formSubmissionTable),
}));

// Form submission relations
export const formSubmissionRelations = relations(
	formSubmissionTable,
	({ one }) => ({
		form: one(formTable, {
			fields: [formSubmissionTable.formId],
			references: [formTable.id],
		}),
		contact: one(contactTable, {
			fields: [formSubmissionTable.contactId],
			references: [contactTable.id],
		}),
	}),
);

// Voice call relations
export const voiceCallRelations = relations(voiceCallTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [voiceCallTable.organizationId],
		references: [organizationTable.id],
	}),
	conversation: one(conversationTable, {
		fields: [voiceCallTable.conversationId],
		references: [conversationTable.id],
	}),
	contact: one(contactTable, {
		fields: [voiceCallTable.contactId],
		references: [contactTable.id],
	}),
	agent: one(agentTable, {
		fields: [voiceCallTable.agentId],
		references: [agentTable.id],
	}),
}));

// Product relations
export const productRelations = relations(productTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [productTable.organizationId],
		references: [organizationTable.id],
	}),
	category: one(productCategoryTable, {
		fields: [productTable.categoryId],
		references: [productCategoryTable.id],
	}),
}));

// Product category relations
export const productCategoryRelations = relations(
	productCategoryTable,
	({ one, many }) => ({
		organization: one(organizationTable, {
			fields: [productCategoryTable.organizationId],
			references: [organizationTable.id],
		}),
		parent: one(productCategoryTable, {
			fields: [productCategoryTable.parentId],
			references: [productCategoryTable.id],
			relationName: "categoryHierarchy",
		}),
		children: many(productCategoryTable, {
			relationName: "categoryHierarchy",
		}),
		products: many(productTable),
	}),
);
