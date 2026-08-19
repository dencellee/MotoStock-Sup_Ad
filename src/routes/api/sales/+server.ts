import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sales, products } from '$lib/server/db/schema';
import { eq, desc, and, or, like, sql } from 'drizzle-orm';

// GET /api/sales
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ locals, url }: RequestEvent) {
    if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'staff')) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    const date = url?.searchParams?.get('date');
    const search = url?.searchParams?.get('search');

    let whereClause: any = sql`1 = 1`;

    // ✅ DATE FILTER (PostgreSQL)
    if (date) {
        whereClause = and(
            whereClause,
            sql`${sales.createdAt} >= ${date}::date 
                AND ${sales.createdAt} < ${date}::date + INTERVAL '1 day'`
        );
    }

    // ✅ SEARCH FILTER (fix types too)
    if (search) {
        const likeTerm = `%${search}%`;

        whereClause = and(
            whereClause,
            or(
                like(products.name, likeTerm),
                like(products.color, likeTerm),
                like(products.size, likeTerm),

                // ⚠️ IDs are numbers → cast to text
                sql`CAST(${sales.productId} AS TEXT) ILIKE ${likeTerm}`,
                sql`CAST(${sales.id} AS TEXT) ILIKE ${likeTerm}`
            )
        );
    }

    const result = await db.select({
        id: sales.id,
        productId: sales.productId,
        quantity: sales.quantity,
        totalPrice: sales.totalPrice,
        createdAt: sales.createdAt,
        productName: products.name,
        color: products.color,
        size: products.size
    })
    .from(sales)
    .leftJoin(products, eq(sales.productId, products.id))
    .where(whereClause)
    .orderBy(desc(sales.createdAt));

    return json(result);
}

