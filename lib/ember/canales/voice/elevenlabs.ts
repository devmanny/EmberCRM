import crypto from "node:crypto";
import type { agentTable } from "@/lib/db/schema/tables";
import {
	type AgentVoiceConfig,
	BaseVoiceProvider,
	type CallEvent,
	type CallSession,
	type VoiceProviderConfig,
} from "./base";

/**
 * ElevenLabs Conversational AI Provider
 * Advanced AI voice agents with natural conversation
 */
export class ElevenLabsProvider extends BaseVoiceProvider {
	name = "elevenlabs";
	private apiKey: string;
	private baseUrl = "https://api.elevenlabs.io/v1";

	constructor(config: VoiceProviderConfig & { apiKey: string }) {
		super(config);
		this.apiKey = config.apiKey;
	}

	/**
	 * Create agent in ElevenLabs
	 */
	async initializeAgent(
		agent: typeof agentTable.$inferSelect,
		voiceConfig: AgentVoiceConfig,
	): Promise<string> {
		const response = await fetch(`${this.baseUrl}/convai/agents/create`, {
			method: "POST",
			headers: {
				"xi-api-key": this.apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: agent.name,
				conversation_config: {
					agent: {
						prompt: {
							prompt: agent.systemPrompt,
						},
						first_message:
							voiceConfig.greeting || "Hello! How can I help you today?",
						language: voiceConfig.language || "en",
					},
					tts: {
						voice_id: voiceConfig.voiceId || "21m00Tcm4TlvDq8ikWAM", // Default voice
						model_id: "eleven_turbo_v2",
						...(agent.temperature && {
							stability: agent.temperature / 100,
						}),
					},
				},
				platform_settings: {
					...(this.config.webhookUrl && {
						webhook_url: `${this.config.webhookUrl}/elevenlabs`,
					}),
				},
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to create ElevenLabs agent: ${error}`);
		}

		const data = await response.json();
		return data.agent_id;
	}

	/**
	 * Update ElevenLabs agent
	 */
	async updateAgent(
		providerAgentId: string,
		agent: typeof agentTable.$inferSelect,
		voiceConfig: AgentVoiceConfig,
	): Promise<void> {
		const response = await fetch(
			`${this.baseUrl}/convai/agents/${providerAgentId}`,
			{
				method: "PATCH",
				headers: {
					"xi-api-key": this.apiKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: agent.name,
					conversation_config: {
						agent: {
							prompt: {
								prompt: agent.systemPrompt,
							},
							first_message:
								voiceConfig.greeting || "Hello! How can I help you today?",
							language: voiceConfig.language || "en",
						},
						tts: {
							voice_id: voiceConfig.voiceId || "21m00Tcm4TlvDq8ikWAM",
							model_id: "eleven_turbo_v2",
							...(agent.temperature && {
								stability: agent.temperature / 100,
							}),
						},
					},
				}),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to update ElevenLabs agent: ${error}`);
		}
	}

	/**
	 * Delete ElevenLabs agent
	 */
	async deleteAgent(providerAgentId: string): Promise<void> {
		const response = await fetch(
			`${this.baseUrl}/convai/agents/${providerAgentId}`,
			{
				method: "DELETE",
				headers: {
					"xi-api-key": this.apiKey,
				},
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to delete ElevenLabs agent: ${error}`);
		}
	}

	/**
	 * Start an outbound call via ElevenLabs
	 */
	async startCall(
		providerAgentId: string,
		phoneNumber: string,
		metadata?: Record<string, unknown>,
	): Promise<CallSession> {
		const to = this.formatPhoneNumber(phoneNumber);

		const response = await fetch(
			`${this.baseUrl}/convai/conversation/start_phone_call`,
			{
				method: "POST",
				headers: {
					"xi-api-key": this.apiKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					agent_id: providerAgentId,
					phone_number: to,
					...(metadata && { metadata }),
				}),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to start ElevenLabs call: ${error}`);
		}

		const data = await response.json();

		return {
			sessionId: data.conversation_id,
			callId: data.conversation_id,
			status: "queued",
			from: "", // ElevenLabs handles the from number
			to,
			startedAt: new Date(),
		};
	}

	/**
	 * End an active call
	 */
	async endCall(sessionId: string): Promise<void> {
		const response = await fetch(
			`${this.baseUrl}/convai/conversation/${sessionId}/end`,
			{
				method: "POST",
				headers: {
					"xi-api-key": this.apiKey,
				},
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to end ElevenLabs call: ${error}`);
		}
	}

	/**
	 * Send event to active call
	 */
	async sendEvent(sessionId: string, event: CallEvent): Promise<void> {
		// ElevenLabs supports sending messages during conversation
		if (event.type === "agent_responded" && event.data?.message) {
			const response = await fetch(
				`${this.baseUrl}/convai/conversation/${sessionId}/agent_message`,
				{
					method: "POST",
					headers: {
						"xi-api-key": this.apiKey,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						message: event.data.message,
					}),
				},
			);

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Failed to send event: ${error}`);
			}
		}
	}

	/**
	 * Get transcript
	 */
	async getTranscript(sessionId: string): Promise<string> {
		const response = await fetch(
			`${this.baseUrl}/convai/conversation/${sessionId}`,
			{
				headers: {
					"xi-api-key": this.apiKey,
				},
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to get transcript: ${error}`);
		}

		const data = await response.json();
		const messages = data.transcript || [];

		return messages
			.map(
				(msg: { role: string; message: string }) =>
					`${msg.role}: ${msg.message}`,
			)
			.join("\n");
	}

	/**
	 * Get recording URL
	 */
	async getRecording(sessionId: string): Promise<string | null> {
		const response = await fetch(
			`${this.baseUrl}/convai/conversation/${sessionId}/recording`,
			{
				headers: {
					"xi-api-key": this.apiKey,
				},
			},
		);

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		return data.recording_url || null;
	}

	/**
	 * Handle ElevenLabs webhook
	 */
	async handleWebhook(
		payload: unknown,
		signature?: string,
	): Promise<{
		event: string;
		callId: string;
		data: Record<string, unknown>;
	}> {
		const data = payload as Record<string, unknown>;

		return {
			event: (data.type as string) || "unknown",
			callId: (data.conversation_id as string) || "",
			data: {
				agentId: data.agent_id,
				status: data.status,
				transcript: data.transcript,
				duration: data.duration,
				recordingUrl: data.recording_url,
			},
		};
	}

	/**
	 * Validate ElevenLabs webhook signature
	 */
	validateWebhookSignature(payload: unknown, signature: string): boolean {
		// ElevenLabs webhook validation
		// https://elevenlabs.io/docs/api-reference/webhooks
		const payloadString = JSON.stringify(payload);
		const hmac = crypto.createHmac("sha256", this.apiKey);
		hmac.update(payloadString);
		const calculatedSignature = hmac.digest("hex");

		return calculatedSignature === signature;
	}
}
