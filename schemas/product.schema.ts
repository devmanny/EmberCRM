import { z } from "zod";

// Product schema
export const productSchema = z.object({
	sku: z.string().min(1, "SKU is required").max(100),
	name: z.string().min(1, "Name is required").max(200),
	description: z.string().max(2000).optional().nullable(),
	categoryId: z.string().uuid().optional().nullable(),
	tags: z.array(z.string()).default([]),
	price: z.number().int().min(0, "Price must be positive"),
	compareAtPrice: z.number().int().min(0).optional().nullable(),
	currency: z.string().length(3).default("USD"),
	trackInventory: z.boolean().default(true),
	stockQuantity: z.number().int().min(0).default(0),
	lowStockThreshold: z.number().int().min(0).default(10),
	images: z.array(z.string().url()).default([]),
	active: z.boolean().default(true),
	externalId: z.string().optional().nullable(),
	externalSource: z.string().optional().nullable(),
});

// Create product schema
export const createProductSchema = productSchema;

// Update product schema
export const updateProductSchema = productSchema.partial().extend({
	id: z.string().uuid(),
});

// List products schema
export const listProductsSchema = z.object({
	limit: z.number().min(1).max(100).default(25),
	offset: z.number().min(0).default(0),
	search: z.string().optional(),
	categoryId: z.string().uuid().optional(),
	active: z.boolean().optional(),
	inStock: z.boolean().optional(),
	orderBy: z
		.enum(["createdAt", "name", "price", "stockQuantity"])
		.default("createdAt"),
	orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

// Product category schema
export const productCategorySchema = z.object({
	name: z.string().min(1, "Name is required").max(100),
	description: z.string().max(500).optional().nullable(),
	parentId: z.string().uuid().optional().nullable(),
});

export const createProductCategorySchema = productCategorySchema;

export const updateProductCategorySchema = productCategorySchema
	.partial()
	.extend({
		id: z.string().uuid(),
	});

// Inventory sync schema
export const inventorySyncConfigSchema = z.object({
	source: z.enum(["shopify", "woocommerce", "custom_api", "csv"]),
	credentials: z.record(z.string(), z.unknown()),
	syncSchedule: z.string().optional().nullable(), // Cron expression
	autoSync: z.boolean().default(false),
	fieldMapping: z.record(z.string(), z.string()).optional().nullable(),
});

export const createInventorySyncConfigSchema = inventorySyncConfigSchema;

export const updateInventorySyncConfigSchema = inventorySyncConfigSchema
	.partial()
	.extend({
		id: z.string().uuid(),
	});

// Export types
export type ProductInput = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
export type ProductCategoryInput = z.infer<typeof productCategorySchema>;
export type CreateProductCategoryInput = z.infer<
	typeof createProductCategorySchema
>;
export type UpdateProductCategoryInput = z.infer<
	typeof updateProductCategorySchema
>;
export type InventorySyncConfigInput = z.infer<
	typeof inventorySyncConfigSchema
>;
export type CreateInventorySyncConfigInput = z.infer<
	typeof createInventorySyncConfigSchema
>;
export type UpdateInventorySyncConfigInput = z.infer<
	typeof updateInventorySyncConfigSchema
>;
