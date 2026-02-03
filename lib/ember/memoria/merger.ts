import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ContactStatus } from "@/lib/db/schema/enums";
import {
	agentAssignmentTable,
	contactAgreementTable,
	contactNoteTable,
	contactSourceTable,
	contactTable,
	conversationTable,
	formSubmissionTable,
	voiceCallTable,
} from "@/lib/db/schema/tables";
import { recalculateHeatScore } from "./scoring";

/**
 * Duplicate candidate with confidence score
 */
export interface DuplicateCandidate {
	id: string;
	confidence: number; // 0-1
	matchReason: string;
	contact: typeof contactTable.$inferSelect;
}

/**
 * Normalize phone number for comparison
 * Removes spaces, dashes, parentheses, and country code prefixes
 */
export function normalizePhoneNumber(phone: string): string {
	// Remove all non-digit characters
	let normalized = phone.replace(/\D/g, "");

	// Remove common country codes
	if (normalized.startsWith("1") && normalized.length === 11) {
		normalized = normalized.slice(1); // Remove US country code
	}
	if (normalized.startsWith("52") && normalized.length === 12) {
		normalized = normalized.slice(2); // Remove Mexico country code
	}

	return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy name matching
 */
function levenshteinDistance(str1: string, str2: string): number {
	const len1 = str1.length;
	const len2 = str2.length;
	const matrix: number[][] = [];

	for (let i = 0; i <= len1; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= len2; j++) {
		if (matrix[0]) {
			matrix[0][j] = j;
		}
	}

	for (let i = 1; i <= len1; i++) {
		for (let j = 1; j <= len2; j++) {
			const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
			const prevI = matrix[i - 1];
			const currI = matrix[i];
			const prevIJ = prevI?.[j];
			const currIJ = currI?.[j - 1];
			const prevIJ1 = prevI?.[j - 1];

			if (
				prevIJ !== undefined &&
				currIJ !== undefined &&
				prevIJ1 !== undefined
			) {
				matrix[i]![j] = Math.min(
					prevIJ + 1, // deletion
					currIJ + 1, // insertion
					prevIJ1 + cost, // substitution
				);
			}
		}
	}

	const result = matrix[len1]?.[len2];
	return result !== undefined ? result : 0;
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
	const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
	const maxLength = Math.max(str1.length, str2.length);
	return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

/**
 * Detect duplicate contacts for a given contact profile
 */
export async function detectDuplicateContacts(
	organizationId: string,
	contact: {
		email?: string | null;
		phone?: string | null;
		firstName?: string | null;
		lastName?: string | null;
	},
	threshold = 0.7,
): Promise<DuplicateCandidate[]> {
	const candidates: DuplicateCandidate[] = [];

	// 1. Exact email match (highest confidence)
	if (contact.email) {
		const emailMatches = await db.query.contactTable.findMany({
			where: and(
				eq(contactTable.organizationId, organizationId),
				eq(contactTable.email, contact.email),
				eq(contactTable.status, ContactStatus.active),
			),
		});

		for (const match of emailMatches) {
			candidates.push({
				id: match.id,
				confidence: 1.0,
				matchReason: "Exact email match",
				contact: match,
			});
		}
	}

	// 2. Exact phone match (high confidence)
	if (contact.phone) {
		const normalizedPhone = normalizePhoneNumber(contact.phone);
		const phoneMatches = await db.query.contactTable.findMany({
			where: and(
				eq(contactTable.organizationId, organizationId),
				eq(contactTable.status, ContactStatus.active),
			),
		});

		for (const match of phoneMatches) {
			if (match.phone) {
				const matchNormalizedPhone = normalizePhoneNumber(match.phone);
				if (matchNormalizedPhone === normalizedPhone) {
					// Skip if already added by email
					if (!candidates.some((c) => c.id === match.id)) {
						candidates.push({
							id: match.id,
							confidence: 0.95,
							matchReason: "Exact phone match (normalized)",
							contact: match,
						});
					}
				}
			}
		}
	}

	// 3. Fuzzy name matching (medium confidence)
	if (contact.firstName && contact.lastName) {
		const nameMatches = await db.query.contactTable.findMany({
			where: and(
				eq(contactTable.organizationId, organizationId),
				eq(contactTable.status, ContactStatus.active),
			),
		});

		for (const match of nameMatches) {
			// Skip if already matched
			if (candidates.some((c) => c.id === match.id)) {
				continue;
			}

			const firstNameSimilarity = calculateSimilarity(
				contact.firstName || "",
				match.firstName,
			);
			const lastNameSimilarity = calculateSimilarity(
				contact.lastName || "",
				match.lastName,
			);
			const avgSimilarity = (firstNameSimilarity + lastNameSimilarity) / 2;

			if (avgSimilarity >= threshold) {
				// Boost confidence if there's partial email or phone match
				let confidence = avgSimilarity * 0.7; // Base confidence for name only

				if (
					contact.email &&
					match.email &&
					contact.email.split("@")[0] === match.email.split("@")[0]
				) {
					confidence = Math.min(confidence + 0.15, 0.95);
				}

				if (contact.phone && match.phone) {
					const phoneDigits = normalizePhoneNumber(contact.phone);
					const matchPhoneDigits = normalizePhoneNumber(match.phone);
					if (
						phoneDigits.slice(-4) === matchPhoneDigits.slice(-4) &&
						phoneDigits.length >= 4
					) {
						confidence = Math.min(confidence + 0.1, 0.95);
					}
				}

				candidates.push({
					id: match.id,
					confidence,
					matchReason: `Fuzzy name match (${Math.round(avgSimilarity * 100)}% similar)`,
					contact: match,
				});
			}
		}
	}

	// Sort by confidence (highest first)
	return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Merge tags from multiple contacts
 */
function mergeTags(...tagArrays: (string | null)[]): string[] {
	const allTags = new Set<string>();

	for (const tags of tagArrays) {
		if (tags) {
			try {
				const parsed = typeof tags === "string" ? JSON.parse(tags) : tags;
				if (Array.isArray(parsed)) {
					for (const tag of parsed) {
						if (typeof tag === "string") {
							allTags.add(tag.trim().toLowerCase());
						}
					}
				}
			} catch {
				// Skip invalid JSON
			}
		}
	}

	return Array.from(allTags);
}

/**
 * Merge custom fields from multiple contacts
 */
function mergeCustomFields(
	...fieldObjects: (string | null)[]
): Record<string, unknown> {
	const merged: Record<string, unknown> = {};

	for (const fields of fieldObjects) {
		if (fields) {
			try {
				const parsed = typeof fields === "string" ? JSON.parse(fields) : fields;
				if (typeof parsed === "object" && parsed !== null) {
					Object.assign(merged, parsed);
				}
			} catch {
				// Skip invalid JSON
			}
		}
	}

	return merged;
}

/**
 * Merge multiple contacts into a single primary contact
 */
export async function mergeContacts(
	primaryId: string,
	duplicateIds: string[],
): Promise<typeof contactTable.$inferSelect> {
	return await db
		.transaction(async (tx) => {
			// 1. Get all contacts
			const primary = await tx.query.contactTable.findFirst({
				where: eq(contactTable.id, primaryId),
			});

			if (!primary) {
				throw new Error("Primary contact not found");
			}

			const duplicates = await tx.query.contactTable.findMany({
				where: inArray(contactTable.id, duplicateIds),
			});

			if (duplicates.length === 0) {
				throw new Error("No duplicate contacts found");
			}

			// 2. Combine information (keep first non-null value)
			const merged = {
				phone: primary.phone || duplicates.find((d) => d.phone)?.phone || null,
				email: primary.email || duplicates.find((d) => d.email)?.email || null,
				company:
					primary.company || duplicates.find((d) => d.company)?.company || null,
				timezone:
					primary.timezone ||
					duplicates.find((d) => d.timezone)?.timezone ||
					null,
				channelPreference:
					primary.channelPreference ||
					duplicates.find((d) => d.channelPreference)?.channelPreference ||
					null,
				tags: JSON.stringify(
					mergeTags(primary.tags, ...duplicates.map((d) => d.tags)),
				),
				customFields: JSON.stringify(
					mergeCustomFields(
						primary.customFields,
						...duplicates.map((d) => d.customFields),
					),
				),
				lifetimeValue:
					(primary.lifetimeValue || 0) +
					duplicates.reduce((sum, d) => sum + (d.lifetimeValue || 0), 0),
				interactionCount:
					primary.interactionCount +
					duplicates.reduce((sum, d) => sum + d.interactionCount, 0),
				mergedContactIds: JSON.stringify([
					...(primary.mergedContactIds
						? JSON.parse(primary.mergedContactIds)
						: []),
					...duplicateIds,
				]),
			};

			// 3. Update primary contact
			await tx
				.update(contactTable)
				.set({
					...merged,
					updatedAt: new Date(),
				})
				.where(eq(contactTable.id, primaryId));

			// 4. Migrate all references to primary contact
			await tx
				.update(conversationTable)
				.set({ contactId: primaryId })
				.where(inArray(conversationTable.contactId, duplicateIds));

			await tx
				.update(contactAgreementTable)
				.set({ contactId: primaryId })
				.where(inArray(contactAgreementTable.contactId, duplicateIds));

			await tx
				.update(contactNoteTable)
				.set({ contactId: primaryId })
				.where(inArray(contactNoteTable.contactId, duplicateIds));

			await tx
				.update(contactSourceTable)
				.set({ contactId: primaryId })
				.where(inArray(contactSourceTable.contactId, duplicateIds));

			await tx
				.update(agentAssignmentTable)
				.set({ contactId: primaryId })
				.where(inArray(agentAssignmentTable.contactId, duplicateIds));

			await tx
				.update(formSubmissionTable)
				.set({ contactId: primaryId })
				.where(inArray(formSubmissionTable.contactId, duplicateIds));

			await tx
				.update(voiceCallTable)
				.set({ contactId: primaryId })
				.where(inArray(voiceCallTable.contactId, duplicateIds));

			// 5. Mark duplicates as merged
			await tx
				.update(contactTable)
				.set({
					status: ContactStatus.merged,
					mergedWithId: primaryId,
					updatedAt: new Date(),
				})
				.where(inArray(contactTable.id, duplicateIds));

			// 6. Recalculate heat score with new interaction count
			// Note: recalculateHeatScore will be called outside transaction to avoid type issues
			// await recalculateHeatScore(primaryId, tx);

			// 7. Return updated primary contact
			const updatedPrimary = await tx.query.contactTable.findFirst({
				where: eq(contactTable.id, primaryId),
			});

			if (!updatedPrimary) {
				throw new Error("Failed to retrieve updated primary contact");
			}

			return updatedPrimary;
		})
		.then(async (result) => {
			// Recalculate heat score after transaction completes
			await recalculateHeatScore(primaryId);
			return result;
		});
}

/**
 * Automatically merge contacts with high confidence (>=0.9)
 * Returns the number of merges performed
 */
export async function autoMergeHighConfidenceDuplicates(
	organizationId: string,
): Promise<number> {
	const contacts = await db.query.contactTable.findMany({
		where: and(
			eq(contactTable.organizationId, organizationId),
			eq(contactTable.status, ContactStatus.active),
		),
	});

	let mergeCount = 0;

	for (const contact of contacts) {
		const duplicates = await detectDuplicateContacts(
			organizationId,
			contact,
			0.9,
		);

		// Only auto-merge exact matches (confidence >= 0.95)
		const highConfidenceDupes = duplicates.filter((d) => d.confidence >= 0.95);

		if (highConfidenceDupes.length > 0) {
			try {
				await mergeContacts(
					contact.id,
					highConfidenceDupes.map((d) => d.id),
				);
				mergeCount += highConfidenceDupes.length;
			} catch (error) {
				console.error(`Failed to merge contact ${contact.id}:`, error);
			}
		}
	}

	return mergeCount;
}
