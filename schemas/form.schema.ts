import { z } from "zod";
import { ContactSourceType } from "@/lib/db/schema/enums";

// Form field schema
export const formFieldSchema = z.object({
	id: z.string(),
	type: z.enum([
		"text",
		"email",
		"phone",
		"select",
		"radio",
		"checkbox",
		"textarea",
		"date",
		"number",
	]),
	label: z.string(),
	placeholder: z.string().optional(),
	required: z.boolean().default(false),
	validation: z.string().optional(), // Validation rules
	options: z.array(z.string()).optional(), // For select, radio, checkbox
	defaultValue: z.unknown().optional(),
	conditionalLogic: z
		.object({
			show: z.boolean(),
			when: z.string(), // field ID
			operator: z.enum(["equals", "not_equals", "contains"]),
			value: z.unknown(),
		})
		.optional(),
});

// Form settings schema
export const formSettingsSchema = z.object({
	theme: z
		.object({
			primaryColor: z.string().default("#000000"),
			fontFamily: z.string().default("sans-serif"),
			borderRadius: z.string().default("8px"),
		})
		.default({
			primaryColor: "#000000",
			fontFamily: "sans-serif",
			borderRadius: "8px",
		}),
	submitButton: z
		.object({
			text: z.string().default("Submit"),
			loadingText: z.string().default("Submitting..."),
		})
		.default({
			text: "Submit",
			loadingText: "Submitting...",
		}),
	postSubmit: z
		.object({
			action: z
				.enum(["message", "redirect", "conversation"])
				.default("message"),
			message: z.string().optional(),
			redirectUrl: z.string().url().optional(),
			startConversation: z.boolean().default(false),
		})
		.default({
			action: "message" as const,
			startConversation: false,
		}),
	tracking: z
		.object({
			googleAnalytics: z.string().optional(),
			facebookPixel: z.string().optional(),
		})
		.optional(),
});

// Create form schema
export const createFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(200),
	description: z.string().max(1000).optional().nullable(),
	slug: z
		.string()
		.min(1, "Slug is required")
		.max(100)
		.regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
	fields: z.array(formFieldSchema).min(1, "At least one field is required"),
	settings: formSettingsSchema.optional(),
	webhookUrl: z.string().url().optional().nullable(),
	emailNotification: z.string().email().optional().nullable(),
	postSubmitAction: z
		.enum(["show_message", "redirect", "start_conversation"])
		.default("show_message"),
	postSubmitConfig: z.record(z.string(), z.unknown()).optional().nullable(),
	assignToAgentId: z.string().uuid().optional().nullable(),
	active: z.boolean().default(true),
});

// Update form schema
export const updateFormSchema = createFormSchema.partial().extend({
	id: z.string().uuid(),
});

// List forms schema
export const listFormsSchema = z.object({
	limit: z.number().min(1).max(100).default(25),
	offset: z.number().min(0).default(0),
	search: z.string().optional(),
	active: z.boolean().optional(),
	orderBy: z.enum(["createdAt", "name", "submissions"]).default("createdAt"),
	orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

// Form submission schema
export const formSubmissionSchema = z.object({
	formId: z.string().uuid(),
	data: z.record(z.string(), z.unknown()),
	metadata: z
		.object({
			ip: z.string().optional(),
			userAgent: z.string().optional(),
			referrer: z.string().optional(),
			utmParams: z.record(z.string(), z.string()).optional(),
		})
		.optional(),
});

// Get form by slug schema (public)
export const getFormBySlugSchema = z.object({
	slug: z.string(),
});

// Get form submissions schema
export const getFormSubmissionsSchema = z.object({
	formId: z.string().uuid(),
	limit: z.number().min(1).max(100).default(25),
	offset: z.number().min(0).default(0),
});

// Export types
export type FormFieldInput = z.infer<typeof formFieldSchema>;
export type FormSettingsInput = z.infer<typeof formSettingsSchema>;
export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
export type ListFormsInput = z.infer<typeof listFormsSchema>;
export type FormSubmissionInput = z.infer<typeof formSubmissionSchema>;
export type GetFormBySlugInput = z.infer<typeof getFormBySlugSchema>;
export type GetFormSubmissionsInput = z.infer<typeof getFormSubmissionsSchema>;
