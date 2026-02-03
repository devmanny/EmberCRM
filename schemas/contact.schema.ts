import { z } from "zod";
import {
	ContactAgreementStatus,
	ContactAgreementType,
	ContactNoteType,
	ContactSourceType,
	ContactStatus,
} from "@/lib/db/schema/enums";

// Base contact schema
export const contactSchema = z.object({
	firstName: z.string().min(1, "First name is required").max(100),
	lastName: z.string().min(1, "Last name is required").max(100),
	email: z.string().email("Invalid email").optional().nullable(),
	phone: z.string().min(1, "Phone is required").max(20).optional().nullable(),
	company: z.string().max(200).optional().nullable(),
	timezone: z.string().optional().nullable(),
	language: z.string().default("es"),
	channelPreference: z.string().optional().nullable(),
	assignedToId: z.string().uuid().optional().nullable(),
	customFields: z.record(z.string(), z.unknown()).optional().nullable(),
	tags: z.array(z.string()).default([]),
	status: z
		.enum([
			ContactStatus.active,
			ContactStatus.inactive,
			ContactStatus.blocked,
			ContactStatus.merged,
		])
		.default(ContactStatus.active),
});

// Create contact schema
export const createContactSchema = contactSchema.extend({
	organizationId: z.string().uuid(),
	sourceType: z.enum([
		ContactSourceType.form,
		ContactSourceType.whatsapp,
		ContactSourceType.instagram,
		ContactSourceType.facebook,
		ContactSourceType.phone,
		ContactSourceType.email,
		ContactSourceType.manual,
		ContactSourceType.api,
	]),
	sourceIdentifier: z.string().optional().nullable(),
	sourceMetadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

// Update contact schema
export const updateContactSchema = contactSchema.partial().extend({
	id: z.string().uuid(),
});

// List contacts filters schema
export const listContactsSchema = z.object({
	limit: z.number().min(1).max(100).default(25),
	offset: z.number().min(0).default(0),
	search: z.string().optional(),
	status: z
		.enum([
			ContactStatus.active,
			ContactStatus.inactive,
			ContactStatus.blocked,
			ContactStatus.merged,
		])
		.optional(),
	assignedToId: z.string().uuid().optional(),
	minHeatScore: z.number().min(0).max(100).optional(),
	maxHeatScore: z.number().min(0).max(100).optional(),
	tags: z.array(z.string()).optional(),
	sourceType: z
		.enum([
			ContactSourceType.form,
			ContactSourceType.whatsapp,
			ContactSourceType.instagram,
			ContactSourceType.facebook,
			ContactSourceType.phone,
			ContactSourceType.email,
			ContactSourceType.manual,
			ContactSourceType.api,
		])
		.optional(),
	orderBy: z
		.enum(["heatScore", "lastInteractionAt", "createdAt", "firstName"])
		.default("lastInteractionAt"),
	orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

// Merge contacts schema
export const mergeContactsSchema = z.object({
	primaryId: z.string().uuid(),
	duplicateIds: z
		.array(z.string().uuid())
		.min(1, "At least one duplicate required"),
});

// Detect duplicates schema
export const detectDuplicatesSchema = z.object({
	email: z.string().email().optional(),
	phone: z.string().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	threshold: z.number().min(0).max(1).default(0.7),
});

// Contact note schema
export const createContactNoteSchema = z.object({
	contactId: z.string().uuid(),
	content: z.string().min(1, "Note content is required"),
	type: z
		.enum([
			ContactNoteType.general,
			ContactNoteType.important,
			ContactNoteType.followUp,
		])
		.default(ContactNoteType.general),
	isPinned: z.boolean().default(false),
});

export const updateContactNoteSchema = z.object({
	id: z.string().uuid(),
	content: z.string().min(1).optional(),
	type: z
		.enum([
			ContactNoteType.general,
			ContactNoteType.important,
			ContactNoteType.followUp,
		])
		.optional(),
	isPinned: z.boolean().optional(),
});

// Contact agreement schema
export const createContactAgreementSchema = z.object({
	contactId: z.string().uuid(),
	conversationId: z.string().uuid().optional().nullable(),
	type: z.enum([
		ContactAgreementType.paymentPlan,
		ContactAgreementType.deliveryDate,
		ContactAgreementType.priceAgreement,
		ContactAgreementType.custom,
	]),
	description: z.string().min(1, "Description is required"),
	details: z.record(z.string(), z.unknown()),
	status: z
		.enum([
			ContactAgreementStatus.active,
			ContactAgreementStatus.completed,
			ContactAgreementStatus.cancelled,
		])
		.default(ContactAgreementStatus.active),
});

export const updateContactAgreementSchema = z.object({
	id: z.string().uuid(),
	description: z.string().optional(),
	details: z.record(z.string(), z.unknown()).optional(),
	status: z
		.enum([
			ContactAgreementStatus.active,
			ContactAgreementStatus.completed,
			ContactAgreementStatus.cancelled,
		])
		.optional(),
});

// Export types
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ListContactsInput = z.infer<typeof listContactsSchema>;
export type MergeContactsInput = z.infer<typeof mergeContactsSchema>;
export type DetectDuplicatesInput = z.infer<typeof detectDuplicatesSchema>;
export type CreateContactNoteInput = z.infer<typeof createContactNoteSchema>;
export type UpdateContactNoteInput = z.infer<typeof updateContactNoteSchema>;
export type CreateContactAgreementInput = z.infer<
	typeof createContactAgreementSchema
>;
export type UpdateContactAgreementInput = z.infer<
	typeof updateContactAgreementSchema
>;
