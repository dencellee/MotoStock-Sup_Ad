// src/lib/server/db/utils.ts
import { db } from './index';
import { logs } from './schema';
import path from 'path';
import fs from 'fs';

export async function recordActivity(
    userId: number,
    userName: string,
    action: string,
    details: string,
    ipAddress?: string
) {
    try {
        let safeDetails = details;
        // Redact sensitive info for password changes and similar actions
        if (action && typeof action === 'string') {
            const lowerAction = action.toLowerCase();
            if (lowerAction.includes('password')) {
                safeDetails = '[REDACTED]';
            }
            // Add more redaction rules here if needed
        }
        const logDetails = ipAddress
            ? `[IP: ${ipAddress}] ${safeDetails}`
            : safeDetails;
        const now = new Date();
        // Debug log
        const debugMsg = `[ACTIVITY][${now.toISOString()}] user_id=${userId}, user_name=${userName}, action=${action}, details=${logDetails}`;
        try {
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            fs.appendFileSync(path.join(logDir, 'activity_debug.log'), debugMsg + '\n');
        } catch {}
        try {
            await db.insert(logs).values({
                userId: userId,
                userName: userName,
                action,
                details: logDetails,
                createdAt: now,
                timestamp: now
            });
        } catch (err) {
            console.error('[LOG INSERT ERROR]', {
                userId: userId,
                userName: userName,
                action,
                details: logDetails,
                createdAt: now,
                timestamp: now,
                error: err
            });
            throw err;
        }
    } catch (e) {
        console.error("Failed to write log to Postgres:", e);
    }
}