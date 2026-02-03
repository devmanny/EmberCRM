import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
	contactAgreementTable,
	contactNoteTable,
	contactTable,
} from "@/lib/db/schema/tables";
import {
	detectDuplicateContacts,
	mergeContacts,
} from "@/lib/ember/memoria/merger";
import {
	findOrCreateContact,
	getContactProfile,
	getContactStats,
	getContactTimeline,
	listContacts,
} from "@/lib/ember/memoria/queries";
import {
	getHeatScoreDistribution,
	recalculateHeatScore,
} from "@/lib/ember/memoria/scoring";
import {
	createContactAgreementSchema,
	createContactNoteSchema,
	createContactSchema,
	detectDuplicatesSchema,
	listContactsSchema,
	mergeContactsSchema,
	updateContactAgreementSchema,
	updateContactNoteSchema,
	updateContactSchema,
} from "@/schemas/contact.schema";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

export const organizationContactRouter = createTRPCRouter({
	// List contacts with filters and pagination
	list: protectedOrganizationProcedure
		.input(listContactsSchema)
		.query(async ({ ctx, input }) => {
			return await listContacts(ctx.organization.id, input);
		}),

	// Get single contact with full profile
	get: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			// First verify contact belongs to organization
			const contactVerify = await db.query.contactTable.findFirst({
				where: and(
					eq(contactTable.id, input.id),
					eq(contactTable.organizationId, ctx.organization.id),
				),
			});

			if (!contactVerify) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Contact not found",
				});
			}

			const contact = await getContactProfile(input.id);

			if (!contact) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Contact not found",
				});
			}

			return contact;
		}),

	// Create new contact
	create: protectedOrganizationProcedure
		.input(createContactSchema)
		.mutation(async ({ ctx, input }) => {
			const { sourceType, sourceIdentifier, sourceMetadata, ...contactData } =
				input;

			// Use findOrCreateContact to handle duplicates automatically
			const contact = await findOrCreateContact(ctx.organization.id, {
				...contactData,
				sourceType,
				sourceIdentifier,
				sourceMetadata,
			});

			return contact;
		}),

	// Update contact
	update: protectedOrganizationProcedure
		.input(updateContactSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, tags, customFields, ...data } = input;

			// Prepare update data
			const updateData = {
				...data,
				...(tags !== undefined && { tags: JSON.stringify(tags) }),
				...(customFields !== undefined && {
					customFields: JSON.stringify(customFields),
				}),
				updatedAt: new Date(),
			};

			// Atomic update with organization check
			const [updatedContact] = await db
				.update(contactTable)
				.set(updateData)
				.where(
					and(
						eq(contactTable.id, id),
						eq(contactTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!updatedContact) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Contact not found",
				});
			}

			return updatedContact;
		}),

	// Delete contact
	delete: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Atomic delete with organization check
			const deletedContacts = await db
				.delete(contactTable)
				.where(
					and(
						eq(contactTable.id, input.id),
						eq(contactTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			const deletedContact = (
				deletedContacts as (typeof contactTable.$inferSelect)[]
			)[0];
			if (!deletedContact) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Contact not found",
				});
			}

			return { success: true };
		}),

	// Get contact timeline
	timeline: protectedOrganizationProcedure
		.input(
			z.object({
				contactId: z.string().uuid(),
				limit: z.number().min(1).max(200).default(50),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify contact belongs to organization
			const contact = await db.query.contactTable.findFirst({
				where: and(
					eq(contactTable.id, input.contactId),
					eq(contactTable.organizationId, ctx.organization.id),
				),
			});

			if (!contact) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Contact not found",
				});
			}

			return await getContactTimeline(input.contactId, input.limit);
		}),

	// Detect duplicate contacts
	detectDuplicates: protectedOrganizationProcedure
		.input(detectDuplicatesSchema)
		.query(async ({ ctx, input }) => {
			return await detectDuplicateContacts(
				ctx.organization.id,
				input,
				input.threshold,
			);
		}),

	// Merge contacts
	merge: protectedOrganizationProcedure
		.input(mergeContactsSchema)
		.mutation(async ({ ctx, input }) => {
			// Verify all contacts belong to organization
			const allContactIds = [input.primaryId, ...input.duplicateIds];
			const contacts = await db.query.contactTable.findMany({
				where: eq(contactTable.organizationId, ctx.organization.id),
				columns: { id: true },
			});

			const orgContactIds = new Set(contacts.map((c) => c.id));
			const unauthorized = allContactIds.filter((id) => !orgContactIds.has(id));

			if (unauthorized.length > 0) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Some contacts don't belong to your organization",
				});
			}

			return await mergeContacts(input.primaryId, input.duplicateIds);
		}),

	// Recalculate heat score for a contact
	recalculateHeatScore: protectedOrganizationProcedure
		.input(z.object({ contactId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Verify contact belongs to organization
			const contact = await db.query.contactTable.findFirst({
				where: and(
					eq(contactTable.id, input.contactId),
					eq(contactTable.organizationId, ctx.organization.id),
				),
			});

			if (!contact) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Contact not found",
				});
			}

			const heatScore = await recalculateHeatScore(input.contactId);
			return { heatScore };
		}),

	// Get contact statistics
	stats: protectedOrganizationProcedure.query(async ({ ctx }) => {
		return await getContactStats(ctx.organization.id);
	}),

	// Get heat score distribution
	heatScoreDistribution: protectedOrganizationProcedure.query(
		async ({ ctx }) => {
			return await getHeatScoreDistribution(ctx.organization.id);
		},
	),

	// ========== Contact Notes ==========

	// Create contact note
	createNote: protectedOrganizationProcedure
		.input(createContactNoteSchema)
		.mutation(async ({ ctx, input }) => {
			// Verify contact belongs to organization
			const contact = await db.query.contactTable.findFirst({
				where: and(
					eq(contactTable.id, input.contactId),
					eq(contactTable.organizationId, ctx.organization.id),
				),
			});

			if (!contact) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Contact not found",
				});
			}

			const [note] = await db
				.insert(contactNoteTable)
				.values({
					...input,
					organizationId: ctx.organization.id,
					createdById: ctx.user.id,
				})
				.returning();

			return note;
		}),

	// Update contact note
	updateNote: protectedOrganizationProcedure
		.input(updateContactNoteSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;

			// Atomic update with organization check
			const [updatedNote] = await db
				.update(contactNoteTable)
				.set(data)
				.where(
					and(
						eq(contactNoteTable.id, id),
						eq(contactNoteTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!updatedNote) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Note not found",
				});
			}

			return updatedNote;
		}),

	// Delete contact note
	deleteNote: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Atomic delete with organization check
			const [deletedNote] = await db
				.delete(contactNoteTable)
				.where(
					and(
						eq(contactNoteTable.id, input.id),
						eq(contactNoteTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!deletedNote) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Note not found",
				});
			}

			return { success: true };
		}),

	// ========== Contact Agreements ==========

	// Create contact agreement
	createAgreement: protectedOrganizationProcedure
		.input(createContactAgreementSchema)
		.mutation(async ({ ctx, input }) => {
			// Verify contact belongs to organization
			const contact = await db.query.contactTable.findFirst({
				where: and(
					eq(contactTable.id, input.contactId),
					eq(contactTable.organizationId, ctx.organization.id),
				),
			});

			if (!contact) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Contact not found",
				});
			}

			const [agreement] = await db
				.insert(contactAgreementTable)
				.values({
					...input,
					organizationId: ctx.organization.id,
					details: JSON.stringify(input.details),
				})
				.returning();

			return agreement;
		}),

	// Update contact agreement
	updateAgreement: protectedOrganizationProcedure
		.input(updateContactAgreementSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, details, ...data } = input;

			const updateData = {
				...data,
				...(details !== undefined && { details: JSON.stringify(details) }),
			};

			// Atomic update with organization check
			const [updatedAgreement] = await db
				.update(contactAgreementTable)
				.set(updateData)
				.where(
					and(
						eq(contactAgreementTable.id, id),
						eq(contactAgreementTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!updatedAgreement) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agreement not found",
				});
			}

			return updatedAgreement;
		}),

	// Delete contact agreement
	deleteAgreement: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Atomic delete with organization check
			const [deletedAgreement] = await db
				.delete(contactAgreementTable)
				.where(
					and(
						eq(contactAgreementTable.id, input.id),
						eq(contactAgreementTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!deletedAgreement) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agreement not found",
				});
			}

			return { success: true };
		}),
});
