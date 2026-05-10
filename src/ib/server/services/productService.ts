
import { db } from '../db/index';
import { products, categories, logs } from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';


interface ProductData {
    name: string;
    brand: string;
    categoryId: number;
    barcode: string;
    color?: string;
    size?: string;
    price: number;
    cost: number;
    quantity: number;
}

// const formatCurrency = (num: number) => `₱${Number(num).toLocaleString()}`;

export class ProductService {
    // ✅ Added 'async' to fix the await error
    static async checkDuplicate(data: ProductData, excludeId?: number) {
        const conditions = [
            sql`lower(${products.name}) = lower(${data.name})`,
            sql`lower(${products.brand}) = lower(${data.brand})`,
            sql`lower(coalesce(${products.color}, '')) = lower(${data.color || ''})`,
            sql`lower(coalesce(${products.size}, '')) = lower(${data.size || ''})`,
            eq(products.categoryId, data.categoryId),
            sql`lower(${products.barcode}) = lower(${data.barcode})`
        ];

        if (excludeId) {
            conditions.push(sql`${products.id} != ${excludeId}`);
        }

        return await db.select().from(products).where(and(...conditions));
    }

    static async createProduct(data: ProductData, userId: number, userName: string) {
        return await db.transaction(async (tx) => {
            const now = new Date();
            console.log('[DEBUG] typeof now:', typeof now, 'now:', now);
            // Convert price/cost to string for Drizzle Postgres
            const insertData = {
                ...data,
                price: data.price !== undefined ? String(data.price) : undefined,
                cost: data.cost !== undefined ? String(data.cost) : undefined,
                created_at: now,
                updated_at: now
            };
            const [inserted] = await tx.insert(products)
                .values(insertData)
                .returning({ id: products.id });

            const insertId = inserted?.id;

            const [category] = await tx.select({ name: categories.name })
                .from(categories)
                .where(eq(categories.id, data.categoryId))
                .limit(1);

            const logParts = [
                `Created "${data.name}" (${data.brand})`,
                `Category: ${category?.name || 'Unknown'}`,
                data.color ? `Color: ${data.color}` : null,
                data.size ? `Size: ${data.size}` : null,
                `Cost: ${data.cost}`,
                `Price: ${data.price}`,
                `Initial Stock: ${data.quantity} pcs`
            ].filter(Boolean);

            await tx.insert(logs).values({
                userId: userId,
                userName: userName,
                action: "CREATE_PRODUCT",
                details: logParts.join(' | '),
                timestamp: now,
                createdAt: now
            });

            // Return the inserted product with camelCase keys
            return { id: insertId, ...data, created_at: now, updated_at: now };
        });
    }

    static async updateProduct(id: number, data: Partial<ProductData>, userId: number, userName: string) {
        return await db.transaction(async (tx) => {
            const [current] = await tx.select().from(products).where(eq(products.id, id)).limit(1);
            if (!current) throw new Error('Product not found');

            const changes: string[] = [];
            if (data.name && current.name !== data.name) changes.push(`Name: "${current.name}" -> "${data.name}"`);
            if (data.price !== undefined && Number(current.price) !== Number(data.price)) {
                changes.push(`Price: ${current.price} -> ${data.price}`);
            }
            if (data.cost !== undefined && Number(current.cost) !== Number(data.cost)) {
                changes.push(`Cost: ${current.cost} -> ${data.cost}`);
            }

            const now = new Date();

            // Convert price/cost to string for Drizzle Postgres
            const updateData = {
                ...data,
                price: data.price !== undefined ? String(data.price) : undefined,
                cost: data.cost !== undefined ? String(data.cost) : undefined,
                updatedAt: now
            };
            await tx.update(products)
                .set(updateData)
                .where(eq(products.id, id));

            if (changes.length > 0) {
                await tx.insert(logs).values({
                    userId: userId,
                    userName: userName,
                    action: "UPDATE_PRODUCT",
                    details: `Updated ${current.name}: ${changes.join(', ')}`,
                    timestamp: now,
                    createdAt: now
                });
            }

            return { ...current, ...data, updatedAt: now };
        });
    }

    static async restockProduct(id: number, quantityToAdd: number, newCost: number, userId: number, userName: string) {
        return await db.transaction(async (tx) => {
            const [current] = await tx.select().from(products).where(eq(products.id, id)).limit(1);
            if (!current) throw new Error('Product not found');

            const totalValue = (current.quantity * Number(current.cost)) + (quantityToAdd * Number(newCost));
            const finalQty = current.quantity + quantityToAdd;
            const finalCost = Number((totalValue / finalQty).toFixed(2));
            const now = new Date();

            await tx.update(products)
                .set({
                    cost: String(finalCost),
                    quantity: finalQty,
                    updatedAt: now
                })
                .where(eq(products.id, id));

            await tx.insert(logs).values({
                userId: userId,
                userName: userName || 'Unknown',
                action: "RESTOCK",
                details: `Restocked ${current.name}. Added ${quantityToAdd} units. Qty: ${current.quantity} -> ${finalQty}. WAC: ${current.cost} -> ${finalCost}`,
                timestamp: now,
                createdAt: now
            });

            return { ...current, quantity: finalQty, cost: finalCost, updatedAt: now };
        });
    }

    static async getAllProducts() {
        return await db.select({
            id: products.id,
            name: products.name,
            brand: products.brand,
            categoryId: products.categoryId,
            categoryName: categories.name,
            barcode: products.barcode,
            color: products.color,
            size: products.size,
            price: products.price,
            cost: products.cost,
            quantity: products.quantity,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .orderBy(desc(products.id)); // price/cost will be string from DB
    }

    static async deleteProduct(id: number, userId: number, userName: string) {
        return await db.transaction(async (tx) => {
            const [product] = await tx.select().from(products).where(eq(products.id, id));
            if (!product) throw new Error('Product not found');

            const [deleted] = await tx.delete(products)
                .where(eq(products.id, id))
                .returning({ id: products.id });
            if (!deleted) throw new Error('Delete failed');

            const now = new Date();
            await tx.insert(logs).values({
                userId: userId,
                userName: userName,
                action: "DELETE_PRODUCT",
                details: `Deleted ${product.name} (${product.brand})`,
                timestamp: now,
                createdAt: now
            });

            return { success: true };
        });
    }
}