import crypto from "node:crypto";
import type {
	ChannelAdapter,
	ChannelConfig,
	NormalizedMessage,
} from "./manager";

/**
 * Instagram Messaging API Adapter
 * Uses Meta's Instagram Platform for Direct Messages
 */
export class InstagramAdapter implements ChannelAdapter {
	channelType = "instagram" as const;

	async normalizeIncoming(payload: unknown): Promise<NormalizedMessage> {
		const data = payload as {
			entry?: Array<{
				messaging?: Array<{
					sender: { id: string };
					recipient: { id: string };
					timestamp: number;
					message?: {
						mid: string;
						text?: string;
						attachments?: Array<{
							type: string;
							payload: { url: string };
						}>;
					};
				}>;
			}>;
		};

		const entry = data.entry?.[0];
		const messaging = entry?.messaging?.[0];
		const message = messaging?.message;

		if (!message) {
			throw new Error("No message in Instagram webhook");
		}

		let contentType: NormalizedMessage["contentType"] = "text";
		let content = message.text || "";
		let mediaUrl: string | undefined;

		// Handle attachments
		if (message.attachments && message.attachments.length > 0) {
			const attachment = message.attachments[0];
			if (attachment) {
				content = `[${attachment.type}]`;
				mediaUrl = attachment.payload.url;

				switch (attachment.type) {
					case "image":
						contentType = "image";
						break;
					case "video":
						contentType = "video";
						break;
					case "audio":
						contentType = "audio";
						break;
					default:
						contentType = "document";
				}
			}
		}

		return {
			id: "",
			conversationId: "",
			contactId: "",
			direction: "inbound",
			role: "user",
			content,
			contentType,
			channel: "instagram",
			externalId: message.mid,
			mediaUrl,
			metadata: {
				senderId: messaging?.sender.id,
				recipientId: messaging?.recipient.id,
				timestamp: messaging?.timestamp,
			},
		};
	}

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
			pageId: string;
		};

		if (!credentials.accessToken || !credentials.pageId) {
			throw new Error("Instagram credentials not configured");
		}

		const payload: Record<string, unknown> = {
			recipient: { id: to },
			message: {},
		};

		if (message.contentType === "text" || !message.contentType) {
			payload.message = { text: message.content };
		} else if (message.mediaUrl) {
			payload.message = {
				attachment: {
					type:
						message.contentType === "document" ? "file" : message.contentType,
					payload: { url: message.mediaUrl },
				},
			};
		}

		const response = await fetch(
			`https://graph.facebook.com/v18.0/${credentials.pageId}/messages`,
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
			throw new Error(`Failed to send Instagram message: ${error}`);
		}

		const data = await response.json();

		return {
			externalId: data.message_id,
			status: "sent",
		};
	}

	validateWebhook(payload: unknown, signature: string): boolean {
		const appSecret = process.env.INSTAGRAM_APP_SECRET || "";
		if (!appSecret) {
			throw new Error("INSTAGRAM_APP_SECRET not configured");
		}

		const payloadString = JSON.stringify(payload);
		const hmac = crypto.createHmac("sha256", appSecret);
		hmac.update(payloadString);
		const calculatedSignature = `sha256=${hmac.digest("hex")}`;

		return calculatedSignature === signature;
	}
}
