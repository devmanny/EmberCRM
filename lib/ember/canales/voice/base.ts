import type { agentTable } from "@/lib/db/schema/tables";

/**
 * Call session information
 */
export interface CallSession {
	sessionId: string;
	callId: string;
	status: "queued" | "ringing" | "in-progress" | "completed" | "failed";
	from: string;
	to: string;
	startedAt?: Date;
	answeredAt?: Date;
	endedAt?: Date;
	duration?: number; // seconds
}

/**
 * Call event types
 */
export interface CallEvent {
	type:
		| "call_started"
		| "call_answered"
		| "call_ended"
		| "user_spoke"
		| "agent_responded"
		| "transfer_requested"
		| "error";
	timestamp: Date;
	data?: Record<string, unknown>;
}

/**
 * Voice provider configuration
 */
export interface VoiceProviderConfig {
	apiKey: string;
	organizationId: string;
	agentId: string;
	webhookUrl?: string;
	[key: string]: unknown; // Provider-specific settings
}

/**
 * Agent voice configuration
 */
export interface AgentVoiceConfig {
	voiceId?: string;
	language?: string;
	greeting?: string;
	temperature?: number;
	maxTokens?: number;
	tools?: Array<{
		name: string;
		description: string;
		parameters?: Record<string, unknown>;
	}>;
	[key: string]: unknown; // Provider-specific settings
}

/**
 * Base interface for voice providers
 */
export interface VoiceProvider {
	/**
	 * Provider name (elevenlabs, vapi, retell, twilio)
	 */
	name: string;

	/**
	 * Initialize/create an agent in the voice provider platform
	 * Returns the provider's agent ID
	 */
	initializeAgent(
		agent: typeof agentTable.$inferSelect,
		voiceConfig: AgentVoiceConfig,
	): Promise<string>;

	/**
	 * Update an existing agent configuration
	 */
	updateAgent(
		providerAgentId: string,
		agent: typeof agentTable.$inferSelect,
		voiceConfig: AgentVoiceConfig,
	): Promise<void>;

	/**
	 * Delete an agent from the provider
	 */
	deleteAgent(providerAgentId: string): Promise<void>;

	/**
	 * Start an outbound call
	 */
	startCall(
		providerAgentId: string,
		phoneNumber: string,
		metadata?: Record<string, unknown>,
	): Promise<CallSession>;

	/**
	 * End an active call
	 */
	endCall(sessionId: string): Promise<void>;

	/**
	 * Send a real-time event/message to an active call
	 */
	sendEvent(sessionId: string, event: CallEvent): Promise<void>;

	/**
	 * Get transcript of a call
	 */
	getTranscript(sessionId: string): Promise<string>;

	/**
	 * Get call recording URL
	 */
	getRecording(sessionId: string): Promise<string | null>;

	/**
	 * Handle incoming webhook from provider
	 * Should validate webhook signature and process the event
	 */
	handleWebhook(
		payload: unknown,
		signature?: string,
	): Promise<{
		event: string;
		callId: string;
		data: Record<string, unknown>;
	}>;

	/**
	 * Validate webhook signature
	 */
	validateWebhookSignature(payload: unknown, signature: string): boolean;
}

/**
 * Abstract base class with common functionality
 */
export abstract class BaseVoiceProvider implements VoiceProvider {
	abstract name: string;

	constructor(protected config: VoiceProviderConfig) {}

	abstract initializeAgent(
		agent: typeof agentTable.$inferSelect,
		voiceConfig: AgentVoiceConfig,
	): Promise<string>;

	abstract updateAgent(
		providerAgentId: string,
		agent: typeof agentTable.$inferSelect,
		voiceConfig: AgentVoiceConfig,
	): Promise<void>;

	abstract deleteAgent(providerAgentId: string): Promise<void>;

	abstract startCall(
		providerAgentId: string,
		phoneNumber: string,
		metadata?: Record<string, unknown>,
	): Promise<CallSession>;

	abstract endCall(sessionId: string): Promise<void>;

	abstract sendEvent(sessionId: string, event: CallEvent): Promise<void>;

	abstract getTranscript(sessionId: string): Promise<string>;

	abstract getRecording(sessionId: string): Promise<string | null>;

	abstract handleWebhook(
		payload: unknown,
		signature?: string,
	): Promise<{
		event: string;
		callId: string;
		data: Record<string, unknown>;
	}>;

	abstract validateWebhookSignature(
		payload: unknown,
		signature: string,
	): boolean;

	/**
	 * Helper: Format phone number to E.164
	 */
	protected formatPhoneNumber(phone: string): string {
		// Remove all non-numeric characters
		const cleaned = phone.replace(/\D/g, "");

		// Add + if not present
		return cleaned.startsWith("1") ? `+${cleaned}` : `+1${cleaned}`;
	}

	/**
	 * Helper: Convert agent actions to provider tools
	 */
	protected convertActionsToTools(
		actions: string[],
		webhookBaseUrl: string,
	): Array<{
		name: string;
		description: string;
		webhookUrl?: string;
		parameters?: Record<string, unknown>;
	}> {
		const actionDescriptions: Record<string, string> = {
			send_link: "Send a link to the customer",
			send_document: "Send a document to the customer",
			create_quote: "Create and send a price quote",
			schedule_meeting: "Schedule a meeting or appointment",
			transfer_to_human: "Transfer the call to a human agent",
			check_inventory: "Check product availability and pricing",
			create_order: "Create a new order",
		};

		return actions.map((action) => ({
			name: action,
			description: actionDescriptions[action] || action,
			webhookUrl: `${webhookBaseUrl}/api/ember/actions/${action}`,
		}));
	}
}
