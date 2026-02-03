import { type NextRequest, NextResponse } from "next/server";
import { getFormBySlug, incrementFormViews } from "@/lib/ember/forms/builder";
import { logger } from "@/lib/logger";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ slug: string }> },
) {
	try {
		const { slug } = await params;

		// Extract organization ID from query params or subdomain
		const url = new URL(req.url);
		const organizationId = url.searchParams.get("orgId");

		if (!organizationId) {
			return NextResponse.json(
				{ error: "Missing organization ID" },
				{ status: 400 },
			);
		}

		// Get form by slug
		const form = await getFormBySlug(organizationId, slug);

		if (!form) {
			return NextResponse.json({ error: "Form not found" }, { status: 404 });
		}

		if (!form.active) {
			return NextResponse.json(
				{ error: "Form is not active" },
				{ status: 403 },
			);
		}

		// Increment view count asynchronously
		incrementFormViews(form.id).catch((error) => {
			logger.error(
				{ error, formId: form.id },
				"Failed to increment form views",
			);
		});

		// Return only public-safe fields
		const publicForm = {
			id: form.id,
			name: form.name,
			description: form.description,
			fields: form.fields,
			settings: form.settings,
			postSubmitConfig: form.postSubmitConfig,
		};

		return NextResponse.json(publicForm, {
			status: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
			},
		});
	} catch (error) {
		logger.error({ error }, "Failed to fetch form");
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// CORS support
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}
