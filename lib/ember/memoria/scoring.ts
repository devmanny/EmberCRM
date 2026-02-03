import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	contactTable,
	conversationMessageTable,
	conversationTable,
} from "@/lib/db/schema/tables";

/**
 * Calculate heat score for a contact (0-100)
 *
 * Heat score components:
 * - Recency (0-30 points): Days since last interaction
 * - Frequency (0-30 points): Number of interactions in last 30 days
 * - Value (0-20 points): Lifetime value
 * - Engagement (0-20 points): Average response time
 */
export async function calculateHeatScore(contactId: string): Promise<number> {
	const dbInstance = db;

	// Get contact data
	const contact = await dbInstance.query.contactTable.findFirst({
		where: eq(contactTable.id, contactId),
	});

	if (!contact) {
		throw new Error("Contact not found");
	}

	let score = 0;

	// 1. Recency score (0-30 points)
	if (contact.lastInteractionAt) {
		const daysSinceLastInteraction = Math.floor(
			(Date.now() - contact.lastInteractionAt.getTime()) /
				(1000 * 60 * 60 * 24),
		);

		if (daysSinceLastInteraction === 0) {
			score += 30; // Interacted today
		} else if (daysSinceLastInteraction <= 1) {
			score += 28; // Yesterday
		} else if (daysSinceLastInteraction <= 3) {
			score += 25; // Last 3 days
		} else if (daysSinceLastInteraction <= 7) {
			score += 20; // Last week
		} else if (daysSinceLastInteraction <= 14) {
			score += 15; // Last 2 weeks
		} else if (daysSinceLastInteraction <= 30) {
			score += 10; // Last month
		} else if (daysSinceLastInteraction <= 60) {
			score += 5; // Last 2 months
		}
		// 0 points if > 60 days
	}

	// 2. Frequency score (0-30 points)
	// Count interactions in last 30 days
	const recentInteractionCount = contact.interactionCount || 0;

	// Scale: 1-5 interactions = 10 pts, 6-15 = 20 pts, 16+ = 30 pts
	if (recentInteractionCount >= 16) {
		score += 30;
	} else if (recentInteractionCount >= 6) {
		score += 20;
	} else if (recentInteractionCount >= 1) {
		score += 10;
	}

	// 3. Value score (0-20 points)
	const lifetimeValue = contact.lifetimeValue || 0;

	// Scale based on value (customize thresholds as needed)
	if (lifetimeValue >= 100000) {
		// $1000+
		score += 20;
	} else if (lifetimeValue >= 50000) {
		// $500+
		score += 15;
	} else if (lifetimeValue >= 10000) {
		// $100+
		score += 10;
	} else if (lifetimeValue >= 1000) {
		// $10+
		score += 5;
	}

	// 4. Engagement score (0-20 points)
	// Based on average response time
	const avgResponseTime = contact.averageResponseTime || null;

	if (avgResponseTime !== null) {
		// Response time in seconds
		// Fast: < 5 min = 20 pts
		// Medium: < 30 min = 15 pts
		// Slow: < 2 hours = 10 pts
		// Very slow: < 24 hours = 5 pts
		if (avgResponseTime < 300) {
			// 5 minutes
			score += 20;
		} else if (avgResponseTime < 1800) {
			// 30 minutes
			score += 15;
		} else if (avgResponseTime < 7200) {
			// 2 hours
			score += 10;
		} else if (avgResponseTime < 86400) {
			// 24 hours
			score += 5;
		}
	}

	// Ensure score is between 0 and 100
	return Math.min(Math.max(Math.round(score), 0), 100);
}

/**
 * Recalculate and update heat score for a contact
 */
export async function recalculateHeatScore(contactId: string): Promise<number> {
	const heatScore = await calculateHeatScore(contactId);

	await db
		.update(contactTable)
		.set({
			heatScore,
			updatedAt: new Date(),
		})
		.where(eq(contactTable.id, contactId));

	return heatScore;
}

/**
 * Calculate average response time for a contact
 * This should be called after each conversation to update the contact's average
 */
export async function calculateAverageResponseTime(
	contactId: string,
): Promise<number | null> {
	// Get all conversations for this contact
	const conversations = await db.query.conversationTable.findMany({
		where: eq(conversationTable.contactId, contactId),
		with: {
			messages: true,
		},
	});

	const responseTimes: number[] = [];

	// Calculate response times for each conversation
	for (const conversation of conversations) {
		let lastInboundTime: Date | null = null;

		for (const message of conversation.messages) {
			if (message.direction === "inbound") {
				lastInboundTime = message.createdAt;
			} else if (message.direction === "outbound" && lastInboundTime) {
				// Calculate time difference in seconds
				const responseTime = Math.floor(
					(message.createdAt.getTime() - lastInboundTime.getTime()) / 1000,
				);

				// Only consider reasonable response times (< 24 hours)
				if (responseTime > 0 && responseTime < 86400) {
					responseTimes.push(responseTime);
				}

				lastInboundTime = null;
			}
		}
	}

	if (responseTimes.length === 0) {
		return null;
	}

	// Calculate average
	const avgResponseTime = Math.floor(
		responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
	);

	// Update contact
	await db
		.update(contactTable)
		.set({
			averageResponseTime: avgResponseTime,
			updatedAt: new Date(),
		})
		.where(eq(contactTable.id, contactId));

	return avgResponseTime;
}

/**
 * Batch recalculate heat scores for all active contacts in an organization
 * Useful for periodic background jobs
 */
export async function batchRecalculateHeatScores(
	organizationId: string,
): Promise<number> {
	const contacts = await db.query.contactTable.findMany({
		where: and(
			eq(contactTable.organizationId, organizationId),
			eq(contactTable.status, "active"),
		),
	});

	let updated = 0;

	for (const contact of contacts) {
		try {
			await recalculateHeatScore(contact.id);
			updated++;
		} catch (error) {
			console.error(
				`Failed to recalculate heat score for contact ${contact.id}:`,
				error,
			);
		}
	}

	return updated;
}

/**
 * Get heat score distribution for an organization
 * Useful for dashboard analytics
 */
export async function getHeatScoreDistribution(
	organizationId: string,
): Promise<{
	hot: number; // 80-100
	warm: number; // 50-79
	cold: number; // 0-49
}> {
	const contacts = await db.query.contactTable.findMany({
		where: and(
			eq(contactTable.organizationId, organizationId),
			eq(contactTable.status, "active"),
		),
		columns: {
			heatScore: true,
		},
	});

	const distribution = {
		hot: 0,
		warm: 0,
		cold: 0,
	};

	for (const contact of contacts) {
		if (contact.heatScore >= 80) {
			distribution.hot++;
		} else if (contact.heatScore >= 50) {
			distribution.warm++;
		} else {
			distribution.cold++;
		}
	}

	return distribution;
}
