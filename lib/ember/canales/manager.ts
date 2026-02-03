import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ChannelType } from "@/lib/db/schema/enums";
import {
	channelConfigTable,
	contactTable,
	conversationMessageTable,
	conversationTable,
} from "@/lib/db/schema/tables";

/**
 * Normalized message format for all channels
 */
export interface NormalizedMessage {
	id: string;
	conversationId: string;
	contactId: string;
	direction: "inbound" | "outbound";
	role: "user" | "assistant" | "system" | "human_agent";
	content: string;
	contentType: "text" | "image" | "audio" | "video" | "document";
	channel: ChannelType;
	externalId?: string;
	mediaUrl?: string;
	mediaMimeType?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Channel configuration
 */
export interface ChannelConfig {
	id: string;
	organizationId: string;
	channelType: ChannelType;
	enabled: boolean;
	credentials: Record<string, unknown>;
	autoReply: boolean;
	businessHoursOnly: boolean;
}

/**
 * Channel adapter interface
 */
export interface ChannelAdapter {
	channelType: ChannelType;

	/**
	 * Normalize incoming message from channel-specific format
	 */
	normalizeIncoming(payload: unknown): Promise<NormalizedMessage>;

	/**
	 * Send message through this channel
	 */
	sendMessage(
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
	}>;

	/**
	 * Validate webhook signature
	 */
	validateWebhook(payload: unknown, signature: string): boolean;
}

/**
 * Channel Manager - Orchestrates multi-channel communication
 */
export class ChannelManager {
	private adapters: Map<ChannelType, ChannelAdapter> = new Map();

	/**
	 * Register a channel adapter
	 */
	registerAdapter(adapter: ChannelAdapter): void {
		this.adapters.set(adapter.channelType, adapter);
	}

	/**
	 * Get adapter for a channel
	 */
	getAdapter(channelType: ChannelType): ChannelAdapter | undefined {
		return this.adapters.get(channelType);
	}

	/**
	 * Get channel configuration for organization
	 */
	async getChannelConfig(
		organizationId: string,
		channelType: ChannelType,
	): Promise<ChannelConfig | null> {
		const config = await db.query.channelConfigTable.findFirst({
			where: and(
				eq(channelConfigTable.organizationId, organizationId),
				eq(channelConfigTable.channelType, channelType),
			),
		});

		if (!config) {
			return null;
		}

		return {
			...config,
			credentials: config.credentials ? JSON.parse(config.credentials) : {},
		};
	}

	/**
	 * Process incoming message from any channel
	 */
	async processIncomingMessage(
		organizationId: string,
		channelType: ChannelType,
		payload: unknown,
	): Promise<NormalizedMessage> {
		const adapter = this.getAdapter(channelType);
		if (!adapter) {
			throw new Error(`No adapter registered for channel: ${channelType}`);
		}

		// Normalize the message
		const normalizedMessage = await adapter.normalizeIncoming(payload);

		// Save to database
		const savedMessages = await db
			.insert(conversationMessageTable)
			.values({
				conversationId: normalizedMessage.conversationId,
				direction: normalizedMessage.direction,
				role: normalizedMessage.role,
				content: normalizedMessage.content,
				contentType: normalizedMessage.contentType,
				channel: normalizedMessage.channel,
				externalId: normalizedMessage.externalId,
				mediaUrl: normalizedMessage.mediaUrl,
				mediaMimeType: normalizedMessage.mediaMimeType,
				generatedByAi: false,
				deliveryStatus: "received",
			} as unknown as typeof conversationMessageTable.$inferInsert)
			.returning();

		const savedMessage = (
			savedMessages as (typeof conversationMessageTable.$inferSelect)[]
		)[0];

		if (!savedMessage) {
			throw new Error("Failed to save message");
		}

		return {
			...normalizedMessage,
			id: savedMessage.id,
		};
	}

	/**
	 * Send message through a channel
	 */
	async sendMessage(
		conversationId: string,
		message: {
			content: string;
			contentType?: "text" | "image" | "audio" | "video" | "document";
			mediaUrl?: string;
			generatedByAi?: boolean;
			creditsUsed?: number;
			model?: string;
			sentById?: string;
		},
	): Promise<void> {
		// Get conversation to determine channel and recipient
		const conversation = await db.query.conversationTable.findFirst({
			where: eq(conversationTable.id, conversationId),
			with: {
				contact: true,
			},
		});

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const contact = conversation.contact;
		if (!contact || Array.isArray(contact)) {
			throw new Error("Contact not found");
		}

		// Get channel config
		const config = await this.getChannelConfig(
			conversation.organizationId,
			conversation.channel,
		);

		if (!config || !config.enabled) {
			throw new Error(
				`Channel ${conversation.channel} is not configured or disabled`,
			);
		}

		// Get adapter
		const adapter = this.getAdapter(conversation.channel);
		if (!adapter) {
			throw new Error(`No adapter for channel: ${conversation.channel}`);
		}

		// Determine recipient identifier based on channel
		let recipient = "";
		switch (conversation.channel) {
			case "whatsapp":
			case "sms":
			case "calls":
				recipient = ("phone" in contact ? contact.phone : "") || "";
				break;
			case "email":
				recipient = ("email" in contact ? contact.email : "") || "";
				break;
			case "instagram":
			case "facebook":
				// Would need to get social media identifier from contact metadata
				recipient = ("externalId" in contact ? contact.externalId : "") || "";
				break;
			default:
				throw new Error(`Unsupported channel: ${conversation.channel}`);
		}

		if (!recipient) {
			throw new Error(
				`No recipient identifier for channel ${conversation.channel}`,
			);
		}

		// Send through adapter
		const result = await adapter.sendMessage(config, recipient, {
			content: message.content,
			contentType: message.contentType,
			mediaUrl: message.mediaUrl,
		});

		// Save to database
		await db.insert(conversationMessageTable).values({
			conversationId,
			direction: "outbound",
			role: message.sentById ? "human_agent" : "assistant",
			content: message.content,
			contentType: message.contentType || "text",
			channel: conversation.channel,
			externalId: result.externalId,
			mediaUrl: message.mediaUrl,
			generatedByAi: message.generatedByAi ?? false,
			model: message.model,
			creditsUsed: message.creditsUsed ?? 0,
			deliveryStatus: result.status,
			sentById: message.sentById,
		} as unknown as typeof conversationMessageTable.$inferInsert);

		// Update conversation last message timestamp
		await db
			.update(conversationTable)
			.set({
				lastMessageAt: new Date(),
				messageCount: db.$count(
					conversationMessageTable,
					eq(conversationMessageTable.conversationId, conversationId),
				),
			})
			.where(eq(conversationTable.id, conversationId));
	}

	/**
	 * Update channel configuration
	 */
	async updateChannelConfig(
		organizationId: string,
		channelType: ChannelType,
		updates: {
			enabled?: boolean;
			credentials?: Record<string, unknown>;
			autoReply?: boolean;
			businessHoursOnly?: boolean;
		},
	): Promise<void> {
		const existing = await db.query.channelConfigTable.findFirst({
			where: and(
				eq(channelConfigTable.organizationId, organizationId),
				eq(channelConfigTable.channelType, channelType),
			),
		});

		if (existing) {
			// Update existing
			await db
				.update(channelConfigTable)
				.set({
					...updates,
					credentials: updates.credentials
						? JSON.stringify(updates.credentials)
						: undefined,
					updatedAt: new Date(),
				})
				.where(eq(channelConfigTable.id, existing.id));
		} else {
			// Create new
			await db.insert(channelConfigTable).values({
				organizationId,
				channelType,
				enabled: updates.enabled ?? true,
				credentials: updates.credentials
					? JSON.stringify(updates.credentials)
					: null,
				autoReply: updates.autoReply ?? false,
				businessHoursOnly: updates.businessHoursOnly ?? false,
			});
		}
	}

	/**
	 * Test channel connection
	 */
	async testChannelConnection(
		organizationId: string,
		channelType: ChannelType,
	): Promise<{ success: boolean; message: string }> {
		const config = await this.getChannelConfig(organizationId, channelType);

		if (!config || !config.enabled) {
			return {
				success: false,
				message: "Channel not configured or disabled",
			};
		}

		const adapter = this.getAdapter(channelType);
		if (!adapter) {
			return {
				success: false,
				message: "No adapter available for this channel",
			};
		}

		// TODO: Implement actual connection test per adapter
		return {
			success: true,
			message: "Channel connection test not yet implemented",
		};
	}
}

// Export singleton instance
export const channelManager = new ChannelManager();
