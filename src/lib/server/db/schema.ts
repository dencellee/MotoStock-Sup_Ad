import { pgTable, serial, varchar, integer, numeric, text, timestamp, index, uniqueIndex, boolean } from 'drizzle-orm/pg-core';

// Add 'super_admin' role for owner
export const userRoles = ['super_admin', 'admin', 'staff'] as const;
export type UserRole = typeof userRoles[number];

// USERS
export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 50 }).unique().notNull(),
    email: varchar('email', { length: 100 }).unique().notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().default('staff'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
    usernameIdx: index('users_username_idx').on(table.username),
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role)
}));

// CATEGORIES
export const categories = pgTable('categories', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).unique().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// PRODUCTS
export const products = pgTable('products', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    brand: varchar('brand', { length: 100 }).notNull(),
    categoryId: integer('category_id').notNull().references(() => categories.id),
    barcode: varchar('barcode', { length: 64 }).unique().notNull(),
    color: varchar('color', { length: 50 }).notNull().default(''),
    size: varchar('size', { length: 50 }).notNull().default(''),
    price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
    wholesalePrice: numeric('wholesale_price', { precision: 12, scale: 2 }),
    cost: numeric('cost', { precision: 12, scale: 2 }).notNull().default('0'),
    quantity: integer('quantity').notNull().default(0),
    archived: boolean('archived').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
    nameIdx: index('products_name_idx').on(table.name),
    brandIdx: index('products_brand_idx').on(table.brand),
    categoryIdx: index('products_category_idx').on(table.categoryId),
    barcodeIdx: index('products_barcode_idx').on(table.barcode),
    quantityIdx: index('products_quantity_idx').on(table.quantity),
    uniqueProductIdx: uniqueIndex('products_unique_idx').on(
        table.name,
        table.brand,
        table.categoryId,
        table.color,
        table.size
    )
}));

// SALES
export const paymentModes = ['CASH', 'GCASH', 'CARD', 'TERM'] as const;
export type PaymentMode = typeof paymentModes[number];

export const sales = pgTable('sales', {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id),
    quantity: integer('quantity').notNull().default(0),
    appliedPrice: numeric('applied_price', { precision: 12, scale: 2 }).notNull().default('0'),
    costAtSale: numeric('cost_at_sale', { precision: 12, scale: 2 }).notNull().default('0'),
    adjustment: numeric('adjustment', { precision: 12, scale: 2 }).notNull().default('0'),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
    paymentMode: varchar('payment_mode', { length: 20 }).notNull().default('CASH'),

    // Groups every sales row created in one checkout — used to join back
    // to sale_payments for SPLIT transactions, and generally useful for
    // receipts / audits that need "everything from this one checkout".
    transactionId: varchar('transaction_id', { length: 40 }),

    // Sale channel tracking (walk-in counter vs. online marketplace)
    saleChannel: varchar('sale_channel', { length: 20 }).notNull().default('walkin'),
    onlinePlatform: varchar('online_platform', { length: 20 }),

    // Term tracking (who owes, how much, and by when)
    customerName: varchar('customer_name', { length: 100 }),
    customerContact: varchar('customer_contact', { length: 50 }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
    balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
    settled: boolean('settled').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
    productIdx: index('sales_product_idx').on(table.productId),
    dateIdx: index('sales_date_idx').on(table.createdAt),
    paymentIdx: index('sales_payment_idx').on(table.paymentMode),
    channelIdx: index('sales_channel_idx').on(table.saleChannel),
    reportingIdx: index('sales_reporting_idx').on(table.createdAt, table.productId),
    settledIdx: index('sales_settled_idx').on(table.settled),
    dueDateIdx: index('sales_due_date_idx').on(table.dueDate),
    transactionIdx: index('sales_transaction_idx').on(table.transactionId)
}));

// SALE PAYMENTS — records the exact per-method breakdown for SPLIT
// transactions (e.g. ₱10 CASH + ₱10 GCASH). Decoupled from product
// quantity entirely, so it can represent any split, even on a
// single-item cart, without touching sales.quantity.
export const salePayments = pgTable('sale_payments', {
    id: serial('id').primaryKey(),
    transactionId: varchar('transaction_id', { length: 40 }).notNull(),
    paymentMode: varchar('payment_mode', { length: 20 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    transactionIdx: index('sale_payments_transaction_idx').on(table.transactionId),
    modeIdx: index('sale_payments_mode_idx').on(table.paymentMode)
}));

export const parkedSales = pgTable('parked_sales', {
    id: serial('id').primaryKey(),
    label: varchar('label', { length: 100 }), // optional note, e.g. customer name
    cartData: text('cart_data').notNull(),    // JSON string of cart items
    discount: numeric('discount', { precision: 5, scale: 2 }).notNull().default('0'),
    userId: integer('user_id').notNull().references(() => users.id),
    userName: varchar('user_name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// MECHANICS
export const mechanicStatus = ['active', 'inactive'] as const;

export const mechanics = pgTable('mechanics', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    contact: varchar('contact', { length: 50 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
    nameIdx: index('mechanics_name_idx').on(table.name),
    statusIdx: index('mechanics_status_idx').on(table.status)
}));

export const jobOrderStatus = ['open', 'paid', 'cancelled'] as const;

export const jobOrders = pgTable('job_orders', {
    id: serial('id').primaryKey(),
    jobNumber: varchar('job_number', { length: 20 }).unique().notNull(),
    customerName: varchar('customer_name', { length: 100 }).notNull(),
    customerContact: varchar('customer_contact', { length: 50 }),
    mechanicId: integer('mechanic_id').references(() => mechanics.id),
    mechanicName: varchar('mechanic_name', { length: 100 }),
    laborFee: numeric('labor_fee', { precision: 12, scale: 2 }).notNull().default('0'),
    discount: numeric('discount', { precision: 5, scale: 2 }).notNull().default('0'),
    laborFeeCollected: numeric('labor_fee_collected', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    notes: text('notes'),
    paymentMode: varchar('payment_mode', { length: 20 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
    mechanicIdx: index('job_orders_mechanic_idx').on(table.mechanicId),
    statusIdx: index('job_orders_status_idx').on(table.status)
}));

export const jobOrderItems = pgTable('job_order_items', {
    id: serial('id').primaryKey(),
    jobOrderId: integer('job_order_id').notNull().references(() => jobOrders.id),
    productId: integer('product_id').references(() => products.id),
    productName: varchar('product_name', { length: 100 }).notNull(), // snapshot
    color: varchar('color', { length: 50 }),
    size: varchar('size', { length: 50 }),

    quantity: integer('quantity').notNull(),
    appliedPrice: numeric('applied_price', { precision: 12, scale: 2 }).notNull(),
    costAtSale: numeric('cost_at_sale', { precision: 12, scale: 2 }).notNull(),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    jobOrderIdx: index('job_order_items_job_order_idx').on(table.jobOrderId)
}));

// EXPENSES
export const expenses = pgTable('expenses', {
    id: serial('id').primaryKey(),
    description: varchar('description', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    recipient: varchar('recipient', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
    categoryIdx: index('expenses_category_idx').on(table.category),
    dateIdx: index('expenses_date_idx').on(table.createdAt)
}));

// LOGS
export const logs = pgTable('logs', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id),
    userName: varchar('user_name', { length: 100 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    details: text('details'),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    userIdx: index('logs_user_idx').on(table.userId),
    actionIdx: index('logs_action_idx').on(table.action),
    timestampIdx: index('logs_timestamp_idx').on(table.timestamp)
}));

// INVENTORY LOGS
export const inventoryLogs = pgTable('inventory_logs', {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id),
    oldQuantity: integer('old_quantity').notNull().default(0),
    newQuantity: integer('new_quantity').notNull().default(0),
    changeAmount: integer('change_amount').notNull(),
    userId: integer('user_id').notNull().references(() => users.id),
    userName: varchar('user_name', { length: 100 }).notNull(),
    reason: varchar('reason', { length: 100 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    productIdx: index('inventory_logs_product_idx').on(table.productId),
    userIdx: index('inventory_logs_user_idx').on(table.userId),
    reasonIdx: index('inventory_logs_reason_idx').on(table.reason),
    dateIdx: index('inventory_logs_date_idx').on(table.createdAt)
}));

// LOGIN AUDIT LOG - Track super_admin login locations for monitoring
export const loginAuditLog = pgTable('login_audit_log', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id),
    username: varchar('username', { length: 50 }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(), // IPv4 + IPv6 compatible
    userAgent: text('user_agent'), // Browser/OS info
    status: varchar('status', { length: 20 }).notNull().default('success'), // 'success' or 'failed'
    reason: varchar('reason', { length: 100 }), // Failure reason if applicable
    loginTime: timestamp('login_time', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    userIdx: index('login_audit_user_idx').on(table.userId),
    ipIdx: index('login_audit_ip_idx').on(table.ipAddress),
    timeIdx: index('login_audit_time_idx').on(table.loginTime),
    statusIdx: index('login_audit_status_idx').on(table.status)
}));