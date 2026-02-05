import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
	inventorySyncConfigTable,
	productCategoryTable,
	productTable,
} from "@/lib/db/schema/tables";
import {
	getCategoryById,
	getLowStockProducts,
	getProductById,
	getProductBySku,
	listCategories,
	listProducts,
	searchProducts,
	updateStock,
} from "@/lib/ember/inventario/queries";
import { syncInventory } from "@/lib/ember/inventario/sync";
import {
	createInventorySyncConfigSchema,
	createProductCategorySchema,
	createProductSchema,
	listProductsSchema,
	updateInventorySyncConfigSchema,
	updateProductCategorySchema,
	updateProductSchema,
} from "@/schemas/product.schema";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

export const organizationInventoryRouter = createTRPCRouter({
	// List products
	listProducts: protectedOrganizationProcedure
		.input(listProductsSchema)
		.query(async ({ ctx, input }) => {
			return await listProducts(ctx.organization.id, input);
		}),

	// Get product by ID
	getProduct: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const product = await getProductById(input.id);

			if (!product || product.organizationId !== ctx.organization.id) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Product not found",
				});
			}

			return product;
		}),

	// Get product by SKU
	getProductBySku: protectedOrganizationProcedure
		.input(z.object({ sku: z.string() }))
		.query(async ({ ctx, input }) => {
			const product = await getProductBySku(ctx.organization.id, input.sku);

			if (!product) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Product not found",
				});
			}

			return product;
		}),

	// Search products
	searchProducts: protectedOrganizationProcedure
		.input(
			z.object({
				query: z.string().min(1),
				limit: z.number().min(1).max(50).default(10),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await searchProducts(
				ctx.organization.id,
				input.query,
				input.limit,
			);
		}),

	// Get low stock products
	getLowStock: protectedOrganizationProcedure.query(async ({ ctx }) => {
		return await getLowStockProducts(ctx.organization.id);
	}),

	// Create product
	createProduct: protectedOrganizationProcedure
		.input(createProductSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if SKU already exists
			const existing = await getProductBySku(ctx.organization.id, input.sku);
			if (existing) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "A product with this SKU already exists",
				});
			}

			const [product] = await db
				.insert(productTable)
				.values({
					...input,
					organizationId: ctx.organization.id,
					tags: JSON.stringify(input.tags || []),
					images: JSON.stringify(input.images || []),
				})
				.returning();

			return product;
		}),

	// Update product
	updateProduct: protectedOrganizationProcedure
		.input(updateProductSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;

			// Check if SKU is taken by another product
			if (input.sku) {
				const existing = await getProductBySku(ctx.organization.id, input.sku);
				if (existing && existing.id !== id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "A product with this SKU already exists",
					});
				}
			}

			const updateData: Record<string, unknown> = {};
			if (data.sku) updateData.sku = data.sku;
			if (data.name) updateData.name = data.name;
			if (data.description !== undefined)
				updateData.description = data.description;
			if (data.categoryId !== undefined)
				updateData.categoryId = data.categoryId;
			if (data.price !== undefined) updateData.price = data.price;
			if (data.compareAtPrice !== undefined)
				updateData.compareAtPrice = data.compareAtPrice;
			if (data.currency) updateData.currency = data.currency;
			if (data.trackInventory !== undefined)
				updateData.trackInventory = data.trackInventory;
			if (data.stockQuantity !== undefined)
				updateData.stockQuantity = data.stockQuantity;
			if (data.lowStockThreshold !== undefined)
				updateData.lowStockThreshold = data.lowStockThreshold;
			if (data.active !== undefined) updateData.active = data.active;
			if (data.externalId !== undefined)
				updateData.externalId = data.externalId;
			if (data.externalSource !== undefined)
				updateData.externalSource = data.externalSource;
			if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
			if (data.images !== undefined)
				updateData.images = JSON.stringify(data.images);

			const [updatedProduct] = await db
				.update(productTable)
				.set(updateData)
				.where(
					and(
						eq(productTable.id, id),
						eq(productTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!updatedProduct) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Product not found",
				});
			}

			return updatedProduct;
		}),

	// Delete product
	deleteProduct: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [deletedProduct] = await db
				.delete(productTable)
				.where(
					and(
						eq(productTable.id, input.id),
						eq(productTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!deletedProduct) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Product not found",
				});
			}

			return { success: true };
		}),

	// Update stock
	updateStock: protectedOrganizationProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				quantity: z.number().int().min(0),
				operation: z.enum(["set", "add", "subtract"]).default("set"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify product belongs to organization
			const product = await db.query.productTable.findFirst({
				where: and(
					eq(productTable.id, input.id),
					eq(productTable.organizationId, ctx.organization.id),
				),
			});

			if (!product) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Product not found",
				});
			}

			await updateStock(input.id, input.quantity, input.operation);

			return { success: true };
		}),

	// Categories
	listCategories: protectedOrganizationProcedure.query(async ({ ctx }) => {
		return await listCategories(ctx.organization.id);
	}),

	getCategory: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const category = await getCategoryById(input.id);

			if (!category || category.organizationId !== ctx.organization.id) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Category not found",
				});
			}

			return category;
		}),

	createCategory: protectedOrganizationProcedure
		.input(createProductCategorySchema)
		.mutation(async ({ ctx, input }) => {
			const categories = (await db
				.insert(productCategoryTable)
				.values({
					...input,
					organizationId: ctx.organization.id,
				} as typeof productCategoryTable.$inferInsert)
				.returning()) as Array<typeof productCategoryTable.$inferSelect>;

			return categories[0];
		}),

	updateCategory: protectedOrganizationProcedure
		.input(updateProductCategorySchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;

			const updatedCategories = (await db
				.update(productCategoryTable)
				.set({
					...data,
				} as Partial<typeof productCategoryTable.$inferInsert>)
				.where(
					and(
						eq(productCategoryTable.id, id),
						eq(productCategoryTable.organizationId, ctx.organization.id),
					),
				)
				.returning()) as Array<typeof productCategoryTable.$inferSelect>;

			if (!updatedCategories[0]) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Category not found",
				});
			}

			return updatedCategories[0];
		}),

	deleteCategory: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const deletedCategories = (await db
				.delete(productCategoryTable)
				.where(
					and(
						eq(productCategoryTable.id, input.id),
						eq(productCategoryTable.organizationId, ctx.organization.id),
					),
				)
				.returning()) as Array<typeof productCategoryTable.$inferSelect>;

			if (!deletedCategories[0]) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Category not found",
				});
			}

			return { success: true };
		}),

	// Sync configurations
	listSyncConfigs: protectedOrganizationProcedure.query(async ({ ctx }) => {
		return await db.query.inventorySyncConfigTable.findMany({
			where: eq(inventorySyncConfigTable.organizationId, ctx.organization.id),
		});
	}),

	getSyncConfig: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const config = await db.query.inventorySyncConfigTable.findFirst({
				where: and(
					eq(inventorySyncConfigTable.id, input.id),
					eq(inventorySyncConfigTable.organizationId, ctx.organization.id),
				),
			});

			if (!config) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Sync configuration not found",
				});
			}

			return config;
		}),

	createSyncConfig: protectedOrganizationProcedure
		.input(createInventorySyncConfigSchema)
		.mutation(async ({ ctx, input }) => {
			const [config] = await db
				.insert(inventorySyncConfigTable)
				.values({
					...input,
					organizationId: ctx.organization.id,
					credentials: JSON.stringify(input.credentials),
					fieldMapping: input.fieldMapping
						? JSON.stringify(input.fieldMapping)
						: null,
				})
				.returning();

			return config;
		}),

	updateSyncConfig: protectedOrganizationProcedure
		.input(updateInventorySyncConfigSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;

			const updateData: Record<string, unknown> = {};
			if (data.source) updateData.source = data.source;
			if (data.syncSchedule !== undefined)
				updateData.syncSchedule = data.syncSchedule;
			if (data.autoSync !== undefined) updateData.autoSync = data.autoSync;
			if (data.credentials !== undefined)
				updateData.credentials = JSON.stringify(data.credentials);
			if (data.fieldMapping !== undefined)
				updateData.fieldMapping = JSON.stringify(data.fieldMapping);

			const [updatedConfig] = await db
				.update(inventorySyncConfigTable)
				.set(updateData)
				.where(
					and(
						eq(inventorySyncConfigTable.id, id),
						eq(inventorySyncConfigTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!updatedConfig) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Sync configuration not found",
				});
			}

			return updatedConfig;
		}),

	deleteSyncConfig: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [deletedConfig] = await db
				.delete(inventorySyncConfigTable)
				.where(
					and(
						eq(inventorySyncConfigTable.id, input.id),
						eq(inventorySyncConfigTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!deletedConfig) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Sync configuration not found",
				});
			}

			return { success: true };
		}),

	// Trigger sync
	triggerSync: protectedOrganizationProcedure
		.input(z.object({ syncConfigId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			return await syncInventory(ctx.organization.id, input.syncConfigId);
		}),
});
