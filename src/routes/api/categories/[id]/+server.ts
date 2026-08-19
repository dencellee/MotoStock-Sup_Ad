import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { categories, products } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// GET single category
export const GET: RequestHandler = async ({ params }) => {
    try {
        const id = Number(params.id);
        const [category] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);

        if (!category) {
            return json({ error: 'Category not found' }, { status: 404 });
        }

        return json(category);
    } catch (error: any) {
        console.error('[Category GET Error]:', error);
        return json({ error: 'Failed to fetch category' }, { status: 500 });
    }
};

// PUT update category
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const id = Number(params.id);
        const { name } = await request.json();
        const trimmedName = name?.trim();

        if (!trimmedName) {
            return json({ error: 'Category name is required' }, { status: 400 });
        }

        // 1. Perform the update
        const [updated] = await db.update(categories)
            .set({ name: trimmedName })
            .where(eq(categories.id, id))
            .returning();

        if (!updated) {
            return json({ error: 'Category not found' }, { status: 404 });
        }

        return json(updated);
        
    } catch (error: any) {
        console.error('[Category PUT Error]:', error);

        if (error.message?.includes('Duplicate entry') || error.message?.includes('UNIQUE constraint')) {
            return json({ error: 'Category name already exists' }, { status: 400 });
        }

        return json({ error: 'Failed to update category' }, { status: 500 });
    }
};

// DELETE category
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const id = Number(params.id);

        // 1. Check if category has products
        const [productCount] = await db.select({ count: sql<number>`COUNT(*)` })
            .from(products)
            .where(eq(products.categoryId, id));

        if (productCount && productCount.count > 0) {
            return json({ error: 'CANNOT DELETE: This category contains products' }, { status: 400 });
        }

        // 2. Perform delete
        const [deleted] = await db.delete(categories)
            .where(eq(categories.id, id))
            .returning();

        if (!deleted) {
            return json({ error: 'Category not found' }, { status: 404 });
        }

        return json({ success: true })
    } catch (error: any) {
        console.error('[Category DELETE Error]:', error);
        return json({ error: 'Failed to delete category' }, { status: 500 });
    }
};