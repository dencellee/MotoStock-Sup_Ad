// src/routes/api/categories/[id]/products/+server.ts

import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { products, categories } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm'; 

// ==========================================================
// ➕ POST: Add Product Inside a Specific Category
// URL: POST /api/categories/1/products
// Body: { name: "...", brand: "...", quantity: 10, price: 50 }

import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ params, request, locals }: RequestEvent) {
    try {
        const { name, brand, quantity, price, color, size, cost, barcode } = await request.json();
        if (!name || !brand || !quantity || !price || !barcode) {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }
        const now = new Date();
        const [inserted] = await db.insert(products).values({
            name: name.trim(),
            brand: brand.trim(),
            categoryId: Number(params.id),
            quantity: Number(quantity),
            price: price.toString(),
            color: color?.trim() || null,
            size: size?.trim() || null,
            cost: cost ? cost.toString() : '0',
            barcode: barcode.trim(),
            createdAt: now,
            updatedAt: now
        }).returning();
        return json(inserted, { status: 201 });
    } catch (error) {
        console.error('[Category Product POST Error]:', error);
        return json({ error: 'Failed to add product to category' }, { status: 500 });
    }
}
// ==========================================================

export async function GET({ params }: { params: { id: string } }) {
    
    // --- 1. Get Category ID from URL ---
    const categoryId = parseInt(params.id);

    if (isNaN(categoryId)) {
        return json({ error: 'Invalid Category ID format in URL.' }, { status: 400 });
    }

    try {
        // --- 2. Check if Category Exists (Optional, but good practice) ---
        const categoryExists = await db.select({ id: categories.id })
            .from(categories)
            .where(eq(categories.id, categoryId))
            .limit(1);

        if (categoryExists.length === 0) {
            return json({ error: `Category with ID ${categoryId} not found.` }, { status: 404 });
        }

        // --- 3. Query all products linked to the categoryId ---
        const productsInCategory = await db.select()
            .from(products)
            .where(eq(products.categoryId, categoryId)); // Filter by the URL's ID

        // --- 4. Return the list of products ---
        return json(productsInCategory, { status: 200 });

    } catch (error) {
        console.error("Error fetching products by category:", error);
        return json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}