// src/app.d.ts

declare global {
    namespace App {
        interface Locals {
            user: {
                id: number;
                username: string;
                role: 'admin' | 'staff' | 'super_admin';
            } | null;
        }
    }

    interface Window {
        pos: {
            version: string;
            env: string;
            minimize: () => void;
            maximize: () => void;
            close: () => void;
            printReceipt: (data: any) => Promise<void>;
            sendNotification: (message: string) => void;
        };
    }
}

export {};