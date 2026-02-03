import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { formTable } from "@/lib/db/schema/tables";
import {
	getFormById,
	getFormBySlug,
	getFormStats,
	getFormSubmissions,
	listForms,
	updateConversionRate,
} from "@/lib/ember/forms/builder";
import {
	createFormSchema,
	getFormBySlugSchema,
	getFormSubmissionsSchema,
	listFormsSchema,
	updateFormSchema,
} from "@/schemas/form.schema";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

export const organizationFormRouter = createTRPCRouter({
	// List forms
	list: protectedOrganizationProcedure
		.input(listFormsSchema)
		.query(async ({ ctx, input }) => {
			return await listForms(ctx.organization.id, input);
		}),

	// Get form by ID
	get: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			// Verify form belongs to organization
			const formVerify = await db.query.formTable.findFirst({
				where: and(
					eq(formTable.id, input.id),
					eq(formTable.organizationId, ctx.organization.id),
				),
			});

			if (!formVerify) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			const form = await getFormById(input.id);

			if (!form) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			return form;
		}),

	// Get form by slug (internal - for preview)
	getBySlug: protectedOrganizationProcedure
		.input(getFormBySlugSchema)
		.query(async ({ ctx, input }) => {
			const form = await getFormBySlug(ctx.organization.id, input.slug);

			if (!form) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			return form;
		}),

	// Create form
	create: protectedOrganizationProcedure
		.input(createFormSchema)
		.mutation(async ({ ctx, input }) => {
			const { fields, settings, postSubmitConfig, ...data } = input;

			// Check if slug is already taken
			const existing = await db.query.formTable.findFirst({
				where: and(
					eq(formTable.organizationId, ctx.organization.id),
					eq(formTable.slug, input.slug),
				),
			});

			if (existing) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "A form with this slug already exists",
				});
			}

			const [form] = await db
				.insert(formTable)
				.values({
					...data,
					organizationId: ctx.organization.id,
					fields: JSON.stringify(fields),
					settings: settings ? JSON.stringify(settings) : null,
					postSubmitConfig: postSubmitConfig
						? JSON.stringify(postSubmitConfig)
						: null,
					views: 0,
					submissions: 0,
					conversionRate: 0,
				})
				.returning();

			return form;
		}),

	// Update form
	update: protectedOrganizationProcedure
		.input(updateFormSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, fields, settings, postSubmitConfig, ...data } = input;

			// Check if slug is taken by another form
			if (input.slug) {
				const existing = await db.query.formTable.findFirst({
					where: and(
						eq(formTable.organizationId, ctx.organization.id),
						eq(formTable.slug, input.slug),
					),
				});

				if (existing && existing.id !== id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "A form with this slug already exists",
					});
				}
			}

			const updateData = {
				...data,
				...(fields !== undefined && {
					fields: JSON.stringify(fields),
				}),
				...(settings !== undefined && {
					settings: JSON.stringify(settings),
				}),
				...(postSubmitConfig !== undefined && {
					postSubmitConfig: JSON.stringify(postSubmitConfig),
				}),
				updatedAt: new Date(),
			};

			const [updatedForm] = await db
				.update(formTable)
				.set(updateData)
				.where(
					and(
						eq(formTable.id, id),
						eq(formTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!updatedForm) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			return updatedForm;
		}),

	// Delete form
	delete: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [deletedForm] = await db
				.delete(formTable)
				.where(
					and(
						eq(formTable.id, input.id),
						eq(formTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!deletedForm) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			return { success: true };
		}),

	// Publish/unpublish form
	toggleActive: protectedOrganizationProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				active: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [form] = await db
				.update(formTable)
				.set({
					active: input.active,
					...(input.active && { publishedAt: new Date() }),
				})
				.where(
					and(
						eq(formTable.id, input.id),
						eq(formTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!form) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			return form;
		}),

	// Get form submissions
	getSubmissions: protectedOrganizationProcedure
		.input(getFormSubmissionsSchema)
		.query(async ({ ctx, input }) => {
			// Verify form belongs to organization
			const form = await db.query.formTable.findFirst({
				where: and(
					eq(formTable.id, input.formId),
					eq(formTable.organizationId, ctx.organization.id),
				),
			});

			if (!form) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			return await getFormSubmissions(input.formId, input.limit, input.offset);
		}),

	// Get form statistics
	getStats: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			// Verify form belongs to organization
			const form = await db.query.formTable.findFirst({
				where: and(
					eq(formTable.id, input.id),
					eq(formTable.organizationId, ctx.organization.id),
				),
			});

			if (!form) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			const stats = await getFormStats(input.id);

			if (!stats) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			return stats;
		}),

	// Recalculate conversion rate
	updateConversionRate: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Verify form belongs to organization
			const form = await db.query.formTable.findFirst({
				where: and(
					eq(formTable.id, input.id),
					eq(formTable.organizationId, ctx.organization.id),
				),
			});

			if (!form) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Form not found",
				});
			}

			await updateConversionRate(input.id);

			return { success: true };
		}),
});
