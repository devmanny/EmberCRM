import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { agentAssignmentTable, agentTable } from "@/lib/db/schema/tables";
import { agentManager } from "@/lib/ember/agents/manager";
import {
	getAgentAssignments,
	getAgentById,
	getAgentStats,
	listAgents,
} from "@/lib/ember/agents/queries";
import {
	agentPerformanceSchema,
	assignAgentSchema,
	createAgentSchema,
	listAgentsSchema,
	testAgentSchema,
	unassignAgentSchema,
	updateAgentSchema,
} from "@/schemas/agent.schema";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

export const organizationAgentRouter = createTRPCRouter({
	// List agents with filters and pagination
	list: protectedOrganizationProcedure
		.input(listAgentsSchema)
		.query(async ({ ctx, input }) => {
			return await listAgents(ctx.organization.id, input);
		}),

	// Get single agent with full details
	get: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			// First verify agent belongs to organization
			const agentVerify = await db.query.agentTable.findFirst({
				where: and(
					eq(agentTable.id, input.id),
					eq(agentTable.organizationId, ctx.organization.id),
				),
			});

			if (!agentVerify) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agent not found",
				});
			}

			const agent = await getAgentById(input.id);

			if (!agent) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agent not found",
				});
			}

			return agent;
		}),

	// Create new agent
	create: protectedOrganizationProcedure
		.input(createAgentSchema)
		.mutation(async ({ ctx, input }) => {
			const {
				objectives,
				escalationRules,
				allowedActions,
				knowledgeBase,
				assignToChannels,
				assignToCampaigns,
				voiceProviderConfig,
				...data
			} = input;

			const [agent] = await db
				.insert(agentTable)
				.values({
					...data,
					organizationId: ctx.organization.id,
					objectives: JSON.stringify(objectives),
					escalationRules: escalationRules
						? JSON.stringify(escalationRules)
						: null,
					allowedActions: JSON.stringify(allowedActions),
					knowledgeBase: knowledgeBase ? JSON.stringify(knowledgeBase) : null,
					assignToChannels: JSON.stringify(assignToChannels),
					assignToCampaigns: JSON.stringify(assignToCampaigns),
					voiceProviderConfig: voiceProviderConfig
						? JSON.stringify(voiceProviderConfig)
						: null,
				})
				.returning();

			return agent;
		}),

	// Update agent
	update: protectedOrganizationProcedure
		.input(updateAgentSchema)
		.mutation(async ({ ctx, input }) => {
			const {
				id,
				objectives,
				escalationRules,
				allowedActions,
				knowledgeBase,
				assignToChannels,
				assignToCampaigns,
				voiceProviderConfig,
				...data
			} = input;

			// Prepare update data
			const updateData = {
				...data,
				...(objectives !== undefined && {
					objectives: JSON.stringify(objectives),
				}),
				...(escalationRules !== undefined && {
					escalationRules: JSON.stringify(escalationRules),
				}),
				...(allowedActions !== undefined && {
					allowedActions: JSON.stringify(allowedActions),
				}),
				...(knowledgeBase !== undefined && {
					knowledgeBase: JSON.stringify(knowledgeBase),
				}),
				...(assignToChannels !== undefined && {
					assignToChannels: JSON.stringify(assignToChannels),
				}),
				...(assignToCampaigns !== undefined && {
					assignToCampaigns: JSON.stringify(assignToCampaigns),
				}),
				...(voiceProviderConfig !== undefined && {
					voiceProviderConfig: JSON.stringify(voiceProviderConfig),
				}),
				updatedAt: new Date(),
			};

			// Atomic update with organization check
			const [updatedAgent] = await db
				.update(agentTable)
				.set(updateData)
				.where(
					and(
						eq(agentTable.id, id),
						eq(agentTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!updatedAgent) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agent not found",
				});
			}

			return updatedAgent;
		}),

	// Delete agent
	delete: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Check for active assignments
			const activeAssignments = await db.query.agentAssignmentTable.findMany({
				where: and(
					eq(agentAssignmentTable.agentId, input.id),
					isNull(agentAssignmentTable.unassignedAt),
				),
			});

			if (activeAssignments.length > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Cannot delete agent with active assignments. Please unassign the agent first.",
				});
			}

			// Atomic delete with organization check
			const deletedAgents = await db
				.delete(agentTable)
				.where(
					and(
						eq(agentTable.id, input.id),
						eq(agentTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			const deletedAgent = (
				deletedAgents as (typeof agentTable.$inferSelect)[]
			)[0];
			if (!deletedAgent) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agent not found",
				});
			}

			return { success: true };
		}),

	// Assign agent to conversation
	assign: protectedOrganizationProcedure
		.input(assignAgentSchema)
		.mutation(async ({ ctx, input }) => {
			// Verify agent belongs to organization
			const agent = await db.query.agentTable.findFirst({
				where: and(
					eq(agentTable.id, input.agentId),
					eq(agentTable.organizationId, ctx.organization.id),
				),
			});

			if (!agent) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agent not found",
				});
			}

			if (!agent.active) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot assign inactive agent",
				});
			}

			const assignment = await agentManager.assignAgentToConversation(
				input.conversationId,
				input.agentId,
				input.contactId,
			);

			return assignment;
		}),

	// Unassign agent from conversation
	unassign: protectedOrganizationProcedure
		.input(unassignAgentSchema)
		.mutation(async ({ ctx, input }) => {
			// Verify assignment belongs to organization
			const assignment = await db.query.agentAssignmentTable.findFirst({
				where: eq(agentAssignmentTable.id, input.assignmentId),
				with: {
					agent: {
						columns: {
							organizationId: true,
						},
					},
				},
			});

			if (
				!assignment ||
				!("organizationId" in assignment.agent) ||
				assignment.agent.organizationId !== ctx.organization.id
			) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found",
				});
			}

			const unassignedAssignment = await agentManager.unassignAgent(
				input.assignmentId,
				input.reason,
			);

			return unassignedAssignment;
		}),

	// Get agent assignments
	getAssignments: protectedOrganizationProcedure
		.input(
			z.object({
				agentId: z.string().uuid(),
				includeCompleted: z.boolean().default(false),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify agent belongs to organization
			const agent = await db.query.agentTable.findFirst({
				where: and(
					eq(agentTable.id, input.agentId),
					eq(agentTable.organizationId, ctx.organization.id),
				),
			});

			if (!agent) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agent not found",
				});
			}

			return await getAgentAssignments(input.agentId, input.includeCompleted);
		}),

	// Get agent performance metrics
	getPerformance: protectedOrganizationProcedure
		.input(agentPerformanceSchema)
		.query(async ({ ctx, input }) => {
			// Verify agent belongs to organization
			const agent = await db.query.agentTable.findFirst({
				where: and(
					eq(agentTable.id, input.agentId),
					eq(agentTable.organizationId, ctx.organization.id),
				),
			});

			if (!agent) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agent not found",
				});
			}

			const startDate = input.startDate ? new Date(input.startDate) : undefined;
			const endDate = input.endDate ? new Date(input.endDate) : undefined;

			return await agentManager.getAgentPerformance(
				input.agentId,
				startDate,
				endDate,
			);
		}),

	// Get agent statistics for dashboard
	stats: protectedOrganizationProcedure.query(async ({ ctx }) => {
		return await getAgentStats(ctx.organization.id);
	}),

	// Test agent with sample message
	test: protectedOrganizationProcedure
		.input(testAgentSchema)
		.mutation(async ({ ctx, input }) => {
			// Verify agent belongs to organization
			const agent = await db.query.agentTable.findFirst({
				where: and(
					eq(agentTable.id, input.agentId),
					eq(agentTable.organizationId, ctx.organization.id),
				),
			});

			if (!agent) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agent not found",
				});
			}

			// TODO: Implement actual AI testing logic in Phase 6 (Ember Core)
			// For now, return mock response
			return {
				success: true,
				message:
					"Agent test endpoint ready - AI logic pending Ember Core implementation",
				agent: {
					id: agent.id,
					name: agent.name,
					type: agent.type,
				},
				testInput: {
					message: input.testMessage,
					channel: input.channel,
				},
			};
		}),
});
