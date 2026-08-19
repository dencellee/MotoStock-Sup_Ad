import { json } from "@sveltejs/kit";
import { ProductService } from '$lib/server/services/productService';
import { validateData, productCreateSchema, productUpdateSchema, restockSchema } from '../../../lib/server/validation';


// ✅ Input sanitization
function sanitizeString(val: any): string {
    return String(val || '').trim().slice(0, 255);
}

function sanitizeNumber(val: any): number {
    const num = Number(val || 0);
    return isNaN(num) ? 0 : Math.max(0, num);
}

// GET – Fetch all products
export async function GET() {
    try {
        const productList = await ProductService.getAllProducts();
        
        const normalized = productList.map((p: any) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            categoryId: p.categoryId,
            categoryName: p.categoryName || 'Uncategorized',
            barcode: p.barcode,
            color: p.color || '',
            size: p.size || '',
            price: p.price,
            cost: p.cost,
            quantity: p.quantity,
            createdAt: p.createdAt
        }));

        return json(normalized);
    } catch (error: any) {
        console.error("GET Error:", error.message);
        return json({ error: "Failed to fetch inventory" }, { status: 500 });
    }
}

// POST – Create product
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals }: RequestEvent) {
    try {
        if (!locals.user) {
            return json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await request.json();

        // ✅ Sanitize inputs
        const sanitized = {
            name: sanitizeString(body.name),
            brand: sanitizeString(body.brand),
            categoryId: body.categoryId ?? undefined,
            barcode: sanitizeString(body.barcode),
            color: sanitizeString(body.color) || '',
            size: sanitizeString(body.size) || '',
            price: sanitizeNumber(body.price),
            cost: sanitizeNumber(body.cost),
            quantity: sanitizeNumber(body.quantity)
        };

        // Validate input
        const validation = validateData(productCreateSchema, sanitized);
        if (!validation.success) {
            return json({ error: validation.errors?.join(', ') }, { status: 400 });
        }

        // const existing = await ProductService.checkDuplicate(validation.data!);
        // if (existing.length > 0) {
        //     return json({
        //         error: "This exact item already exists",
        //         existingId: existing[0].id
        //     }, { status: 409 });
        // }

        const userId = locals.user.id;
        const userName = locals.user.username;
        // Ensure all required fields are present and not undefined
        const productData = {
            name: sanitized.name || '',
            brand: sanitized.brand || '',
            categoryId: sanitized.categoryId,
            barcode: sanitized.barcode || '',
            color: sanitized.color,
            size: sanitized.size,
            price: sanitized.price,
            cost: sanitized.cost,
            quantity: sanitized.quantity
        };
        const inserted = await ProductService.createProduct(productData, userId, userName);

        return json(inserted, { status: 201 });

    } catch (error: any) {
        console.error("POST Error:", error);
        return json({ error: error.message }, { status: 500 });
    }
}

// PUT – Update/Restock
export async function PUT({ request, locals }: RequestEvent) {
    try {
        if (!locals.user) {
            return json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await request.json();
        const { id, action } = body;

        if (!id) return json({ error: "ID required" }, { status: 400 });

        const userId = locals.user.id;
        const userName = locals.user.username;

        if (action === 'RESTOCK') {
            const validation = validateData(restockSchema, body);
            if (!validation.success) {
                return json({ error: validation.errors?.join(', ') }, { status: 400 });
            }

            await ProductService.restockProduct(
                id,
                sanitizeNumber(validation.data!.quantity_to_add),
                sanitizeNumber(validation.data!.cost),
                userId,
                userName
            );
        } else {
            const validation = validateData(productUpdateSchema, body);
            if (!validation.success) {
                return json({ error: validation.errors?.join(', ') }, { status: 400 });
            }

            const { id: _, ...dataWithoutIdRaw } = validation.data!;
            // Ensure color and size are never null, only string or undefined
            const dataWithoutId = {
                ...dataWithoutIdRaw,
                color: dataWithoutIdRaw.color ?? '',
                size: dataWithoutIdRaw.size ?? ''
            };
            const duplicate = await ProductService.checkDuplicate(dataWithoutId as any, id);
            
            if (duplicate.length > 0) {
                return json({ error: "Duplicate product exists" }, { status: 409 });
            }

            await ProductService.updateProduct(id, dataWithoutId, userId, userName);
        }

        return json({ success: true });
    } catch (error: any) {
        console.error("PUT Error:", error.message);
        return json({ error: error.message }, { status: 500 });
    }
}

// DELETE
export async function DELETE({ url, locals }: RequestEvent) {
    try {
        if (!locals.user) {
            return json({ error: "Unauthorized" }, { status: 403 });
        }

        const productId = Number(url.searchParams.get('id'));

        if (!productId || isNaN(productId)) {
            return json({ error: "Invalid ID" }, { status: 400 });
        }

        await ProductService.deleteProduct(productId, locals.user.id, locals.user.username);

        return json({ success: true });
    } catch (error: any) {
        console.error("DELETE Error:", error.message);
        return json({ error: error.message }, { status: 500 });
    }
}