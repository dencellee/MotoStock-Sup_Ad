import { db } from '$lib/server/db/index';
import { sales, products } from '$lib/server/db/schema';
import { sql, desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types.js';

const ROWS_PER_PAGE = 50;

export const load: PageServerLoad = async ({ url }) => {

    const now = new Date();
    const targetDate = url.searchParams.get('date')
        || now.toISOString().split('T')[0];
    const view = url.searchParams.get('view') || 'daily';
    const printMode = url.searchParams.get('print') === '1';
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);


    const searchQuery = (url.searchParams.get('search') || '').trim();
    const hourStart = Math.max(0, Math.min(23, Number(url.searchParams.get('hourStart') ?? 0)));
    const hourEnd = Math.max(0, Math.min(23, Number(url.searchParams.get('hourEnd') ?? 23)));
    const hourFilterActive = hourStart !== 0 || hourEnd !== 23;

    // Unpaid Term sales don't count as revenue until they're actually collected
    const excludeUnpaidTerm = sql`(${sales.paymentMode} != 'TERM' OR ${sales.settled} = true)`;

    // Hour-of-day filter, evaluated in Philippine local time
    const hourCondition = hourFilterActive
        ? sql`EXTRACT(HOUR FROM (${sales.createdAt} AT TIME ZONE 'Asia/Manila')) BETWEEN ${hourStart} AND ${hourEnd}`
        : sql`1=1`;

    // Product name search
    const searchCondition = searchQuery
        ? sql`${products.name} ILIKE ${'%' + searchQuery + '%'}`
        : sql`1=1`;

    // Sales filter (voided support currently disabled)
    let salesCondition: any = sql`1=1`;
    let dateRangeLabel = '';
    if (view === 'daily') {
        salesCondition = sql`DATE(${sales.createdAt}) = ${targetDate}`;
        dateRangeLabel = new Date(targetDate).toLocaleDateString('en-PH', { dateStyle: 'full' });
    } else if (view === 'weekly') {
        salesCondition = sql`${sales.createdAt} >= ${targetDate}::date - INTERVAL '6 days'
AND ${sales.createdAt} < (${targetDate}::date + INTERVAL '1 day')`;
        const end = new Date(targetDate);
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        dateRangeLabel = `${start.toLocaleDateString('en-PH', { dateStyle: 'medium' })} - ${end.toLocaleDateString('en-PH', { dateStyle: 'medium' })}`;
    } else if (view === 'monthly') {
        salesCondition = sql`DATE_TRUNC('month', ${sales.createdAt}) = DATE_TRUNC('month', ${targetDate}::date)`;
        const d = new Date(targetDate);
        dateRangeLabel = d.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
    } else if (view === 'allTime') {
        salesCondition = sql`1=1`;
        dateRangeLabel = 'All Time';
    }

    if (hourFilterActive) {
        dateRangeLabel += ` · ${String(hourStart).padStart(2, '0')}:00–${String(hourEnd).padStart(2, '0')}:59`;
    }

    // Apply all filters together
    salesCondition = sql`(${salesCondition}) AND ${excludeUnpaidTerm} AND ${hourCondition} AND ${searchCondition}`;

    // Helper to generate a stats query — always excludes unpaid Term sales,
    // and respects the hour/search filters too
    const getStatsQuery = (condition: any) => {
        return db.select({
            total: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`,
            count: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`,
            totalDiscount: sql<number>`COALESCE(SUM(${sales.adjustment}), 0)`
        })
            .from(sales)
            .leftJoin(products, eq(sales.productId, products.id))
            .where(sql`(${condition}) AND ${excludeUnpaidTerm} AND ${hourCondition} AND ${searchCondition}`);
    };

    try {
        const recentSalesQuery = db.select({
            id: sales.id,
            productName: products.name,
            color: products.color,
            size: products.size,
            quantity: sales.quantity,
            adjustment: sales.adjustment,
            appliedPrice: sales.appliedPrice,
            costAtSale: sales.costAtSale,
            paymentMode: sales.paymentMode,
            totalPrice: sales.totalPrice,
            createdAt: sales.createdAt
        })
            .from(sales)
            .leftJoin(products, eq(sales.productId, products.id))
            .where(salesCondition)
            .orderBy(desc(sales.createdAt));

        const dailyRes = await getStatsQuery(
            sql`DATE(${sales.createdAt}) = ${targetDate}::date`
        );

        const weeklyRes = await getStatsQuery(
            sql`${sales.createdAt} >= ${targetDate}::date - INTERVAL '6 days'
        AND ${sales.createdAt} < ${targetDate}::date + INTERVAL '1 day'`
        );

        const monthlyRes = await getStatsQuery(
            sql`DATE_TRUNC('month', ${sales.createdAt}) = DATE_TRUNC('month', ${targetDate}::date)`
        );

        const allTimeRes = await getStatsQuery(sql`1=1`);

        // Payment method breakdown for the currently selected view/date/hour/
        // search filters — same salesCondition that backs the recentSales
        // list and the active view's card, so totals always match what's on
        // screen regardless of "Load More" pagination.
        const paymentTotalsQuery = db.select({
            paymentMode: sales.paymentMode,
            total: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`,
            count: sql<number>`COUNT(*)`
        })
            .from(sales)
            .leftJoin(products, eq(sales.productId, products.id))
            .where(salesCondition)
            .groupBy(sales.paymentMode);

        const [recentSales, totalCount, paymentTotals] = await Promise.all([
            printMode
                ? recentSalesQuery
                : recentSalesQuery,

            db.select({
                count: sql<number>`COUNT(*)`
            })
                .from(sales)
                .leftJoin(products, eq(sales.productId, products.id))
                .where(salesCondition),

            paymentTotalsQuery
        ]);

        const totalPages = Math.max(1, Math.ceil((((totalCount?.[0]?.count ?? 0)) / ROWS_PER_PAGE)));

        return {
            targetDate,
            view,
            printMode,
            dateRangeLabel,
            page,
            totalPages,
            searchQuery,
            hourStart,
            hourEnd,
            stats: {
                daily: dailyRes ?? { total: 0, count: 0, totalDiscount: 0 },
                weekly: weeklyRes ?? { total: 0, count: 0, totalDiscount: 0 },
                monthly: monthlyRes ?? { total: 0, count: 0, totalDiscount: 0 },
                allTime: allTimeRes ?? { total: 0, count: 0, totalDiscount: 0 }
            },
            recentSales: recentSales ?? [],
            paymentTotals: paymentTotals ?? []
        };
    } catch (err) {
        console.error('❌ Reports Load Error:', err);
        return {
            targetDate,
            page,
            printMode,
            totalPages: 1,
            searchQuery,
            hourStart,
            hourEnd,
            stats: {
                daily: { total: 0, count: 0, totalDiscount: 0 },
                weekly: { total: 0, count: 0, totalDiscount: 0 },
                monthly: { total: 0, count: 0, totalDiscount: 0 },
                allTime: { total: 0, count: 0, totalDiscount: 0 }
            },
            recentSales: [],
            paymentTotals: []
        };
    }
};