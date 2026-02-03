import { type NextRequest, NextResponse } from "next/server";
import { processFormSubmission } from "@/lib/ember/forms/submission";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
	try {
		// Parse request body
		const body = await req.json();
		const { formId, data, metadata } = body;

		// Validate required fields
		if (!formId || !data) {
			return NextResponse.json(
				{ error: "Missing required fields: formId and data" },
				{ status: 400 },
			);
		}

		// Extract metadata from request
		const submissionMetadata = {
			ip: metadata?.ip || req.headers.get("x-forwarded-for") || undefined,
			userAgent: metadata?.userAgent || req.headers.get("user-agent") || "",
			referrer: metadata?.referrer || req.headers.get("referer") || undefined,
			utmParams: metadata?.utmParams || extractUtmParams(req.url),
		};

		// Process form submission
		const result = await processFormSubmission(
			formId,
			data,
			submissionMetadata,
		);

		logger.info(
			{
				formId,
				contactId: result.contactId,
				submissionId: result.submissionId,
			},
			"Form submission processed successfully",
		);

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		logger.error({ error }, "Form submission failed");

		if (error instanceof Error) {
			// Handle validation errors
			if (
				error.message.includes("Validation failed") ||
				error.message.includes("not found") ||
				error.message.includes("inactive")
			) {
				return NextResponse.json({ error: error.message }, { status: 400 });
			}
		}

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// CORS support for embedded forms
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}

/**
 * Extract UTM parameters from URL
 */
function extractUtmParams(url: string): Record<string, string> | undefined {
	try {
		const urlObj = new URL(url);
		const params: Record<string, string> = {};

		const utmKeys = [
			"utm_source",
			"utm_medium",
			"utm_campaign",
			"utm_term",
			"utm_content",
		];

		for (const key of utmKeys) {
			const value = urlObj.searchParams.get(key);
			if (value) {
				params[key] = value;
			}
		}

		return Object.keys(params).length > 0 ? params : undefined;
	} catch {
		return undefined;
	}
}
