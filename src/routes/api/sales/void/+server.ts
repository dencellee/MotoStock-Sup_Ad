import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sales, products, logs } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals }: RequestEvent) {
    if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'staff')) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { saleId, voidReason, voidQuantity } = await request.json();

        if (!saleId || !voidReason || !voidQuantity) {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (voidQuantity <= 0) {
            return json({ error: 'Void quantity must be greater than 0' }, { status: 400 });
        }

        // Get sale
        const sale = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
        if (sale.length === 0) {
            return json({ error: 'Sale not found' }, { status: 404 });
        }

        const saleRecord = sale[0];

        // ✅ Fix: convert numeric strings to numbers first
        const totalPrice = Number(saleRecord.totalPrice);
        const saleQty    = Number(saleRecord.quantity);

        if (voidQuantity > saleQty) {
            return json({ error: `Cannot void more than sold quantity (${saleQty})` }, { status: 400 });
        }

        // Get product
        const product = await db.select().from(products).where(eq(products.id, saleRecord.productId)).limit(1);
        if (product.length === 0) {
            return json({ error: 'Product not found' }, { status: 404 });
        }

        const productRecord = product[0];

        // ✅ Fix: all arithmetic uses Number() converted values
        const voidPricePer  = totalPrice / saleQty;
        const voidTotalPrice = voidPricePer * voidQuantity;
        const voidCostPer   = Number(productRecord.cost ?? 0) * voidQuantity;

        const user = locals.user; // ✅ fix: destructure to avoid null complaints

        await db.transaction(async (tx) => {
            // 1. Return stock
            await tx.update(products)
                .set({ 
                    quantity: sql`${products.quantity} + ${voidQuantity}`, // ✅ use column ref not raw string
                    updatedAt: new Date()
                })
                .where(eq(products.id, saleRecord.productId));

            // 2. Delete or partial void
            if (voidQuantity === saleQty) {
                // Full void — delete the sale record
                await tx.delete(sales).where(eq(sales.id, saleId));
            } else {
                // Partial void — reduce quantity and recalculate total
                const remainingQty        = saleQty - voidQuantity;
                const remainingTotalPrice = voidPricePer * remainingQty;
                await tx.update(sales)
                    .set({
                        quantity:   remainingQty,
                        totalPrice: String(remainingTotalPrice) // ✅ numeric columns need strings
                    })
                    .where(eq(sales.id, saleId));
            }

            // 3. Log the void
            await tx.insert(logs).values({
                userId:    user.id,
                userName:  user.username || 'Unknown',
                action:    'VOID_SALE',
                details:   `Voided sale #${saleId} - Qty: ${voidQuantity}, Revenue: ₱${voidTotalPrice.toFixed(2)}, Cost: ₱${voidCostPer.toFixed(2)}, Reason: ${voidReason}`,
                timestamp: new Date(),
                createdAt: new Date()
            });
        });

        return json({
            success: true,
            message: `Sale #${saleId} voided. Stock +${voidQuantity}, Revenue -₱${voidTotalPrice.toFixed(2)}`
        });

    } catch (err: any) {
        console.error('[void] Error:', err);
        return json({ error: err.message || 'Failed to void sale' }, { status: 500 });
    }
}