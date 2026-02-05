import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { productCategoryTable, productTable } from "@/lib/db/schema/tables";
import type { ListProductsInput } from "@/schemas/product.schema";

/**
 * List products with filters
 */
export async function listProducts(
	organizationId: string,
	filters: ListProductsInput,
) {
	const conditions = [eq(productTable.organizationId, organizationId)];

	// Search filter
	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			or(
				ilike(productTable.name, searchTerm),
				ilike(productTable.description, searchTerm),
				ilike(productTable.sku, searchTerm),
			)!,
		);
	}

	// Category filter
	if (filters.categoryId) {
		conditions.push(eq(productTable.categoryId, filters.categoryId));
	}

	// Active filter
	if (filters.active !== undefined) {
		conditions.push(eq(productTable.active, filters.active));
	}

	// In stock filter
	if (filters.inStock) {
		conditions.push(sql`${productTable.stockQuantity} > 0`);
	}

	// Build order by
	const direction = filters.orderDirection === "asc" ? asc : desc;
	let orderByClause: ReturnType<typeof direction>;

	switch (filters.orderBy) {
		case "name":
			orderByClause = direction(productTable.name);
			break;
		case "price":
			orderByClause = direction(productTable.price);
			break;
		case "stockQuantity":
			orderByClause = direction(productTable.stockQuantity);
			break;
		default:
			orderByClause = desc(productTable.createdAt);
	}

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(productTable)
		.where(and(...conditions));

	const count = countResult[0]?.count ?? 0;

	// Get products
	const products = await db.query.productTable.findMany({
		where: and(...conditions),
		orderBy: orderByClause,
		limit: filters.limit,
		offset: filters.offset,
	});

	// Parse JSON fields
	const parsedProducts = products.map((product) => ({
		...product,
		tags:
			typeof product.tags === "string"
				? JSON.parse(product.tags)
				: product.tags || [],
		images:
			typeof product.images === "string"
				? JSON.parse(product.images)
				: product.images || [],
	}));

	return {
		products: parsedProducts,
		total: count,
		hasMore: count > filters.offset + filters.limit,
	};
}

/**
 * Get product by ID
 */
export async function getProductById(productId: string) {
	const product = await db.query.productTable.findFirst({
		where: eq(productTable.id, productId),
		with: {
			category: true,
		},
	});

	if (!product) {
		return null;
	}

	return {
		...product,
		tags:
			typeof product.tags === "string"
				? JSON.parse(product.tags)
				: product.tags || [],
		images:
			typeof product.images === "string"
				? JSON.parse(product.images)
				: product.images || [],
	};
}

/**
 * Get product by SKU
 */
export async function getProductBySku(organizationId: string, sku: string) {
	const product = await db.query.productTable.findFirst({
		where: and(
			eq(productTable.organizationId, organizationId),
			eq(productTable.sku, sku),
		),
	});

	if (!product) {
		return null;
	}

	return {
		...product,
		tags:
			typeof product.tags === "string"
				? JSON.parse(product.tags)
				: product.tags || [],
		images:
			typeof product.images === "string"
				? JSON.parse(product.images)
				: product.images || [],
	};
}

/**
 * Search products (for AI agents)
 */
export async function searchProducts(
	organizationId: string,
	query: string,
	limit = 10,
) {
	const searchTerm = `%${query}%`;

	const products = await db.query.productTable.findMany({
		where: and(
			eq(productTable.organizationId, organizationId),
			eq(productTable.active, true),
			or(
				ilike(productTable.name, searchTerm),
				ilike(productTable.description, searchTerm),
				ilike(productTable.sku, searchTerm),
			)!,
		),
		limit,
		orderBy: desc(productTable.createdAt),
	});

	return products.map((product) => ({
		...product,
		tags:
			typeof product.tags === "string"
				? JSON.parse(product.tags)
				: product.tags || [],
		images:
			typeof product.images === "string"
				? JSON.parse(product.images)
				: product.images || [],
	}));
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(organizationId: string) {
	const products = await db.query.productTable.findMany({
		where: and(
			eq(productTable.organizationId, organizationId),
			eq(productTable.trackInventory, true),
			sql`${productTable.stockQuantity} <= ${productTable.lowStockThreshold}`,
		),
		orderBy: asc(productTable.stockQuantity),
	});

	return products.map((product) => ({
		...product,
		tags:
			typeof product.tags === "string"
				? JSON.parse(product.tags)
				: product.tags || [],
		images:
			typeof product.images === "string"
				? JSON.parse(product.images)
				: product.images || [],
	}));
}

/**
 * Update stock quantity
 */
export async function updateStock(
	productId: string,
	quantity: number,
	operation: "set" | "add" | "subtract" = "set",
) {
	if (operation === "set") {
		await db
			.update(productTable)
			.set({ stockQuantity: quantity })
			.where(eq(productTable.id, productId));
	} else if (operation === "add") {
		await db
			.update(productTable)
			.set({ stockQuantity: sql`${productTable.stockQuantity} + ${quantity}` })
			.where(eq(productTable.id, productId));
	} else if (operation === "subtract") {
		await db
			.update(productTable)
			.set({ stockQuantity: sql`${productTable.stockQuantity} - ${quantity}` })
			.where(eq(productTable.id, productId));
	}
}

/**
 * List product categories
 */
export async function listCategories(organizationId: string) {
	const categories = await db.query.productCategoryTable.findMany({
		where: eq(productCategoryTable.organizationId, organizationId),
		orderBy: asc(productCategoryTable.name),
	});

	return categories;
}

/**
 * Get category by ID
 */
export async function getCategoryById(categoryId: string) {
	return await db.query.productCategoryTable.findFirst({
		where: eq(productCategoryTable.id, categoryId),
		with: {
			products: true,
		},
	});
}
