import { z } from 'zod';

// Product validation schemas
export const productCreateSchema = z.object({
    name: z.string().min(1, "Product name is required").max(200),
    brand: z.string().min(1, "Brand is required").max(100),
    categoryId: z.number().int().positive("Invalid category"),
    barcode: z.string().min(1, "Barcode is required").max(64),
    color: z.string().max(50).optional().nullable(),
    size: z.string().max(50).optional().nullable(),
    price: z.number().min(0, "Price cannot be negative"),
    cost: z.number().min(0, "Cost cannot be negative"),
    quantity: z.number().int().min(0, "Quantity cannot be negative")
});

export const productUpdateSchema = productCreateSchema.partial().extend({
    id: z.number().int().positive()
});

export const restockSchema = z.object({
    id: z.number().int().positive(),
    quantity_to_add: z.number().int().min(1, "Must add at least 1 unit"),
    cost: z.number().min(0, "Cost cannot be negative")
});

// User validation schemas
export const userCreateSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters").max(50),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(['admin', 'staff'])
});

export const userUpdateSchema = z.object({
    id: z.number().int().positive(),
    username: z.string().min(3).max(50).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(['admin', 'staff']).optional()
});

// Sale validation schema
export const saleSchema = z.object({
    cartData: z.string().min(1, "Cart cannot be empty"),
    discount: z.number().min(0).max(100, "Discount must be between 0-100%"),
    paymentMode: z.enum(['CASH', 'GCASH', 'BANK'])
});

// Helper function to validate and return errors
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { 
    success: boolean; 
    data?: T; 
    errors?: string[] 
} {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { 
                success: false, 
                errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
            };
        }
        return { success: false, errors: ['Validation failed'] };
    }
}
