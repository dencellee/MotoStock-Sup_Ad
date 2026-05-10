import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "../../lib/server/db/index";
import { users } from '../../lib/server/db/schema';
import { eq } from "drizzle-orm";

export const load: LayoutServerLoad = async ({ cookies }) => {
    const session = cookies.get("session");

    if (!session) {
        throw redirect(303, "/login");
    }

    // 1. Get the stored user data from cookie
    const sessionUser = JSON.parse(session);

    // 2. FETCH FRESH DATA from the database using the ID
    const [freshUser] = await db
        .select({
            id: users.id,
            username: users.username, // This will be the updated name
            email: users.email,
            role: users.role
        })
        .from(users)
        .where(eq(users.id, sessionUser.id));

    // 3. Security check: if user was deleted or session is invalid
    if (!freshUser) {
        cookies.delete("session", { path: "/" });
        throw redirect(303, "/login");
    }


    // 4. Role check using the fresh data
    if (freshUser.role !== "super_admin") {
        // Optionally, redirect admins to /admin and others to /staff
        if (freshUser.role === "admin") {
            throw redirect(303, "/admin");
        } else {
            throw redirect(303, "/staff");
        }
    }

    return {
        user: freshUser
    };
    
};