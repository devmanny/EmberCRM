import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import type { AgentType, ChannelType } from "@/lib/db/schema/enums";
import {
	agentAssignmentTable,
	agentTable,
	contactTable,
	conversationTable,
} from "@/lib/db/schema/tables";

/**
 * Agent selection criteria
 */
export interface AgentSelectionCriteria {
	channel: ChannelType;
	contactId?: string;
	intent?: string;
	campaign?: string;
	priority?: number;
}

/**
 * Agent manager for intelligent agent assignment and orchestration
 */
export class AgentManager {
	/**
	 * Select the best agent for a conversation based on criteria
	 */
	async selectBestAgent(
		organizationId: string,
		criteria: AgentSelectionCriteria,
	): Promise<typeof agentTable.$inferSelect | null> {
		// Get all active agents for this organization
		const agents = await db.query.agentTable.findMany({
			where: and(
				eq(agentTable.organizationId, organizationId),
				eq(agentTable.active, true),
			),
		});

		if (agents.length === 0) {
			return null;
		}

		// Score each agent based on criteria
		const scoredAgents = agents.map((agent) => {
			let score = 0;

			// Parse JSON fields
			const assignToChannels = agent.assignToChannels
				? JSON.parse(agent.assignToChannels)
				: [];
			const assignToCampaigns = agent.assignToCampaigns
				? JSON.parse(agent.assignToCampaigns)
				: [];

			// 1. Channel matching (30 points)
			if (
				Array.isArray(assignToChannels) &&
				assignToChannels.includes(criteria.channel)
			) {
				score += 30;
			}

			// 2. Campaign matching (25 points)
			if (criteria.campaign && Array.isArray(assignToCampaigns)) {
				if (assignToCampaigns.includes(criteria.campaign)) {
					score += 25;
				}
			}

			// 3. Agent type priority (20 points)
			// Qualifier agents get priority for new contacts
			// Sales agents get priority for warm contacts
			// Support agents get priority for existing customers
			if (agent.type === "qualifier" && !criteria.contactId) {
				score += 20;
			} else if (agent.type === "sales" && criteria.intent === "purchase") {
				score += 20;
			} else if (agent.type === "support" && criteria.intent === "help") {
				score += 20;
			} else if (agent.type === "scheduler" && criteria.intent === "schedule") {
				score += 20;
			}

			// 4. Voice capability for calls (15 points)
			if (
				criteria.channel === "calls" &&
				agent.voiceProvider &&
				agent.voiceProvider !== "none"
			) {
				score += 15;
			}

			// 5. Availability (10 points)
			// TODO: Check current active assignments
			score += 10;

			return { agent, score };
		});

		// Sort by score (highest first)
		scoredAgents.sort((a, b) => b.score - a.score);

		// Return best match
		return scoredAgents[0]?.agent || null;
	}

	/**
	 * Assign an agent to a conversation
	 */
	async assignAgentToConversation(
		conversationId: string,
		agentId: string,
		contactId: string,
	): Promise<typeof agentAssignmentTable.$inferSelect> {
		return await db.transaction(async (tx) => {
			// Check if there's already an active assignment
			const existingAssignment = await tx.query.agentAssignmentTable.findFirst({
				where: and(
					eq(agentAssignmentTable.conversationId, conversationId),
					isNull(agentAssignmentTable.unassignedAt),
				),
			});

			if (existingAssignment) {
				// Unassign previous agent
				await tx
					.update(agentAssignmentTable)
					.set({
						unassignedAt: new Date(),
						reasonForUnassignment: "Reassigned to different agent",
					})
					.where(eq(agentAssignmentTable.id, existingAssignment.id));
			}

			// Create new assignment
			const assignments = await tx
				.insert(agentAssignmentTable)
				.values({
					conversationId,
					agentId,
					contactId,
					assignedAt: new Date(),
					messagesHandled: 0,
					creditsUsed: 0,
				})
				.returning();

			const assignment = (
				assignments as (typeof agentAssignmentTable.$inferSelect)[]
			)[0];
			if (!assignment) {
				throw new Error("Failed to create agent assignment");
			}

			return assignment;
		});
	}

	/**
	 * Unassign an agent from a conversation
	 */
	async unassignAgent(
		assignmentId: string,
		reason?: string,
	): Promise<typeof agentAssignmentTable.$inferSelect> {
		const assignments = await db
			.update(agentAssignmentTable)
			.set({
				unassignedAt: new Date(),
				reasonForUnassignment: reason || "Manual unassignment",
			})
			.where(
				and(
					eq(agentAssignmentTable.id, assignmentId),
					isNull(agentAssignmentTable.unassignedAt),
				),
			)
			.returning();

		const assignment = (
			assignments as (typeof agentAssignmentTable.$inferSelect)[]
		)[0];
		if (!assignment) {
			throw new Error("Assignment not found or already unassigned");
		}

		return assignment;
	}

	/**
	 * Get currently assigned agent for a conversation
	 */
	async getCurrentAssignment(conversationId: string) {
		const assignment = await db.query.agentAssignmentTable.findFirst({
			where: and(
				eq(agentAssignmentTable.conversationId, conversationId),
				isNull(agentAssignmentTable.unassignedAt),
			),
			with: {
				agent: true,
			},
		});

		return assignment || null;
	}

	/**
	 * Check if agent should escalate to human
	 */
	shouldEscalateToHuman(
		agent: typeof agentTable.$inferSelect,
		context: {
			messageCount: number;
			sentiment?: string;
			keywords?: string[];
		},
	): boolean {
		if (!agent.escalationRules) {
			return false;
		}

		try {
			const rules =
				typeof agent.escalationRules === "string"
					? JSON.parse(agent.escalationRules)
					: agent.escalationRules;

			// Check message count threshold
			if (rules.maxMessages && context.messageCount >= rules.maxMessages) {
				return true;
			}

			// Check sentiment
			if (
				rules.escalateOnNegativeSentiment &&
				context.sentiment === "negative"
			) {
				return true;
			}

			// Check keywords
			if (rules.escalationKeywords && context.keywords) {
				const escalationKeywords = rules.escalationKeywords as string[];
				const hasEscalationKeyword = context.keywords.some((keyword) =>
					escalationKeywords.some((ek) =>
						keyword.toLowerCase().includes(ek.toLowerCase()),
					),
				);
				if (hasEscalationKeyword) {
					return true;
				}
			}

			return false;
		} catch {
			return false;
		}
	}

	/**
	 * Get agent performance metrics
	 */
	async getAgentPerformance(
		agentId: string,
		startDate?: Date,
		endDate?: Date,
	): Promise<{
		totalAssignments: number;
		activeAssignments: number;
		totalMessagesHandled: number;
		totalCreditsUsed: number;
		averageSatisfaction: number | null;
		averageHandlingTime: number | null;
	}> {
		const assignments = await db.query.agentAssignmentTable.findMany({
			where: and(
				eq(agentAssignmentTable.agentId, agentId),
				startDate
					? and(
							eq(agentAssignmentTable.agentId, agentId),
							// eslint-disable-next-line drizzle/enforce-delete-with-where
							eq(agentAssignmentTable.assignedAt, startDate),
						)
					: undefined,
			),
		});

		const totalAssignments = assignments.length;
		const activeAssignments = assignments.filter(
			(a) => a.unassignedAt === null,
		).length;
		const totalMessagesHandled = assignments.reduce(
			(sum, a) => sum + (a.messagesHandled || 0),
			0,
		);
		const totalCreditsUsed = assignments.reduce(
			(sum, a) => sum + (a.creditsUsed || 0),
			0,
		);

		const satisfactionScores = assignments
			.filter((a) => a.satisfaction !== null)
			.map((a) => a.satisfaction as number);
		const averageSatisfaction =
			satisfactionScores.length > 0
				? satisfactionScores.reduce((sum, s) => sum + s, 0) /
					satisfactionScores.length
				: null;

		// Calculate average handling time
		const completedAssignments = assignments.filter((a) => a.unassignedAt);
		const handlingTimes = completedAssignments.map((a) => {
			if (!a.assignedAt || !a.unassignedAt) return 0;
			return a.unassignedAt.getTime() - a.assignedAt.getTime();
		});
		const averageHandlingTime =
			handlingTimes.length > 0
				? handlingTimes.reduce((sum, t) => sum + t, 0) /
					handlingTimes.length /
					1000 // Convert to seconds
				: null;

		return {
			totalAssignments,
			activeAssignments,
			totalMessagesHandled,
			totalCreditsUsed,
			averageSatisfaction,
			averageHandlingTime,
		};
	}

	/**
	 * Get agent workload (current active assignments)
	 */
	async getAgentWorkload(agentId: string): Promise<number> {
		const activeAssignments = await db.query.agentAssignmentTable.findMany({
			where: and(
				eq(agentAssignmentTable.agentId, agentId),
				isNull(agentAssignmentTable.unassignedAt),
			),
		});

		return activeAssignments.length;
	}

	/**
	 * Find best available agent for new conversation
	 */
	async findBestAvailableAgent(
		organizationId: string,
		criteria: AgentSelectionCriteria,
	): Promise<typeof agentTable.$inferSelect | null> {
		const bestAgent = await this.selectBestAgent(organizationId, criteria);

		if (!bestAgent) {
			return null;
		}

		// Check workload
		const workload = await this.getAgentWorkload(bestAgent.id);

		// If agent is overloaded (>10 active conversations), try to find alternative
		if (workload > 10) {
			// Get all agents sorted by workload
			const agents = await db.query.agentTable.findMany({
				where: and(
					eq(agentTable.organizationId, organizationId),
					eq(agentTable.active, true),
				),
			});

			// Find agent with lowest workload
			const agentWorkloads = await Promise.all(
				agents.map(async (agent) => ({
					agent,
					workload: await this.getAgentWorkload(agent.id),
				})),
			);

			agentWorkloads.sort((a, b) => a.workload - b.workload);

			return agentWorkloads[0]?.agent || null;
		}

		return bestAgent;
	}
}

// Export singleton instance
export const agentManager = new AgentManager();
