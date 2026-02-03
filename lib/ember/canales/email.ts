import crypto from "node:crypto";
import { sendEmail } from "@/lib/email";
import type {
	ChannelAdapter,
	ChannelConfig,
	NormalizedMessage,
} from "./manager";

/**
 * Email Adapter using existing Resend integration
 */
export class EmailAdapter implements ChannelAdapter {
	channelType = "email" as const;

	async normalizeIncoming(payload: unknown): Promise<NormalizedMessage> {
		const data = payload as {
			id: string;
			from: string;
			to: string;
			subject: string;
			text?: string;
			html?: string;
			attachments?: Array<{
				filename: string;
				contentType: string;
				content: string;
			}>;
		};

		let content = data.text || data.html || "";

		// If HTML, strip tags for plain text content
		if (!data.text && data.html) {
			content = data.html.replace(/<[^>]*>/g, "");
		}

		return {
			id: "",
			conversationId: "",
			contactId: "",
			direction: "inbound",
			role: "user",
			content,
			contentType: "text",
			channel: "email",
			externalId: data.id,
			metadata: {
				from: data.from,
				to: data.to,
				subject: data.subject,
				hasAttachments: data.attachments && data.attachments.length > 0,
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
			fromEmail: string;
			fromName?: string;
			replyTo?: string;
		};

		if (!credentials.fromEmail) {
			throw new Error("Email credentials not configured");
		}

		// Use existing sendEmail utility
		const result = await sendEmail({
			recipient: to,
			subject: "Message from Ember CRM",
			text: message.content,
			html: this.formatEmailContent(message.content),
			replyTo: credentials.replyTo,
		});

		return {
			externalId: result.data?.id || "",
			status: "sent",
		};
	}

	validateWebhook(payload: unknown, signature: string): boolean {
		// Resend webhook validation
		const webhookSecret = process.env.RESEND_WEBHOOK_SECRET || "";
		if (!webhookSecret) {
			return true; // Skip validation if not configured
		}

		const payloadString = JSON.stringify(payload);
		const hmac = crypto.createHmac("sha256", webhookSecret);
		hmac.update(payloadString);
		const calculatedSignature = hmac.digest("hex");

		return calculatedSignature === signature;
	}

	/**
	 * Format message content as HTML email
	 */
	private formatEmailContent(content: string): string {
		// Simple HTML formatting
		const paragraphs = content
			.split("\n\n")
			.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
			.join("");

		return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    ${paragraphs}
  </div>
</body>
</html>
    `.trim();
	}
}
