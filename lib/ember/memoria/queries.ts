import {
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { type ContactSourceType, ContactStatus } from "@/lib/db/schema/enums";
import {
	contactAgreementTable,
	contactNoteTable,
	contactSourceTable,
	contactTable,
	conversationTable,
} from "@/lib/db/schema/tables";
import type { ListContactsInput } from "@/schemas/contact.schema";

/**
 * Find or create a contact based on identifying information
 * Returns existing contact if found, otherwise creates new one
 */
export async function findOrCreateContact(
	organizationId: string,
	data: {
		email?: string | null;
		phone?: string | null;
		firstName: string;
		lastName: string;
		sourceType: ContactSourceType;
		sourceIdentifier?: string | null;
		sourceMetadata?: Record<string, unknown> | null;
	},
) {
	return await db.transaction(async (tx) => {
		// Try to find existing contact by email or phone
		let existing = null;

		if (data.email) {
			existing = await tx.query.contactTable.findFirst({
				where: and(
					eq(contactTable.organizationId, organizationId),
					eq(contactTable.email, data.email),
					eq(contactTable.status, ContactStatus.active),
				),
			});
		}

		if (!existing && data.phone) {
			existing = await tx.query.contactTable.findFirst({
				where: and(
					eq(contactTable.organizationId, organizationId),
					eq(contactTable.phone, data.phone),
					eq(contactTable.status, ContactStatus.active),
				),
			});
		}

		if (existing) {
			// Update last interaction
			await tx
				.update(contactTable)
				.set({
					lastInteractionAt: new Date(),
					interactionCount: sql`${contactTable.interactionCount} + 1`,
					updatedAt: new Date(),
				})
				.where(eq(contactTable.id, existing.id));

			// Add source if not already tracked
			const existingSource = await tx.query.contactSourceTable.findFirst({
				where: and(
					eq(contactSourceTable.contactId, existing.id),
					sql`${contactSourceTable.sourceType} = ${data.sourceType}`,
					data.sourceIdentifier
						? eq(contactSourceTable.sourceIdentifier, data.sourceIdentifier)
						: undefined,
				),
			});

			if (!existingSource) {
				await tx.insert(contactSourceTable).values({
					contactId: existing.id,
					sourceType: data.sourceType,
					sourceIdentifier: data.sourceIdentifier,
					sourceMetadata: data.sourceMetadata
						? JSON.stringify(data.sourceMetadata)
						: null,
					firstSeen: new Date(),
					lastSeen: new Date(),
					interactionCount: 1,
				});
			} else {
				await tx
					.update(contactSourceTable)
					.set({
						lastSeen: new Date(),
						interactionCount: sql`${contactSourceTable.interactionCount} + 1`,
					})
					.where(eq(contactSourceTable.id, existingSource.id));
			}

			return existing;
		}

		// Create new contact
		const contacts = await tx
			.insert(contactTable)
			.values({
				organizationId,
				firstName: data.firstName,
				lastName: data.lastName,
				email: data.email,
				phone: data.phone,
				status: ContactStatus.active,
				heatScore: 0,
				interactionCount: 1,
				lastInteractionAt: new Date(),
			})
			.returning();

		const newContact = (contacts as (typeof contactTable.$inferSelect)[])[0];
		if (!newContact) {
			throw new Error("Failed to create contact");
		}

		// Add source
		await tx.insert(contactSourceTable).values({
			contactId: newContact.id,
			sourceType: data.sourceType,
			sourceIdentifier: data.sourceIdentifier,
			sourceMetadata: data.sourceMetadata
				? JSON.stringify(data.sourceMetadata)
				: null,
			firstSeen: new Date(),
			lastSeen: new Date(),
			interactionCount: 1,
		});

		return newContact;
	});
}

/**
 * Get contact profile with all related data
 */
export async function getContactProfile(contactId: string) {
	const contact = await db.query.contactTable.findFirst({
		where: eq(contactTable.id, contactId),
		with: {
			assignedTo: {
				columns: {
					id: true,
					name: true,
					email: true,
				},
			},
			sources: true,
			notes: {
				with: {
					createdBy: {
						columns: {
							id: true,
							name: true,
						},
					},
				},
			},
			agreements: true,
			conversations: {
				limit: 10, // Last 10 conversations
			},
		},
	});

	if (!contact) {
		return null;
	}

	// Parse JSON fields
	return {
		...contact,
		tags: contact.tags ? JSON.parse(contact.tags) : [],
		customFields: contact.customFields ? JSON.parse(contact.customFields) : {},
		mergedContactIds: contact.mergedContactIds
			? JSON.parse(contact.mergedContactIds)
			: [],
	};
}

/**
 * List contacts with filters and pagination
 */
export async function listContacts(
	organizationId: string,
	filters: ListContactsInput,
) {
	const conditions = [eq(contactTable.organizationId, organizationId)];

	// Status filter
	if (filters.status) {
		conditions.push(eq(contactTable.status, filters.status));
	} else {
		// Default: only active contacts
		conditions.push(eq(contactTable.status, ContactStatus.active));
	}

	// Search by name, email, or phone
	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			or(
				ilike(contactTable.firstName, searchTerm),
				ilike(contactTable.lastName, searchTerm),
				ilike(contactTable.email, searchTerm),
				ilike(contactTable.phone, searchTerm),
				ilike(contactTable.company, searchTerm),
			)!,
		);
	}

	// Assigned to filter
	if (filters.assignedToId) {
		conditions.push(eq(contactTable.assignedToId, filters.assignedToId));
	}

	// Heat score range
	if (filters.minHeatScore !== undefined) {
		conditions.push(gte(contactTable.heatScore, filters.minHeatScore));
	}
	if (filters.maxHeatScore !== undefined) {
		conditions.push(lte(contactTable.heatScore, filters.maxHeatScore));
	}

	// Tags filter (if provided)
	if (filters.tags && filters.tags.length > 0) {
		// This is a simplified version - in production you'd want full-text search
		const tagConditions = filters.tags.map((tag) =>
			ilike(contactTable.tags, `%${tag}%`),
		);
		conditions.push(or(...tagConditions)!);
	}

	// Build order by
	const direction = filters.orderDirection === "asc" ? asc : desc;
	let orderByClause: ReturnType<typeof direction>;

	switch (filters.orderBy) {
		case "heatScore":
			orderByClause = direction(contactTable.heatScore);
			break;
		case "lastInteractionAt":
			orderByClause = direction(contactTable.lastInteractionAt);
			break;
		case "createdAt":
			orderByClause = direction(contactTable.createdAt);
			break;
		case "firstName":
			orderByClause = direction(contactTable.firstName);
			break;
		default:
			orderByClause = desc(contactTable.lastInteractionAt);
	}

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(contactTable)
		.where(and(...conditions));

	const count = countResult[0]?.count ?? 0;

	// Get contacts
	const contacts = await db.query.contactTable.findMany({
		where: and(...conditions),
		orderBy: orderByClause,
		limit: filters.limit,
		offset: filters.offset,
		with: {
			assignedTo: {
				columns: {
					id: true,
					name: true,
				},
			},
			sources: true,
		},
	});

	// Parse JSON fields
	const parsedContacts = contacts.map((contact) => ({
		...contact,
		tags: contact.tags ? JSON.parse(contact.tags) : [],
		customFields: contact.customFields ? JSON.parse(contact.customFields) : {},
	}));

	return {
		contacts: parsedContacts,
		total: count,
		hasMore: count > filters.offset + filters.limit,
	};
}

/**
 * Get contact timeline - all interactions across channels
 */
export async function getContactTimeline(contactId: string, limit = 50) {
	// Get conversations with messages
	const conversations = await db.query.conversationTable.findMany({
		where: eq(conversationTable.contactId, contactId),
		with: {
			messages: {
				orderBy: (messages, { desc }) => [desc(messages.createdAt)],
				limit: 100, // Get latest 100 messages
			},
		},
		orderBy: (conversations, { desc }) => [desc(conversations.lastMessageAt)],
	});

	// Get notes
	const notes = await db.query.contactNoteTable.findMany({
		where: eq(contactNoteTable.contactId, contactId),
		with: {
			createdBy: {
				columns: {
					id: true,
					name: true,
				},
			},
		},
		orderBy: (notes, { desc }) => [desc(notes.createdAt)],
	});

	// Get agreements
	const agreements = await db.query.contactAgreementTable.findMany({
		where: eq(contactAgreementTable.contactId, contactId),
		orderBy: (agreements, { desc }) => [desc(agreements.createdAt)],
	});

	// Combine and sort all timeline events
	const timelineEvents: Array<{
		type: "message" | "note" | "agreement";
		timestamp: Date;
		data: unknown;
	}> = [];

	// Add messages
	for (const conversation of conversations) {
		for (const message of conversation.messages) {
			timelineEvents.push({
				type: "message",
				timestamp: message.createdAt,
				data: {
					...message,
					conversationId: conversation.id,
					channel: conversation.channel,
				},
			});
		}
	}

	// Add notes
	for (const note of notes) {
		timelineEvents.push({
			type: "note",
			timestamp: note.createdAt,
			data: note,
		});
	}

	// Add agreements
	for (const agreement of agreements) {
		timelineEvents.push({
			type: "agreement",
			timestamp: agreement.createdAt,
			data: agreement,
		});
	}

	// Sort by timestamp (newest first)
	timelineEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

	// Return limited results
	return timelineEvents.slice(0, limit);
}

/**
 * Get contact statistics for dashboard
 */
export async function getContactStats(organizationId: string) {
	const contacts = await db.query.contactTable.findMany({
		where: and(
			eq(contactTable.organizationId, organizationId),
			eq(contactTable.status, ContactStatus.active),
		),
		columns: {
			heatScore: true,
			lifetimeValue: true,
			lastInteractionAt: true,
		},
	});

	const now = Date.now();
	const oneDayAgo = now - 24 * 60 * 60 * 1000;
	const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
	const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

	return {
		total: contacts.length,
		hot: contacts.filter((c) => c.heatScore >= 80).length,
		warm: contacts.filter((c) => c.heatScore >= 50 && c.heatScore < 80).length,
		cold: contacts.filter((c) => c.heatScore < 50).length,
		activeToday: contacts.filter(
			(c) => c.lastInteractionAt && c.lastInteractionAt.getTime() >= oneDayAgo,
		).length,
		activeThisWeek: contacts.filter(
			(c) =>
				c.lastInteractionAt && c.lastInteractionAt.getTime() >= sevenDaysAgo,
		).length,
		activeThisMonth: contacts.filter(
			(c) =>
				c.lastInteractionAt && c.lastInteractionAt.getTime() >= thirtyDaysAgo,
		).length,
		totalLifetimeValue: contacts.reduce(
			(sum, c) => sum + (c.lifetimeValue || 0),
			0,
		),
	};
}
