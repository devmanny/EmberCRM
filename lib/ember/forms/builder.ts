import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { formSubmissionTable, formTable } from "@/lib/db/schema/tables";
import type { ListFormsInput } from "@/schemas/form.schema";

/**
 * Form field validation
 */
export function validateField(
	value: unknown,
	field: {
		type: string;
		required: boolean;
		validation?: string;
	},
): { valid: boolean; error?: string } {
	// Check required
	if (field.required && !value) {
		return { valid: false, error: "This field is required" };
	}

	if (!value) {
		return { valid: true };
	}

	// Type-specific validation
	switch (field.type) {
		case "email": {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(String(value))) {
				return { valid: false, error: "Invalid email address" };
			}
			break;
		}
		case "phone": {
			const phoneRegex = /^\+?[\d\s-()]+$/;
			if (!phoneRegex.test(String(value))) {
				return { valid: false, error: "Invalid phone number" };
			}
			break;
		}
		case "number": {
			if (Number.isNaN(Number(value))) {
				return { valid: false, error: "Must be a number" };
			}
			break;
		}
	}

	// Custom validation rules
	if (field.validation) {
		const rules = field.validation.split(",");
		for (const rule of rules) {
			const [type, param] = rule.trim().split(":");

			switch (type) {
				case "min": {
					if (param) {
						const minLength = Number.parseInt(param);
						if (String(value).length < minLength) {
							return {
								valid: false,
								error: `Minimum length is ${minLength} characters`,
							};
						}
					}
					break;
				}
				case "max": {
					if (param) {
						const maxLength = Number.parseInt(param);
						if (String(value).length > maxLength) {
							return {
								valid: false,
								error: `Maximum length is ${maxLength} characters`,
							};
						}
					}
					break;
				}
				case "pattern": {
					if (param) {
						const pattern = new RegExp(param);
						if (!pattern.test(String(value))) {
							return { valid: false, error: "Invalid format" };
						}
					}
					break;
				}
			}
		}
	}

	return { valid: true };
}

/**
 * Validate entire form submission
 */
export function validateFormSubmission(
	data: Record<string, unknown>,
	fields: Array<{
		id: string;
		type: string;
		required: boolean;
		validation?: string;
		conditionalLogic?: {
			show: boolean;
			when: string;
			operator: string;
			value: unknown;
		};
	}>,
): { valid: boolean; errors: Record<string, string> } {
	const errors: Record<string, string> = {};

	for (const field of fields) {
		// Check conditional logic
		if (field.conditionalLogic) {
			const { show, when, operator, value: condValue } = field.conditionalLogic;
			const whenValue = data[when];

			let shouldShow = false;
			switch (operator) {
				case "equals":
					shouldShow = whenValue === condValue;
					break;
				case "not_equals":
					shouldShow = whenValue !== condValue;
					break;
				case "contains":
					shouldShow = String(whenValue).includes(String(condValue));
					break;
			}

			// If field should not be shown, skip validation
			if (show !== shouldShow) {
				continue;
			}
		}

		const value = data[field.id];
		const result = validateField(value, field);

		if (!result.valid && result.error) {
			errors[field.id] = result.error;
		}
	}

	return {
		valid: Object.keys(errors).length === 0,
		errors,
	};
}

/**
 * Get form by ID with parsed fields
 */
export async function getFormById(formId: string) {
	const form = await db.query.formTable.findFirst({
		where: eq(formTable.id, formId),
	});

	if (!form) {
		return null;
	}

	return {
		...form,
		fields: form.fields ? JSON.parse(form.fields) : [],
		settings: form.settings ? JSON.parse(form.settings) : {},
		postSubmitConfig: form.postSubmitConfig
			? JSON.parse(form.postSubmitConfig)
			: {},
	};
}

/**
 * Get form by slug (public access)
 */
export async function getFormBySlug(organizationId: string, slug: string) {
	const form = await db.query.formTable.findFirst({
		where: and(
			eq(formTable.organizationId, organizationId),
			eq(formTable.slug, slug),
			eq(formTable.active, true),
		),
	});

	if (!form) {
		return null;
	}

	return {
		...form,
		fields: form.fields ? JSON.parse(form.fields) : [],
		settings: form.settings ? JSON.parse(form.settings) : {},
		postSubmitConfig: form.postSubmitConfig
			? JSON.parse(form.postSubmitConfig)
			: {},
	};
}

/**
 * List forms with filters
 */
export async function listForms(
	organizationId: string,
	filters: ListFormsInput,
) {
	const conditions = [eq(formTable.organizationId, organizationId)];

	// Search filter
	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			sql`${formTable.name} ILIKE ${searchTerm} OR ${formTable.description} ILIKE ${searchTerm}`,
		);
	}

	// Active filter
	if (filters.active !== undefined) {
		conditions.push(eq(formTable.active, filters.active));
	}

	// Build order by
	const direction = filters.orderDirection === "asc" ? asc : desc;
	let orderByClause: ReturnType<typeof direction>;

	switch (filters.orderBy) {
		case "name":
			orderByClause = direction(formTable.name);
			break;
		case "submissions":
			orderByClause = direction(formTable.submissions);
			break;
		default:
			orderByClause = desc(formTable.createdAt);
	}

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(formTable)
		.where(and(...conditions));

	const count = countResult[0]?.count ?? 0;

	// Get forms
	const forms = await db.query.formTable.findMany({
		where: and(...conditions),
		orderBy: orderByClause,
		limit: filters.limit,
		offset: filters.offset,
	});

	// Parse JSON fields
	const parsedForms = forms.map((form) => ({
		...form,
		fields: form.fields ? JSON.parse(form.fields) : [],
		settings: form.settings ? JSON.parse(form.settings) : {},
		postSubmitConfig: form.postSubmitConfig
			? JSON.parse(form.postSubmitConfig)
			: {},
	}));

	return {
		forms: parsedForms,
		total: count,
		hasMore: count > filters.offset + filters.limit,
	};
}

/**
 * Get form submissions
 */
export async function getFormSubmissions(
	formId: string,
	limit = 25,
	offset = 0,
) {
	const submissions = await db.query.formSubmissionTable.findMany({
		where: eq(formSubmissionTable.formId, formId),
		orderBy: desc(formSubmissionTable.submittedAt),
		limit,
		offset,
		with: {
			contact: {
				columns: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					phone: true,
				},
			},
		},
	});

	// Parse JSON data
	return submissions.map((submission) => ({
		...submission,
		data: submission.data ? JSON.parse(submission.data) : {},
		utmParams: submission.utmParams ? JSON.parse(submission.utmParams) : {},
	}));
}

/**
 * Get form statistics
 */
export async function getFormStats(formId: string) {
	const form = await db.query.formTable.findFirst({
		where: eq(formTable.id, formId),
		columns: {
			views: true,
			submissions: true,
			conversionRate: true,
		},
	});

	if (!form) {
		return null;
	}

	// Get submissions over time (last 30 days)
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const submissionsOverTime = await db
		.select({
			date: sql<string>`DATE(${formSubmissionTable.submittedAt})`,
			count: sql<number>`count(*)::int`,
		})
		.from(formSubmissionTable)
		.where(
			and(
				eq(formSubmissionTable.formId, formId),
				sql`${formSubmissionTable.submittedAt} >= ${thirtyDaysAgo}`,
			),
		)
		.groupBy(sql`DATE(${formSubmissionTable.submittedAt})`)
		.orderBy(sql`DATE(${formSubmissionTable.submittedAt})`);

	return {
		...form,
		submissionsOverTime,
	};
}

/**
 * Increment form views
 */
export async function incrementFormViews(formId: string) {
	await db
		.update(formTable)
		.set({
			views: sql`${formTable.views} + 1`,
		})
		.where(eq(formTable.id, formId));
}

/**
 * Calculate and update conversion rate
 */
export async function updateConversionRate(formId: string) {
	const form = await db.query.formTable.findFirst({
		where: eq(formTable.id, formId),
		columns: {
			views: true,
			submissions: true,
		},
	});

	if (!form || form.views === 0) {
		return;
	}

	const conversionRate = (form.submissions / form.views) * 100;

	await db
		.update(formTable)
		.set({
			conversionRate,
		})
		.where(eq(formTable.id, formId));
}
