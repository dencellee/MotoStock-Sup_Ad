import { pgTable, serial, varchar, integer, numeric, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

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
}, (table) => ({
    nameIdx: uniqueIndex('categories_name_idx').on(table.name)
}));

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
    cost: numeric('cost', { precision: 12, scale: 2 }).notNull().default('0'),
    quantity: integer('quantity').notNull().default(0),
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
export const sales = pgTable('sales', {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id),
    quantity: integer('quantity').notNull().default(0),
    appliedPrice: numeric('applied_price', { precision: 12, scale: 2 }).notNull().default('0'),
    costAtSale: numeric('cost_at_sale', { precision: 12, scale: 2 }).notNull().default('0'),
    adjustment: numeric('adjustment', { precision: 12, scale: 2 }).notNull().default('0'),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
    paymentMode: varchar('payment_mode', { length: 20 }).notNull().default('CASH'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
    productIdx: index('sales_product_idx').on(table.productId),
    dateIdx: index('sales_date_idx').on(table.createdAt),
    paymentIdx: index('sales_payment_idx').on(table.paymentMode),
    reportingIdx: index('sales_reporting_idx').on(table.createdAt, table.productId)
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
    userId: integer('user_id').notNull().references(() => users.id),       // ← fix
    userName: varchar('user_name', { length: 100 }).notNull(),              // ← fix
    action: varchar('action', { length: 100 }).notNull(),
    details: text('details'),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), // ← fix
}, (table) => ({
    userIdx: index('logs_user_idx').on(table.userId),       // ← fix
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