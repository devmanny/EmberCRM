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
 * Twilio Voice Provider
 * Basic phone call functionality using Twilio Voice API
 */
export class TwilioVoiceProvider extends BaseVoiceProvider {
	name = "twilio";
	private accountSid: string;
	private authToken: string;
	private phoneNumber: string;

	constructor(
		config: VoiceProviderConfig & {
			accountSid: string;
			authToken: string;
			phoneNumber: string;
		},
	) {
		super(config);
		this.accountSid = config.accountSid;
		this.authToken = config.authToken;
		this.phoneNumber = config.phoneNumber;
	}

	/**
	 * Twilio doesn't have "agents" - configuration is per-call
	 * We just store the agent reference
	 */
	async initializeAgent(
		agent: typeof agentTable.$inferSelect,
		voiceConfig: AgentVoiceConfig,
	): Promise<string> {
		// For Twilio, we don't create agents on their platform
		// Just return a reference ID
		return `twilio-agent-${agent.id}`;
	}

	async updateAgent(
		providerAgentId: string,
		agent: typeof agentTable.$inferSelect,
		voiceConfig: AgentVoiceConfig,
	): Promise<void> {
		// No-op for Twilio - configuration is per-call
	}

	async deleteAgent(providerAgentId: string): Promise<void> {
		// No-op for Twilio
	}

	/**
	 * Start an outbound call
	 */
	async startCall(
		providerAgentId: string,
		phoneNumber: string,
		metadata?: Record<string, unknown>,
	): Promise<CallSession> {
		const to = this.formatPhoneNumber(phoneNumber);
		const from = this.formatPhoneNumber(this.phoneNumber);

		const response = await fetch(
			`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
				},
				body: new URLSearchParams({
					To: to,
					From: from,
					Url: `${this.config.webhookUrl}/twilio/voice`,
					StatusCallback: `${this.config.webhookUrl}/twilio/status`,
					StatusCallbackMethod: "POST",
					...(metadata && {
						StatusCallbackEvent: "initiated ringing answered completed",
					}),
				}),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to start Twilio call: ${error}`);
		}

		const data = await response.json();

		return {
			sessionId: data.sid,
			callId: data.sid,
			status: data.status as CallSession["status"],
			from,
			to,
			startedAt: new Date(data.date_created),
		};
	}

	/**
	 * End an active call
	 */
	async endCall(sessionId: string): Promise<void> {
		const response = await fetch(
			`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${sessionId}.json`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
				},
				body: new URLSearchParams({
					Status: "completed",
				}),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to end Twilio call: ${error}`);
		}
	}

	/**
	 * Send event to active call (update TwiML)
	 */
	async sendEvent(sessionId: string, event: CallEvent): Promise<void> {
		// For Twilio, we'd need to update the call with new TwiML
		// This is limited - better to use ElevenLabs/Vapi for real-time interaction
		throw new Error("Real-time events not supported in basic Twilio Voice");
	}

	/**
	 * Get transcript
	 */
	async getTranscript(sessionId: string): Promise<string> {
		// Twilio Voice doesn't provide automatic transcription
		// Would need to use Twilio Programmable Voice + AI services
		throw new Error("Transcription not available in basic Twilio Voice");
	}

	/**
	 * Get recording URL
	 */
	async getRecording(sessionId: string): Promise<string | null> {
		const response = await fetch(
			`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${sessionId}/Recordings.json`,
			{
				headers: {
					Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
				},
			},
		);

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		const recordings = data.recordings;

		if (recordings && recordings.length > 0) {
			return `https://api.twilio.com${recordings[0].uri.replace(".json", ".mp3")}`;
		}

		return null;
	}

	/**
	 * Handle Twilio webhook
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
			event: (data.CallStatus as string) || "unknown",
			callId: (data.CallSid as string) || "",
			data: {
				from: data.From,
				to: data.To,
				status: data.CallStatus,
				duration: data.CallDuration,
				recordingUrl: data.RecordingUrl,
			},
		};
	}

	/**
	 * Validate Twilio webhook signature
	 */
	validateWebhookSignature(payload: unknown, signature: string): boolean {
		const data = payload as Record<string, string>;
		const url = this.config.webhookUrl || "";

		// Twilio signature validation
		// https://www.twilio.com/docs/usage/security#validating-requests
		const params = Object.keys(data)
			.sort()
			.map((key) => `${key}${data[key]}`)
			.join("");

		const hmac = crypto.createHmac("sha1", this.authToken);
		hmac.update(url + params);
		const calculatedSignature = hmac.digest("base64");

		return calculatedSignature === signature;
	}
}
