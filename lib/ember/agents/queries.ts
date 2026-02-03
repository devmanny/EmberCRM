import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { AgentType, VoiceProvider } from "@/lib/db/schema/enums";
import { agentAssignmentTable, agentTable } from "@/lib/db/schema/tables";
import type { ListAgentsInput } from "@/schemas/agent.schema";

/**
 * Get agent by ID with full details
 */
export async function getAgentById(agentId: string) {
	const agent = await db.query.agentTable.findFirst({
		where: eq(agentTable.id, agentId),
	});

	if (!agent) {
		return null;
	}

	// Parse JSON fields
	return {
		...agent,
		objectives: agent.objectives ? JSON.parse(agent.objectives) : [],
		escalationRules: agent.escalationRules
			? JSON.parse(agent.escalationRules)
			: null,
		allowedActions: agent.allowedActions
			? JSON.parse(agent.allowedActions)
			: [],
		knowledgeBase: agent.knowledgeBase ? JSON.parse(agent.knowledgeBase) : null,
		assignToChannels: agent.assignToChannels
			? JSON.parse(agent.assignToChannels)
			: [],
		assignToCampaigns: agent.assignToCampaigns
			? JSON.parse(agent.assignToCampaigns)
			: [],
		voiceProviderConfig: agent.voiceProviderConfig
			? JSON.parse(agent.voiceProviderConfig)
			: null,
	};
}

/**
 * List agents with filters and pagination
 */
export async function listAgents(
	organizationId: string,
	filters: ListAgentsInput,
) {
	const conditions = [eq(agentTable.organizationId, organizationId)];

	// Search by name or description
	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			sql`${agentTable.name} ILIKE ${searchTerm} OR ${agentTable.description} ILIKE ${searchTerm}`,
		);
	}

	// Type filter
	if (filters.type) {
		conditions.push(eq(agentTable.type, filters.type));
	}

	// Voice provider filter
	if (filters.voiceProvider) {
		conditions.push(eq(agentTable.voiceProvider, filters.voiceProvider));
	}

	// Active filter
	if (filters.active !== undefined) {
		conditions.push(eq(agentTable.active, filters.active));
	}

	// Build order by
	const direction = filters.orderDirection === "asc" ? asc : desc;
	let orderByClause: ReturnType<typeof direction>;

	switch (filters.orderBy) {
		case "name":
			orderByClause = direction(agentTable.name);
			break;
		case "type":
			orderByClause = direction(agentTable.type);
			break;
		default:
			orderByClause = desc(agentTable.createdAt);
	}

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(agentTable)
		.where(and(...conditions));

	const count = countResult[0]?.count ?? 0;

	// Get agents
	const agents = await db.query.agentTable.findMany({
		where: and(...conditions),
		orderBy: orderByClause,
		limit: filters.limit,
		offset: filters.offset,
	});

	// Parse JSON fields for each agent
	const parsedAgents = agents.map((agent) => ({
		...agent,
		objectives: agent.objectives ? JSON.parse(agent.objectives) : [],
		escalationRules: agent.escalationRules
			? JSON.parse(agent.escalationRules)
			: null,
		allowedActions: agent.allowedActions
			? JSON.parse(agent.allowedActions)
			: [],
		knowledgeBase: agent.knowledgeBase ? JSON.parse(agent.knowledgeBase) : null,
		assignToChannels: agent.assignToChannels
			? JSON.parse(agent.assignToChannels)
			: [],
		assignToCampaigns: agent.assignToCampaigns
			? JSON.parse(agent.assignToCampaigns)
			: [],
		voiceProviderConfig: agent.voiceProviderConfig
			? JSON.parse(agent.voiceProviderConfig)
			: null,
	}));

	return {
		agents: parsedAgents,
		total: count,
		hasMore: count > filters.offset + filters.limit,
	};
}

/**
 * Get agent assignments with details
 */
export async function getAgentAssignments(
	agentId: string,
	includeCompleted = false,
) {
	const conditions = [eq(agentAssignmentTable.agentId, agentId)];

	if (!includeCompleted) {
		conditions.push(sql`${agentAssignmentTable.unassignedAt} IS NULL`);
	}

	const assignments = await db.query.agentAssignmentTable.findMany({
		where: and(...conditions),
		with: {
			conversation: {
				with: {
					contact: {
						columns: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							phone: true,
						},
					},
				},
			},
		},
		orderBy: desc(agentAssignmentTable.assignedAt),
	});

	return assignments;
}

/**
 * Get agents by type
 */
export async function getAgentsByType(organizationId: string, type: AgentType) {
	const agents = await db.query.agentTable.findMany({
		where: and(
			eq(agentTable.organizationId, organizationId),
			eq(agentTable.type, type),
			eq(agentTable.active, true),
		),
		orderBy: desc(agentTable.createdAt),
	});

	return agents.map((agent) => ({
		...agent,
		objectives: agent.objectives ? JSON.parse(agent.objectives) : [],
		escalationRules: agent.escalationRules
			? JSON.parse(agent.escalationRules)
			: null,
		allowedActions: agent.allowedActions
			? JSON.parse(agent.allowedActions)
			: [],
		knowledgeBase: agent.knowledgeBase ? JSON.parse(agent.knowledgeBase) : null,
		assignToChannels: agent.assignToChannels
			? JSON.parse(agent.assignToChannels)
			: [],
		assignToCampaigns: agent.assignToCampaigns
			? JSON.parse(agent.assignToCampaigns)
			: [],
		voiceProviderConfig: agent.voiceProviderConfig
			? JSON.parse(agent.voiceProviderConfig)
			: null,
	}));
}

/**
 * Get agents with voice capabilities
 */
export async function getVoiceEnabledAgents(organizationId: string) {
	const agents = await db.query.agentTable.findMany({
		where: and(
			eq(agentTable.organizationId, organizationId),
			eq(agentTable.active, true),
			sql`${agentTable.voiceProvider} != 'none'`,
		),
		orderBy: desc(agentTable.createdAt),
	});

	return agents.map((agent) => ({
		...agent,
		objectives: agent.objectives ? JSON.parse(agent.objectives) : [],
		escalationRules: agent.escalationRules
			? JSON.parse(agent.escalationRules)
			: null,
		allowedActions: agent.allowedActions
			? JSON.parse(agent.allowedActions)
			: [],
		knowledgeBase: agent.knowledgeBase ? JSON.parse(agent.knowledgeBase) : null,
		assignToChannels: agent.assignToChannels
			? JSON.parse(agent.assignToChannels)
			: [],
		assignToCampaigns: agent.assignToCampaigns
			? JSON.parse(agent.assignToCampaigns)
			: [],
		voiceProviderConfig: agent.voiceProviderConfig
			? JSON.parse(agent.voiceProviderConfig)
			: null,
	}));
}

/**
 * Get agent statistics for dashboard
 */
export async function getAgentStats(organizationId: string) {
	const agents = await db.query.agentTable.findMany({
		where: eq(agentTable.organizationId, organizationId),
	});

	const activeAgents = agents.filter((a) => a.active).length;
	const inactiveAgents = agents.filter((a) => !a.active).length;

	// Count by type
	const byType: Record<string, number> = {
		sales: 0,
		support: 0,
		scheduler: 0,
		qualifier: 0,
		custom: 0,
	};

	for (const agent of agents) {
		if (agent.active) {
			byType[agent.type] = (byType[agent.type] || 0) + 1;
		}
	}

	// Count by voice provider
	const byVoiceProvider: Record<string, number> = {
		none: 0,
		elevenlabs: 0,
		vapi: 0,
		retell: 0,
	};

	for (const agent of agents) {
		if (agent.active) {
			byVoiceProvider[agent.voiceProvider] =
				(byVoiceProvider[agent.voiceProvider] || 0) + 1;
		}
	}

	// Get active assignments count
	const activeAssignments = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(agentAssignmentTable)
		.where(sql`${agentAssignmentTable.unassignedAt} IS NULL`);

	return {
		total: agents.length,
		active: activeAgents,
		inactive: inactiveAgents,
		byType,
		byVoiceProvider,
		activeAssignments: activeAssignments[0]?.count ?? 0,
	};
}
