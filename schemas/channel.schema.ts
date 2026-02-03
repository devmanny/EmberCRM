import { z } from "zod";
import { ChannelType } from "@/lib/db/schema/enums";

// Channel configuration schemas
export const channelConfigSchema = z.object({
	channelType: z.enum([
		ChannelType.whatsapp,
		ChannelType.instagram,
		ChannelType.facebook,
		ChannelType.email,
		ChannelType.sms,
		ChannelType.calls,
		ChannelType.web,
	]),
	enabled: z.boolean().default(true),
	credentials: z.record(z.string(), z.unknown()),
	autoReply: z.boolean().default(false),
	businessHoursOnly: z.boolean().default(false),
});

export const updateChannelConfigSchema = channelConfigSchema.partial().extend({
	channelType: z.enum([
		ChannelType.whatsapp,
		ChannelType.instagram,
		ChannelType.facebook,
		ChannelType.email,
		ChannelType.sms,
		ChannelType.calls,
		ChannelType.web,
	]),
});

export const getChannelConfigSchema = z.object({
	channelType: z.enum([
		ChannelType.whatsapp,
		ChannelType.instagram,
		ChannelType.facebook,
		ChannelType.email,
		ChannelType.sms,
		ChannelType.calls,
		ChannelType.web,
	]),
});

export const testChannelSchema = z.object({
	channelType: z.enum([
		ChannelType.whatsapp,
		ChannelType.instagram,
		ChannelType.facebook,
		ChannelType.email,
		ChannelType.sms,
		ChannelType.calls,
		ChannelType.web,
	]),
});

// Send message schema
export const sendMessageSchema = z.object({
	conversationId: z.string().uuid(),
	content: z.string().min(1, "Message content is required"),
	contentType: z
		.enum(["text", "image", "audio", "video", "document"])
		.default("text"),
	mediaUrl: z.string().url().optional(),
});

// Export types
export type ChannelConfigInput = z.infer<typeof channelConfigSchema>;
export type UpdateChannelConfigInput = z.infer<
	typeof updateChannelConfigSchema
>;
export type GetChannelConfigInput = z.infer<typeof getChannelConfigSchema>;
export type TestChannelInput = z.infer<typeof testChannelSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
