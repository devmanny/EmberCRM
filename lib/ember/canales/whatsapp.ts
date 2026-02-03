import crypto from "node:crypto";
import type {
	ChannelAdapter,
	ChannelConfig,
	NormalizedMessage,
} from "./manager";

/**
 * WhatsApp Business API Adapter
 * Uses Meta's WhatsApp Business Platform
 */
export class WhatsAppAdapter implements ChannelAdapter {
	channelType = "whatsapp" as const;

	/**
	 * Normalize incoming WhatsApp webhook
	 */
	async normalizeIncoming(payload: unknown): Promise<NormalizedMessage> {
		const data = payload as {
			entry?: Array<{
				changes?: Array<{
					value?: {
						messages?: Array<{
							id: string;
							from: string;
							timestamp: string;
							type: string;
							text?: { body: string };
							image?: { id: string; mime_type: string };
							audio?: { id: string; mime_type: string };
							video?: { id: string; mime_type: string };
							document?: { id: string; filename: string; mime_type: string };
						}>;
						metadata?: {
							phone_number_id: string;
						};
					};
				}>;
			}>;
		};

		const entry = data.entry?.[0];
		const change = entry?.changes?.[0];
		const value = change?.value;
		const message = value?.messages?.[0];

		if (!message) {
			throw new Error("No message in WhatsApp webhook");
		}

		// Determine content type and extract content
		let contentType: NormalizedMessage["contentType"] = "text";
		let content = "";
		let mediaUrl: string | undefined;
		let mediaMimeType: string | undefined;

		switch (message.type) {
			case "text":
				content = message.text?.body || "";
				break;
			case "image":
				contentType = "image";
				content = "[Image]";
				mediaUrl = message.image?.id;
				mediaMimeType = message.image?.mime_type;
				break;
			case "audio":
				contentType = "audio";
				content = "[Audio]";
				mediaUrl = message.audio?.id;
				mediaMimeType = message.audio?.mime_type;
				break;
			case "video":
				contentType = "video";
				content = "[Video]";
				mediaUrl = message.video?.id;
				mediaMimeType = message.video?.mime_type;
				break;
			case "document":
				contentType = "document";
				content = `[Document: ${message.document?.filename || "file"}]`;
				mediaUrl = message.document?.id;
				mediaMimeType = message.document?.mime_type;
				break;
			default:
				content = "[Unsupported message type]";
		}

		return {
			id: "", // Will be set when saved to DB
			conversationId: "", // Will be determined by conversation manager
			contactId: "", // Will be determined by contact lookup
			direction: "inbound",
			role: "user",
			content,
			contentType,
			channel: "whatsapp",
			externalId: message.id,
			mediaUrl,
			mediaMimeType,
			metadata: {
				from: message.from,
				timestamp: message.timestamp,
				phoneNumberId: value?.metadata?.phone_number_id,
			},
		};
	}

	/**
	 * Send message via WhatsApp
	 */
	async sendMessage(
		config: ChannelConfig,
		to: string,
		message: {
			content: string;
			contentType?: "text" | "image" | "audio" | "video" | "document";
			mediaUrl?: string;
		},
	): Promise<{
		externalId: string;
		status: string;
	}> {
		const credentials = config.credentials as {
			accessToken: string;
			phoneNumberId: string;
		};

		if (!credentials.accessToken || !credentials.phoneNumberId) {
			throw new Error("WhatsApp credentials not configured");
		}

		// Build message payload based on content type
		const payload: Record<string, unknown> = {
			messaging_product: "whatsapp",
			recipient_type: "individual",
			to,
		};

		if (message.contentType === "text" || !message.contentType) {
			payload.type = "text";
			payload.text = { body: message.content };
		} else if (message.mediaUrl) {
			payload.type = message.contentType;
			payload[message.contentType] = {
				link: message.mediaUrl,
				...(message.contentType === "document" && {
					filename: "document",
				}),
			};
		}

		const response = await fetch(
			`https://graph.facebook.com/v18.0/${credentials.phoneNumberId}/messages`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${credentials.accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send WhatsApp message: ${error}`);
		}

		const data = await response.json();

		return {
			externalId: data.messages[0].id,
			status: "sent",
		};
	}

	/**
	 * Validate WhatsApp webhook signature
	 */
	validateWebhook(payload: unknown, signature: string): boolean {
		const appSecret = process.env.WHATSAPP_APP_SECRET || "";
		if (!appSecret) {
			throw new Error("WHATSAPP_APP_SECRET not configured");
		}

		const payloadString = JSON.stringify(payload);
		const hmac = crypto.createHmac("sha256", appSecret);
		hmac.update(payloadString);
		const calculatedSignature = `sha256=${hmac.digest("hex")}`;

		return calculatedSignature === signature;
	}

	/**
	 * Download WhatsApp media
	 */
	async downloadMedia(
		mediaId: string,
		accessToken: string,
	): Promise<{ url: string; mimeType: string }> {
		// First, get media URL
		const response = await fetch(
			`https://graph.facebook.com/v18.0/${mediaId}`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			},
		);

		if (!response.ok) {
			throw new Error("Failed to get media URL");
		}

		const data = await response.json();
		return {
			url: data.url,
			mimeType: data.mime_type,
		};
	}
}
