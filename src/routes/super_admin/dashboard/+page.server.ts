import { db } from '$lib/server/db';
import { products, sales, salePayments, expenses, jobOrders, jobOrderItems } from '$lib/server/db/schema';
import { eq, sql, desc, lte, asc, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
    const filter = url.searchParams.get('filter') || 'daily';
    const now = new Date();

    let metricStart = new Date();
    let prevStart = new Date();
    let prevEnd = new Date();
    let chartSql: any;

    // Unpaid Term sales aren't collected yet — exclude from every revenue query
    const paidOnly = sql`(${sales.paymentMode} != 'TERM' OR ${sales.settled} = true)`;

    // 1. SET TIME BOUNDARIES
    if (filter === 'daily') {
        metricStart.setHours(0, 0, 0, 0);
        prevStart = new Date(metricStart);
        prevStart.setDate(metricStart.getDate() - 1);
        prevEnd = new Date(metricStart);
        chartSql = sql`to_char(${sales.createdAt}, 'HH24:00')`;

    } else if (filter === 'weekly') {
        const dayOfWeek = now.getDay();
        metricStart.setDate(now.getDate() - dayOfWeek);
        metricStart.setHours(0, 0, 0, 0);
        prevStart = new Date(metricStart);
        prevStart.setDate(metricStart.getDate() - 7);
        prevEnd = new Date(metricStart);
        chartSql = sql`to_char(${sales.createdAt}, 'MM/DD')`;

    } else if (filter === 'monthly') {
        metricStart = new Date(now.getFullYear(), now.getMonth(), 1);
        prevStart = new Date(metricStart);
        prevStart.setMonth(metricStart.getMonth() - 1);
        prevEnd = new Date(metricStart);
        chartSql = sql`floor((extract(day from ${sales.createdAt}) - 1) / 7) + 1`;

    } else {
        // yearly — Jan 1 of this year through now, trend grouped by month
        metricStart = new Date(now.getFullYear(), 0, 1);
        prevStart = new Date(now.getFullYear() - 1, 0, 1);
        prevEnd = new Date(metricStart);
        chartSql = sql`to_char(${sales.createdAt}, 'Mon')`;
    }

    const metricStartDate = new Date(metricStart.getTime());
    const pStartDate = new Date(prevStart.getTime());
    const pEndDate = new Date(prevEnd.getTime());

    // 2. FETCH ALL DATA IN PARALLEL (BATCHED)
    let metrics: any[], prev: any[], exp: any[], prevExp: any[];
    let lowStock: any[], topSellers: any[], payments: any[];
    let trends: any[], splitBreakdown: any[];
    let openJobOrders: any[], jobOrderRevenue: any[];

    [metrics, prev, exp, prevExp] = await Promise.all([

        db.select({
            gross: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`,
            cogs: sql<number>`COALESCE(SUM(${sales.costAtSale} * ${sales.quantity}), 0)`,
            units: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`
        })
            .from(sales)
            .where(and(
                sql`${sales.createdAt} >= ${metricStartDate}`,
                paidOnly
            )),

        db.select({
            gross: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`
        })
            .from(sales)
            .where(and(
                sql`${sales.createdAt} >= ${pStartDate}`,
                sql`${sales.createdAt} < ${pEndDate}`,
                paidOnly
            )),

        db.select({
            total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
        })
            .from(expenses)
            .where(sql`${expenses.createdAt} >= ${metricStartDate}`),

        db.select({
            total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
        })
            .from(expenses)
            .where(and(
                sql`${expenses.createdAt} >= ${pStartDate}`,
                sql`${expenses.createdAt} < ${pEndDate}`
            ))
    ]);

    [lowStock, topSellers, payments] = await Promise.all([

        db.select({
            name: products.name,
            brand: products.brand,
            color: products.color,
            size: products.size,
            stock: products.quantity
        })
            .from(products)
            .where(lte(products.quantity, 5))
            .orderBy(asc(products.quantity)),

        // Top 10 selling products
        db.select({
            name: sql<string>`COALESCE(${products.name}, 'Unknown')`,
            sold: sql<number>`SUM(${sales.quantity})`,
            revenue: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`
        })
            .from(sales)
            .leftJoin(products, eq(sales.productId, products.id))
            .where(and(
                sql`${sales.createdAt} >= ${metricStartDate}`,
                paidOnly
            ))
            .groupBy(products.name)
            .orderBy(desc(sql`SUM(${sales.quantity})`))
            .limit(10),

        db.select({
            mode: sales.paymentMode,
            total: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`,
            count: sql<number>`COUNT(*)`
        })
            .from(sales)
            .where(and(
                sql`${sales.createdAt} >= ${metricStartDate}`,
                paidOnly
            ))
            .groupBy(sales.paymentMode)
    ]);

    [trends, splitBreakdown, openJobOrders, jobOrderRevenue] = await Promise.all([

        db.select({
            label: chartSql,
            revenue: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`,
            cogs: sql<number>`COALESCE(SUM(${sales.costAtSale} * ${sales.quantity}), 0)`,
            units: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`
        })
            .from(sales)
            .where(and(
                sql`${sales.createdAt} >= ${metricStartDate}`,
                paidOnly
            ))
            .groupBy(sql`1`)
            .orderBy(asc(sql`MIN(${sales.createdAt})`)),

        db.select({
            mode: salePayments.paymentMode,
            total: sql<number>`COALESCE(SUM(${salePayments.amount}), 0)`,
            count: sql<number>`COUNT(*)`
        })
            .from(salePayments)
            .innerJoin(sales, eq(sales.transactionId, salePayments.transactionId))
            .where(and(
                sql`${sales.createdAt} >= ${metricStartDate}`,
                eq(sales.paymentMode, 'SPLIT')
            ))
            .groupBy(salePayments.paymentMode),

        db.select({
            count: sql<number>`COUNT(*)`,
            oldestDate: sql<string>`MIN(${jobOrders.createdAt})`
        })
            .from(jobOrders)
            .where(eq(jobOrders.status, 'open')),

        db.select({
            outstanding: sql<number>`COALESCE(SUM(${jobOrderItems.totalPrice}),0)`
        })
            .from(jobOrderItems)
            .innerJoin(jobOrders, eq(jobOrderItems.jobOrderId, jobOrders.id))
            .where(eq(jobOrders.status, 'open'))
    ]);

    // 3. GAP FILLING
    type TrendItem = { label: string | null; revenue: number; cogs: number; units: number };
    const finalLabels: string[] = [];
    const finalRevenue: number[] = [];
    const finalCogs: number[] = [];
    const finalUnits: number[] = [];

    if (filter === 'daily') {
        const currentHour = now.getHours();
        for (let i = 0; i <= currentHour; i++) {
            const label = `${i.toString().padStart(2, '0')}:00`;
            const match = trends.find((t: TrendItem) => String(t.label).trim() === label);
            finalLabels.push(label);
            finalRevenue.push(match ? Number(match.revenue) : 0);
            finalCogs.push(match ? Number(match.cogs) : 0);
            finalUnits.push(match ? Number(match.units) : 0);
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
            finalCogs.push(match ? Number(match.cogs) : 0);
            finalUnits.push(match ? Number(match.units) : 0);
        }

    } else if (filter === 'monthly') {
        const monthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(now);
        const currentWeek = Math.floor((now.getDate() - 1) / 7) + 1;
        for (let i = 1; i <= currentWeek; i++) {
            const label = `${monthName} Week ${i}`;
            const match = trends.find((t: TrendItem) => Number(t.label) === i);
            finalLabels.push(label);
            finalRevenue.push(match ? Number(match.revenue) : 0);
            finalCogs.push(match ? Number(match.cogs) : 0);
            finalUnits.push(match ? Number(match.units) : 0);
        }

    } else {
        // yearly
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = now.getMonth();
        for (let i = 0; i <= currentMonth; i++) {
            const label = monthNames[i];
            const match = trends.find((t: TrendItem) => String(t.label).trim() === label);
            finalLabels.push(label);
            finalRevenue.push(match ? Number(match.revenue) : 0);
            finalCogs.push(match ? Number(match.cogs) : 0);
            finalUnits.push(match ? Number(match.units) : 0);
        }
    }

    // 4. COMPUTE SUMMARY STATS
    const curS = Number(metrics[0]?.gross ?? 0);
    const preS = Number(prev[0]?.gross ?? 0);
    const curE = Number(exp[0]?.total ?? 0);
    const preE = Number(prevExp[0]?.total ?? 0);
    const cogs = Number(metrics[0]?.cogs ?? 0);

    const grossProfit = curS - cogs;
    const netProfit = grossProfit - curE;
    const grossMargin = curS > 0 ? parseFloat(((grossProfit / curS) * 100).toFixed(1)) : 0;
    const netMargin = curS > 0 ? parseFloat(((netProfit / curS) * 100).toFixed(1)) : 0;

    const getPct = (c: number, p: number) =>
        p === 0 ? 0 : parseFloat((((c - p) / p) * 100).toFixed(1));

    const NON_SPLIT_MODES = ['CASH', 'GCASH', 'BANK', 'CARD', 'TikTok', 'Shopee', 'Lazada'];
    const baseBreakdown = payments.filter((p: any) => NON_SPLIT_MODES.includes(p.mode));

    const breakdownMap = new Map<string, { mode: string; total: number; count: number }>();
    for (const p of baseBreakdown) {
        breakdownMap.set(p.mode, { mode: String(p.mode), total: Number(p.total), count: Number(p.count) });
    }
    for (const s of splitBreakdown) {
        const mode = String(s.mode);
        const existing = breakdownMap.get(mode);
        if (existing) {
            existing.total += Number(s.total);
            existing.count += Number(s.count);
        } else {
            breakdownMap.set(mode, { mode, total: Number(s.total), count: Number(s.count) });
        }
    }
    const mergedPaymentBreakdown = Array.from(breakdownMap.values());

    const openJobCount = Number(openJobOrders[0]?.count ?? 0);
    const oldestOpenDate = openJobOrders[0]?.oldestDate ?? null;
    const outstanding = Number(jobOrderRevenue[0]?.outstanding ?? 0);

    return {
        activeFilter: filter,
        stats: {
            totalSales: curS,
            salesChange: getPct(curS, preS),
            totalUnits: Number(metrics[0]?.units ?? 0),
            stockCost: cogs,
            grossProfit,
            grossMargin,
            shopExpenses: curE,
            expChange: getPct(curE, preE),
            netProfit,
            netMargin,
            lowStockCount: lowStock.length
        },
        jobOrderStats: {
            openCount: openJobCount,
            outstanding,
            oldestOpenDate: oldestOpenDate ? new Date(oldestOpenDate).toISOString() : null
        },
        lowStockItems: lowStock,
        topSellingProducts: topSellers.map((x: any) => ({
            name: String(x.name),
            sold: Number(x.sold),
            revenue: Number(x.revenue)
        })),
        paymentBreakdown: mergedPaymentBreakdown.map((x: any) => ({
            mode: String(x.mode),
            total: Number(x.total),
            count: Number(x.count)
        })),
        chartData: {
            labels: finalLabels,
            revenue: finalRevenue,
            expenses: finalCogs,
            units: finalUnits
        }
    };
};