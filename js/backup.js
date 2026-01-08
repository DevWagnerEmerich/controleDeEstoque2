import { supabaseClient } from './supabase.js';
import {
    items, suppliers, movements, operationsHistory, users,
    pendingPurchaseOrders, loadDataAndRenderApp
} from './database.js';
import { showNotification, fullUpdate } from './ui.js';

// --- Backup Functionality ---

/**
 * Downloads a complete JSON backup of the system data and schema.
 */
export async function exportBackup() {
    const timestamp = new Date().toISOString();

    // 1. Gather Data from Local Stores (which mirror Supabase)
    // We fetch fresh from DB to ensure we have the absolute latest state on server
    // instead of relying potentially stale local arrays.

    try {
        console.log("Starting Backup: Fetching data...");

        const [
            { data: itemsData },
            { data: suppliersData },
            { data: movementsData },
            { data: operationsData },
            { data: profilesData },
            { data: poData }
        ] = await Promise.all([
            supabaseClient.from('items').select('*'),
            supabaseClient.from('suppliers').select('*'),
            supabaseClient.from('movements').select('*'),
            supabaseClient.from('operations').select('*'),
            supabaseClient.from('profiles').select('*'),
            supabaseClient.from('purchase_orders').select('*')
        ]);

        const backupData = {
            metadata: {
                version: "1.0",
                timestamp: timestamp,
                app: "StockControl Pro"
            },
            schema_notes: [
                "This backup contains raw data from Supabase tables.",
                "Restore process uses 'upsert' (update or insert) based on 'id'."
            ],
            data: {
                items: itemsData || [],
                suppliers: suppliersData || [],
                movements: movementsData || [],
                operations: operationsData || [],
                profiles: profilesData || [],
                purchase_orders: poData || []
            }
        };

        // 2. Create and Download File
        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const filename = `stock_control_backup_${timestamp.slice(0, 10)}.json`;

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log("Backup downloaded successfully.");
        showNotification("Backup realizado com sucesso! Download iniciado.", "success");
        return true;

    } catch (error) {
        console.error("Backup failed:", error);
        showNotification("Erro ao criar backup: " + error.message, "danger");
        return false;
    }
}

// --- Restore Functionality ---

/**
 * Restores system data from a provided JSON file.
 * Warning: This allows 'upsert', possibly overwriting existing records with same ID.
 * @param {File} file - The JSON file selected by the user
 */
export async function restoreBackup(file) {
    if (!file) return;

    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);

                if (!json.data || !json.metadata) {
                    throw new Error("Arquivo de backup inválido (formato incorreto).");
                }

                console.log("Starting Restore...");

                // Helper to upsert data in batches
                const upsertTable = async (tableName, rows) => {
                    if (!rows || rows.length === 0) return;
                    console.log(`Restoring ${tableName} (${rows.length} records)...`);
                    const { error } = await supabaseClient.from(tableName).upsert(rows);
                    if (error) throw new Error(`Falha ao restaurar ${tableName}: ${error.message}`);
                };

                // Restore Order (Independent tables first)
                await upsertTable('suppliers', json.data.suppliers);
                await upsertTable('items', json.data.items);
                // Users/Profiles might have constraints, but we try upsert
                if (json.data.profiles) await upsertTable('profiles', json.data.profiles);

                // Dependent tables
                await upsertTable('operations', json.data.operations);
                await upsertTable('movements', json.data.movements);
                await upsertTable('purchase_orders', json.data.purchase_orders);

                console.log("Restore completed. Reloading app data...");
                await loadDataAndRenderApp(); // Refresh local state

                fullUpdate(); // Force UI Re-render

                showNotification("Restauração concluída com sucesso!", "success");
                resolve(true);

            } catch (error) {
                console.error("Restore failed:", error);
                showNotification("Erro na restauração: " + error.message, "danger");
                reject(error);
            }
        };

        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
    });
}
