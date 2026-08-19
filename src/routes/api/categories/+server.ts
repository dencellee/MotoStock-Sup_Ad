import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { categories } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// GET all categories
export const GET: RequestHandler = async () => {
    try {
        const allCategories = await db.select().from(categories).orderBy(desc(categories.id)).execute();
        return json(allCategories);
    } catch (error: any) {
        console.error('[Categories GET Error]:', error);
        return json({ error: 'Failed to fetch categories' }, { status: 500 });
    }
};

// POST new category
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { name } = await request.json();

        if (!name || !name.trim()) {
            return json({ error: 'Category name is required' }, { status: 400 });
        }

        const now = new Date();
        const [inserted] = await db.insert(categories).values({
            name: name.trim(),
            createdAt: now,
            updatedAt: now
        }).returning();
        return json(inserted, { status: 201 })
    } catch (error: any) {
        console.error('[Categories POST Error]:', error);

        // Handle duplicate category error (UNIQUE constraint)
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint')) {
            return json({ error: 'A category with this name already exists.' }, { status: 400 });
        }

        return json({ error: 'Failed to create category' }, { status: 500 });
    }
};