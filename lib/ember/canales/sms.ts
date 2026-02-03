import crypto from "node:crypto";
import type {
	ChannelAdapter,
	ChannelConfig,
	NormalizedMessage,
} from "./manager";

/**
 * SMS Adapter using Twilio
 */
export class SMSAdapter implements ChannelAdapter {
	channelType = "sms" as const;

	async normalizeIncoming(payload: unknown): Promise<NormalizedMessage> {
		const data = payload as {
			MessageSid: string;
			From: string;
			To: string;
			Body: string;
			NumMedia?: string;
			MediaUrl0?: string;
			MediaContentType0?: string;
		};

		let contentType: NormalizedMessage["contentType"] = "text";
		let content = data.Body || "";
		let mediaUrl: string | undefined;
		let mediaMimeType: string | undefined;

		// Handle MMS media
		if (data.NumMedia && Number.parseInt(data.NumMedia) > 0) {
			mediaUrl = data.MediaUrl0;
			mediaMimeType = data.MediaContentType0;

			if (mediaMimeType?.startsWith("image/")) {
				contentType = "image";
				content = `[Image] ${content}`;
			} else if (mediaMimeType?.startsWith("video/")) {
				contentType = "video";
				content = `[Video] ${content}`;
			} else if (mediaMimeType?.startsWith("audio/")) {
				contentType = "audio";
				content = `[Audio] ${content}`;
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
			channel: "sms",
			externalId: data.MessageSid,
			mediaUrl,
			mediaMimeType,
			metadata: {
				from: data.From,
				to: data.To,
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
			accountSid: string;
			authToken: string;
			phoneNumber: string;
		};

		if (
			!credentials.accountSid ||
			!credentials.authToken ||
			!credentials.phoneNumber
		) {
			throw new Error("SMS credentials not configured");
		}

		const params = new URLSearchParams({
			To: to,
			From: credentials.phoneNumber,
			Body: message.content,
		});

		// Add media URL for MMS
		if (message.mediaUrl) {
			params.append("MediaUrl", message.mediaUrl);
		}

		const response = await fetch(
			`https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")}`,
				},
				body: params,
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send SMS: ${error}`);
		}

		const data = await response.json();

		return {
			externalId: data.sid,
			status: data.status,
		};
	}

	validateWebhook(payload: unknown, signature: string): boolean {
		const authToken = process.env.TWILIO_AUTH_TOKEN || "";
		if (!authToken) {
			throw new Error("TWILIO_AUTH_TOKEN not configured");
		}

		const data = payload as Record<string, string>;
		const url = process.env.TWILIO_WEBHOOK_URL || "";

		// Twilio signature validation
		const params = Object.keys(data)
			.sort()
			.map((key) => `${key}${data[key]}`)
			.join("");

		const hmac = crypto.createHmac("sha1", authToken);
		hmac.update(url + params);
		const calculatedSignature = hmac.digest("base64");

		return calculatedSignature === signature;
	}
}
