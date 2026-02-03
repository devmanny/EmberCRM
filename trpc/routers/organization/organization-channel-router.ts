import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channelConfigTable } from "@/lib/db/schema/tables";
import { channelManager } from "@/lib/ember/canales/manager";
import {
	getChannelConfigSchema,
	sendMessageSchema,
	testChannelSchema,
	updateChannelConfigSchema,
} from "@/schemas/channel.schema";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

export const organizationChannelRouter = createTRPCRouter({
	// List all channel configurations for organization
	list: protectedOrganizationProcedure.query(async ({ ctx }) => {
		const configs = await db.query.channelConfigTable.findMany({
			where: eq(channelConfigTable.organizationId, ctx.organization.id),
		});

		return configs.map((config) => ({
			...config,
			credentials: config.credentials ? JSON.parse(config.credentials) : {},
		}));
	}),

	// Get specific channel configuration
	get: protectedOrganizationProcedure
		.input(getChannelConfigSchema)
		.query(async ({ ctx, input }) => {
			const config = await channelManager.getChannelConfig(
				ctx.organization.id,
				input.channelType,
			);

			if (!config) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Channel configuration not found",
				});
			}

			return config;
		}),

	// Update channel configuration
	update: protectedOrganizationProcedure
		.input(updateChannelConfigSchema)
		.mutation(async ({ ctx, input }) => {
			const { channelType, ...updates } = input;

			await channelManager.updateChannelConfig(
				ctx.organization.id,
				channelType,
				updates,
			);

			return { success: true };
		}),

	// Test channel connection
	test: protectedOrganizationProcedure
		.input(testChannelSchema)
		.mutation(async ({ ctx, input }) => {
			const result = await channelManager.testChannelConnection(
				ctx.organization.id,
				input.channelType,
			);

			return result;
		}),

	// Send message through channel manager
	sendMessage: protectedOrganizationProcedure
		.input(sendMessageSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				await channelManager.sendMessage(input.conversationId, {
					content: input.content,
					contentType: input.contentType,
					mediaUrl: input.mediaUrl,
					sentById: ctx.user.id,
				});

				return { success: true };
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						error instanceof Error ? error.message : "Failed to send message",
				});
			}
		}),
});
