// import { sqliteTable, text, integer, index, uniqueIndex, real } from 'drizzle-orm/sqlite-core';
// import { sql } from "drizzle-orm";

// export const userRoles = ['admin', 'staff'] as const;

// export const users = sqliteTable('users', {
//     id: integer('id').primaryKey({ autoIncrement: true }),
//     username: text('username').unique().notNull(),
//     email: text('email').unique().notNull(),
//     passwordHash: text('password_hash').notNull(),
//     role: text('role').notNull().default('staff'),
//     createdAt: integer('created_at', { mode: 'timestamp' })
//         .notNull()
//         .default(sql`(strftime('%s','now'))`),
//     updatedAt: integer('updated_at', { mode: 'timestamp' })
// }, (table) => ({
//     usernameIdx: index('users_username_idx').on(table.username),
//     emailIdx: index('users_email_idx').on(table.email),
//     roleIdx: index('users_role_idx').on(table.role)
// }));

// export const categories = sqliteTable('categories', {
//     id: integer('id').primaryKey({ autoIncrement: true }),
//     name: text('name').notNull().unique(),
//     createdAt: integer('created_at', { mode: 'timestamp' })
//         .notNull()
//         .default(sql`(strftime('%s','now'))`),
//     updatedAt: integer('updated_at', { mode: 'timestamp' })
// }, (table) => ({
//     nameIdx: uniqueIndex('categories_name_idx').on(table.name)
// }));

// export const products = sqliteTable('products', {
//     id: integer('id').primaryKey({ autoIncrement: true }),
//     name: text('name').notNull(),
//     brand: text('brand').notNull(),
//     categoryId: integer('category_id')
//         .notNull()
//         .references(() => categories.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
//     color: text('color'),
//     size: text('size'),
//     price: real('price').notNull().default(0),
//     cost: real('cost').notNull().default(0),
//     quantity: integer('quantity').notNull().default(0),
//     createdAt: integer('created_at', { mode: 'timestamp' })
//         .notNull()
//         .default(sql`(strftime('%s', 'now'))`),
//     updatedAt: integer('updated_at', { mode: 'timestamp' })
// }, (table) => ({
//     nameIdx: index('products_name_idx').on(table.name),
//     brandIdx: index('products_brand_idx').on(table.brand),
//     categoryIdx: index('products_category_idx').on(table.categoryId),
//     quantityIdx: index('products_quantity_idx').on(table.quantity),
//     uniqueProductIdx: uniqueIndex('products_unique_idx').on(
//         table.name, 
//         table.brand, 
//         table.categoryId, 
//         table.color, 
//         table.size
//     )
// }));

// export const sales = sqliteTable('sales', {
//     id: integer('id').primaryKey({ autoIncrement: true }),
//     productId: integer('product_id')
//         .notNull()
//         .references(() => products.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
//     quantity: integer('quantity').notNull().default(0),
//     appliedPrice: real('applied_price').notNull().default(0),
//     costAtSale: real('cost_at_sale').notNull().default(0),
//     adjustment: real('adjustment').notNull().default(0),
//     totalPrice: real('total_price').notNull(),
//     paymentMode: text('payment_mode').notNull().default('CASH'),
//     createdAt: integer('created_at', { mode: 'timestamp' })
//         .notNull()
//         .default(sql`(strftime('%s', 'now'))`),
//     updatedAt: integer('updated_at', { mode: 'timestamp' })
// }, (table) => ({
//     productIdx: index('sales_product_idx').on(table.productId),
//     dateIdx: index('sales_date_idx').on(table.createdAt),
//     paymentIdx: index('sales_payment_idx').on(table.paymentMode),
//     reportingIdx: index('sales_reporting_idx').on(table.createdAt, table.productId)
// }));

// export const expenses = sqliteTable('expenses', {
//     id: integer('id').primaryKey({ autoIncrement: true }),
//     description: text('description').notNull(),
//     category: text('category').notNull(),
//     amount: real('amount').notNull(),
//     recipient: text('recipient').notNull(),
//     createdAt: integer('created_at', { mode: 'timestamp' })
//         .notNull()
//         .default(sql`(strftime('%s', 'now'))`),
//     updatedAt: integer('updated_at', { mode: 'timestamp' })
// }, (table) => ({
//     categoryIdx: index('expenses_category_idx').on(table.category),
//     dateIdx: index('expenses_date_idx').on(table.createdAt)
// }));

// export const logs = sqliteTable('logs', {
//     id: integer('id').primaryKey({ autoIncrement: true }),
//     userId: integer('user_id')
//         .notNull()
//         .references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
//     userName: text('user_name').notNull(),
//     action: text('action').notNull(),
//     details: text('details'),
//     timestamp: integer('timestamp', { mode: 'timestamp' })
//         .notNull()
//         .default(sql`(strftime('%s', 'now'))`),
//     createdAt: integer('created_at', { mode: 'timestamp' })
//         .notNull()
//         .default(sql`(strftime('%s', 'now'))`)
// }, (table) => ({
//     userIdx: index('logs_user_idx').on(table.userId),
//     actionIdx: index('logs_action_idx').on(table.action),
//     timestampIdx: index('logs_timestamp_idx').on(table.timestamp)
// }));

// export const inventoryLogs = sqliteTable('inventory_logs', {
//     id: integer('id').primaryKey({ autoIncrement: true }),
//     productId: integer('product_id')
//         .notNull()
//         .references(() => products.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
//     oldQuantity: integer('old_quantity').notNull().default(0),
//     newQuantity: integer('new_quantity').notNull().default(0),
//     changeAmount: integer('change_amount').notNull(),
//     userId: integer('user_id')
//         .notNull()
//         .references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
//     userName: text('user_name').notNull(),
//     reason: text('reason').notNull(),
//     notes: text('notes'),
//     createdAt: integer('created_at', { mode: 'timestamp' })
//         .notNull()
//         .default(sql`(strftime('%s', 'now'))`)
// }, (table) => ({
//     productIdx: index('inventory_logs_product_idx').on(table.productId),
//     userIdx: index('inventory_logs_user_idx').on(table.userId),
//     reasonIdx: index('inventory_logs_reason_idx').on(table.reason),
//     dateIdx: index('inventory_logs_date_idx').on(table.createdAt)
// }));
