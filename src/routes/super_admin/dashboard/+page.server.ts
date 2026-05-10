import { db } from '$lib/server/db';
import { products, sales, expenses } from '$lib/server/db/schema';
import { eq, sql, desc, lte, asc, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
    const filter = url.searchParams.get('filter') || 'daily';
    const now = new Date();

    let metricStart = new Date();
    let prevStart = new Date();
    let prevEnd = new Date();
    let chartSql: any;

    // 1. SET TIME BOUNDARIES
    if (filter === 'daily') {
        metricStart.setHours(0, 0, 0, 0);
        prevStart = new Date(metricStart);
        prevStart.setDate(metricStart.getDate() - 1);
        prevEnd = new Date(metricStart);
        // Postgres: format hour as HH24:00
        chartSql = sql`to_char(${sales.createdAt}, 'HH24:00')`;

    } else if (filter === 'weekly') {
        const dayOfWeek = now.getDay();
        metricStart.setDate(now.getDate() - dayOfWeek);
        metricStart.setHours(0, 0, 0, 0);
        prevStart = new Date(metricStart);
        prevStart.setDate(metricStart.getDate() - 7);
        prevEnd = new Date(metricStart);
        // Postgres: format as MM/DD
        chartSql = sql`to_char(${sales.createdAt}, 'MM/DD')`;

    } else if (filter === 'monthly') {
        metricStart = new Date(now.getFullYear(), now.getMonth(), 1);
        prevStart = new Date(metricStart);
        prevStart.setMonth(metricStart.getMonth() - 1);
        prevEnd = new Date(metricStart);
        // Postgres: week number within month
        chartSql = sql`floor((extract(day from ${sales.createdAt}) - 1) / 7) + 1`;

    } else {
        // All time
        metricStart = new Date(0);
        prevStart = new Date(0);
        prevEnd = new Date(0);
        // Postgres: format as YYYY-MM
        chartSql = sql`to_char(${sales.createdAt}, 'YYYY-MM')`;
    }

    const metricStartDate = new Date(metricStart.getTime());
    const pStartDate = new Date(prevStart.getTime());
    const pEndDate = new Date(prevEnd.getTime());

    // 2. FETCH ALL DATA IN PARALLEL
    const [metrics, prev, exp, prevExp, lowStock, topSellers, payments, trends] = await Promise.all([

        // Current period: gross revenue + COGS
        db.select({
            gross: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`,
            cogs:  sql<number>`COALESCE(SUM(${sales.costAtSale} * ${sales.quantity}), 0)`
        })
        .from(sales)
        .where(sql`${sales.createdAt} >= ${metricStartDate}`),

        // Previous period: gross revenue
        db.select({
            gross: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`
        })
        .from(sales)
        .where(and(
            sql`${sales.createdAt} >= ${pStartDate}`,
            sql`${sales.createdAt} < ${pEndDate}`
        )),

        // Current period: expenses
        db.select({
            total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
        })
        .from(expenses)
        .where(sql`${expenses.createdAt} >= ${metricStartDate}`),

        // Previous period: expenses
        db.select({
            total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
        })
        .from(expenses)
        .where(and(
            sql`${expenses.createdAt} >= ${pStartDate}`,
            sql`${expenses.createdAt} < ${pEndDate}`
        )),

        // Low stock items (quantity <= 5)
        db.select({
            name:  products.name,
            color: products.color,
            size:  products.size,
            stock: products.quantity
        })
        .from(products)
        .where(lte(products.quantity, 5))
        .orderBy(asc(products.quantity)),

        // Top 5 selling products
        db.select({
            name: sql<string>`COALESCE(${products.name}, 'Unknown')`,
            sold: sql<number>`SUM(${sales.quantity})`
        })
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .where(sql`${sales.createdAt} >= ${metricStartDate}`)
        .groupBy(products.name)                          // ✅ explicit groupBy
        .orderBy(desc(sql`SUM(${sales.quantity})`))
        .limit(5),

        // Payment mode breakdown
        db.select({
            mode:  sales.paymentMode,
            total: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`
        })
        .from(sales)
        .where(sql`${sales.createdAt} >= ${metricStartDate}`)
        .groupBy(sales.paymentMode),

        // Chart trend data
        db.select({
            label:   chartSql,
            revenue: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`,
            cogs:    sql<number>`COALESCE(SUM(${sales.costAtSale} * ${sales.quantity}), 0)`,
            units:   sql<number>`COALESCE(SUM(${sales.quantity}), 0)`
        })
        .from(sales)
        .where(sql`${sales.createdAt} >= ${metricStartDate}`)
        .groupBy(sql`1`)
        .orderBy(asc(sql`MIN(${sales.createdAt})`))
    ]);

    // 3. GAP FILLING — ensure every time slot has a value (even if 0)
    type TrendItem = { label: string | null; revenue: number; cogs: number; units: number };
    const finalLabels:  string[] = [];
    const finalRevenue: number[] = [];
    const finalCogs:    number[] = [];
    const finalUnits:   number[] = [];

    if (filter === 'daily') {
        const currentHour = now.getHours();
        for (let i = 0; i <= currentHour; i++) {
            const label = `${i.toString().padStart(2, '0')}:00`;
            const match = trends.find((t: TrendItem) => String(t.label).trim() === label);
            finalLabels.push(label);
            finalRevenue.push(match ? Number(match.revenue) : 0);
            finalCogs.push(match   ? Number(match.cogs)    : 0);
            finalUnits.push(match  ? Number(match.units)   : 0);
        }

    } else if (filter === 'weekly') {
        const todayIndex = now.getDay();
        for (let i = 0; i <= todayIndex; i++) {
            const date = new Date(metricStart);
            date.setDate(metricStart.getDate() + i);
            const label = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
            const match = trends.find((t: TrendItem) => String(t.label).trim() === label);
            finalLabels.push(label);
            finalRevenue.push(match ? Number(match.revenue) : 0);
            finalCogs.push(match   ? Number(match.cogs)    : 0);
            finalUnits.push(match  ? Number(match.units)   : 0);
        }

    } else if (filter === 'monthly') {
        const monthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(now);
        const currentWeek = Math.floor((now.getDate() - 1) / 7) + 1;
        for (let i = 1; i <= currentWeek; i++) {
            const label = `${monthName} Week ${i}`;
            const match = trends.find((t: TrendItem) => Number(t.label) === i);
            finalLabels.push(label);
            finalRevenue.push(match ? Number(match.revenue) : 0);
            finalCogs.push(match   ? Number(match.cogs)    : 0);
            finalUnits.push(match  ? Number(match.units)   : 0);
        }

    } else {
        // All time — use raw labels from DB
        for (const t of trends as TrendItem[]) {
            finalLabels.push(String(t.label ?? ''));
            finalRevenue.push(Number(t.revenue) || 0);
            finalCogs.push(Number(t.cogs)       || 0);
            finalUnits.push(Number(t.units)     || 0);
        }
    }

    // 4. COMPUTE SUMMARY STATS
    const curS  = Number(metrics[0]?.gross ?? 0);
    const preS  = Number(prev[0]?.gross    ?? 0);
    const curE  = Number(exp[0]?.total     ?? 0);
    const preE  = Number(prevExp[0]?.total ?? 0);
    const cogs  = Number(metrics[0]?.cogs  ?? 0);

    const getPct = (c: number, p: number) =>
        p === 0 ? 0 : parseFloat((((c - p) / p) * 100).toFixed(1));

    return {
        activeFilter: filter,
        stats: {
            totalSales:    curS,
            salesChange:   getPct(curS, preS),
            stockCost:     cogs,
            shopExpenses:  curE,
            expChange:     getPct(curE, preE),
            netProfit:     curS - cogs - curE,
            lowStockCount: lowStock.length
        },
        lowStockItems: lowStock,
        topSellingProducts: topSellers.map((x: { name: string; sold: number }) => ({
            name: String(x.name),
            sold: Number(x.sold)
        })),
        paymentBreakdown: payments.map((x: { mode: string; total: number }) => ({
            mode:  String(x.mode),
            total: Number(x.total)
        })),
        chartData: {
            labels:   finalLabels,
            revenue:  finalRevenue,
            expenses: finalCogs,
            units:    finalUnits
        }
    };
};