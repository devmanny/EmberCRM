import { z } from "zod";
import { AgentType, VoiceProvider } from "@/lib/db/schema/enums";

// Base agent schema
export const agentSchema = z.object({
	name: z.string().min(1, "Name is required").max(200),
	description: z.string().max(1000).optional().nullable(),
	type: z.enum([
		AgentType.sales,
		AgentType.support,
		AgentType.scheduler,
		AgentType.qualifier,
		AgentType.custom,
	]),
	// Voice provider configuration
	voiceProvider: z
		.enum([
			VoiceProvider.elevenlabs,
			VoiceProvider.vapi,
			VoiceProvider.retell,
			VoiceProvider.none,
		])
		.default(VoiceProvider.none),
	voiceProviderId: z.string().optional().nullable(),
	voiceProviderConfig: z.record(z.string(), z.unknown()).optional().nullable(),
	// LLM configuration
	systemPrompt: z.string().min(1, "System prompt is required"),
	temperature: z.number().min(0).max(100).default(70),
	maxTokens: z.number().min(100).max(4000).default(2000),
	model: z.string().default("gpt-4"),
	// Behavior
	objectives: z.array(z.string()).default([]),
	escalationRules: z.record(z.string(), z.unknown()).optional().nullable(),
	allowedActions: z.array(z.string()).default([]),
	knowledgeBase: z.record(z.string(), z.unknown()).optional().nullable(),
	// Assignment
	assignToChannels: z.array(z.string()).default([]),
	assignToCampaigns: z.array(z.string()).default([]),
	active: z.boolean().default(true),
});

// Create agent schema
export const createAgentSchema = agentSchema.extend({
	organizationId: z.string().uuid(),
});

// Update agent schema
export const updateAgentSchema = agentSchema.partial().extend({
	id: z.string().uuid(),
});

// List agents filters schema
export const listAgentsSchema = z.object({
	limit: z.number().min(1).max(100).default(25),
	offset: z.number().min(0).default(0),
	search: z.string().optional(),
	type: z
		.enum([
			AgentType.sales,
			AgentType.support,
			AgentType.scheduler,
			AgentType.qualifier,
			AgentType.custom,
		])
		.optional(),
	voiceProvider: z
		.enum([
			VoiceProvider.elevenlabs,
			VoiceProvider.vapi,
			VoiceProvider.retell,
			VoiceProvider.none,
		])
		.optional(),
	active: z.boolean().optional(),
	orderBy: z.enum(["createdAt", "name", "type"]).default("createdAt"),
	orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

// Assign agent to conversation schema
export const assignAgentSchema = z.object({
	conversationId: z.string().uuid(),
	agentId: z.string().uuid(),
	contactId: z.string().uuid(),
});

// Unassign agent schema
export const unassignAgentSchema = z.object({
	assignmentId: z.string().uuid(),
	reason: z.string().optional(),
});

// Test agent schema
export const testAgentSchema = z.object({
	agentId: z.string().uuid(),
	testMessage: z.string().min(1, "Test message is required"),
	channel: z.string().default("test"),
});

// Agent performance stats schema
export const agentPerformanceSchema = z.object({
	agentId: z.string().uuid(),
	startDate: z.string().datetime().optional(),
	endDate: z.string().datetime().optional(),
});

// Export types
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type ListAgentsInput = z.infer<typeof listAgentsSchema>;
export type AssignAgentInput = z.infer<typeof assignAgentSchema>;
export type UnassignAgentInput = z.infer<typeof unassignAgentSchema>;
export type TestAgentInput = z.infer<typeof testAgentSchema>;
export type AgentPerformanceInput = z.infer<typeof agentPerformanceSchema>;
