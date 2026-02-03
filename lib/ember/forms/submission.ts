import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ContactSourceType } from "@/lib/db/schema/enums";
import {
	conversationTable,
	formSubmissionTable,
	formTable,
} from "@/lib/db/schema/tables";
import { agentManager } from "@/lib/ember/agents/manager";
import {
	detectDuplicateContacts,
	mergeContacts,
} from "@/lib/ember/memoria/merger";
import { findOrCreateContact } from "@/lib/ember/memoria/queries";
import {
	getFormById,
	incrementFormViews,
	validateFormSubmission,
} from "./builder";

/**
 * Extract contact info from form data
 */
function extractContactInfo(data: Record<string, unknown>): {
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
} {
	// Common field mappings
	const fieldMappings = {
		firstName: ["firstName", "first_name", "name", "fullName", "full_name"],
		lastName: ["lastName", "last_name", "surname"],
		email: ["email", "emailAddress", "email_address", "mail"],
		phone: ["phone", "phoneNumber", "phone_number", "mobile", "tel"],
	};

	const result: {
		firstName: string;
		lastName: string;
		email?: string;
		phone?: string;
	} = {
		firstName: "",
		lastName: "",
	};

	// Extract first name
	for (const key of fieldMappings.firstName) {
		if (data[key]) {
			const value = String(data[key]);
			// If it's a full name, split it
			if (key === "fullName" || key === "full_name" || key === "name") {
				const parts = value.split(" ");
				result.firstName = parts[0] || "";
				result.lastName = parts.slice(1).join(" ") || "";
			} else {
				result.firstName = value;
			}
			break;
		}
	}

	// Extract last name if not already set
	if (!result.lastName) {
		for (const key of fieldMappings.lastName) {
			if (data[key]) {
				result.lastName = String(data[key]);
				break;
			}
		}
	}

	// Extract email
	for (const key of fieldMappings.email) {
		if (data[key]) {
			result.email = String(data[key]);
			break;
		}
	}

	// Extract phone
	for (const key of fieldMappings.phone) {
		if (data[key]) {
			result.phone = String(data[key]);
			break;
		}
	}

	return result;
}

/**
 * Process form submission
 */
export async function processFormSubmission(
	formId: string,
	data: Record<string, unknown>,
	metadata?: {
		ip?: string;
		userAgent?: string;
		referrer?: string;
		utmParams?: Record<string, string>;
	},
) {
	return await db.transaction(async (tx) => {
		// 1. Get and validate form
		const form = await getFormById(formId);
		if (!form || !form.active) {
			throw new Error("Form not found or inactive");
		}

		// 2. Validate submission data
		const validation = validateFormSubmission(data, form.fields);
		if (!validation.valid) {
			throw new Error(
				`Validation failed: ${Object.values(validation.errors).join(", ")}`,
			);
		}

		// 3. Extract contact information
		const contactInfo = extractContactInfo(data);

		if (!contactInfo.firstName) {
			throw new Error("Could not extract contact name from form data");
		}

		// 4. Find or create contact
		const contact = await findOrCreateContact(form.organizationId, {
			firstName: contactInfo.firstName,
			lastName: contactInfo.lastName,
			email: contactInfo.email || null,
			phone: contactInfo.phone || null,
			sourceType: "form" as ContactSourceType,
			sourceIdentifier: formId,
			sourceMetadata: {
				formName: form.name,
				formSlug: form.slug,
			},
		});

		// 5. Detect and merge duplicates
		const duplicates = await detectDuplicateContacts(
			form.organizationId,
			{
				email: contactInfo.email,
				phone: contactInfo.phone,
				firstName: contactInfo.firstName,
				lastName: contactInfo.lastName,
			},
			0.7, // 70% similarity threshold
		);

		if (duplicates.length > 0) {
			// Merge duplicates into the contact
			const duplicateIds = duplicates
				.map((d) => d.id)
				.filter((id) => id !== contact.id);

			if (duplicateIds.length > 0) {
				await mergeContacts(contact.id, duplicateIds);
			}
		}

		// 6. Save submission
		const submissions = await tx
			.insert(formSubmissionTable)
			.values({
				formId,
				contactId: contact.id,
				data: JSON.stringify(data),
				ip: metadata?.ip,
				userAgent: metadata?.userAgent,
				referrer: metadata?.referrer,
				utmParams: metadata?.utmParams
					? JSON.stringify(metadata.utmParams)
					: null,
				submittedAt: new Date(),
			})
			.returning();

		const submission = submissions[0];
		if (!submission) {
			throw new Error("Failed to create submission");
		}

		// 7. Update form statistics
		await tx
			.update(formTable)
			.set({
				submissions: sql`${formTable.submissions} + 1`,
			})
			.where(eq(formTable.id, formId));

		// 8. Start conversation if configured
		if (
			form.postSubmitAction === "start_conversation" &&
			form.assignToAgentId
		) {
			const [conversation] = await tx
				.insert(conversationTable)
				.values({
					organizationId: form.organizationId,
					contactId: contact.id,
					status: "active",
					channel: "web",
					handledByAi: true,
					messageCount: 0,
				})
				.returning();

			if (conversation) {
				// Assign agent to conversation
				await agentManager.assignAgentToConversation(
					conversation.id,
					form.assignToAgentId,
					contact.id,
				);

				// TODO: Send initial message from agent (Phase 6 - Ember Core)
			}
		}

		// 9. Trigger webhook if configured
		if (form.webhookUrl) {
			// Fire webhook asynchronously (don't wait)
			fetch(form.webhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					formId: form.id,
					formName: form.name,
					submissionId: submission.id,
					contactId: contact.id,
					data,
					submittedAt: submission.submittedAt,
				}),
			}).catch((error) => {
				console.error("Webhook failed:", error);
			});
		}

		// 10. Send email notification if configured
		if (form.emailNotification) {
			// TODO: Send email notification (use existing sendEmail)
		}

		return {
			success: true,
			submissionId: submission.id,
			contactId: contact.id,
			message:
				form.postSubmitConfig?.message || "Thank you for your submission!",
		};
	});
}
