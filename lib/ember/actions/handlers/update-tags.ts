import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactTable } from "@/lib/db/schema/tables";
import { actionsExecutor } from "../executor";

/**
 * Update Tags Action Handler
 * Updates contact tags based on conversation insights
 */

actionsExecutor.register({
	name: "update-tags",

	validate(params): boolean {
		return typeof params.contactId === "string" && Array.isArray(params.tags);
	},

	async execute(params) {
		const { contactId, tags } = params as {
			contactId: string;
			tags: string[];
		};

		// Get current contact
		const contact = await db.query.contactTable.findFirst({
			where: eq(contactTable.id, contactId),
		});

		if (!contact) {
			throw new Error("Contact not found");
		}

		// Parse existing tags
		const currentTags =
			typeof contact.tags === "string"
				? JSON.parse(contact.tags)
				: contact.tags || [];

		// Merge tags (avoid duplicates)
		const mergedTags = Array.from(new Set([...currentTags, ...tags]));

		// Update contact
		await db
			.update(contactTable)
			.set({
				tags: JSON.stringify(mergedTags),
			})
			.where(eq(contactTable.id, contactId));

		return { success: true, tags: mergedTags };
	},
});
