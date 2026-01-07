import { supabaseClient } from './supabase.js';

let items = [];
let suppliers = [];
let movements = [];
let operationsHistory = [];
let users = [];
let importedOperationsHistory = [];
let cumulativeImportedItems = [];
let pendingSimulations = [];
let pendingPurchaseOrders = [];

export { items, suppliers, movements, operationsHistory, users, importedOperationsHistory, cumulativeImportedItems, pendingSimulations, pendingPurchaseOrders };

// --- STATE MANAGEMENT HELPERS (New) ---
export function addLocalItem(item) { items.push(item); }
export function updateLocalItem(updatedItem) {
    const index = items.findIndex(i => i.id === updatedItem.id);
    if (index !== -1) items[index] = updatedItem;
}
export function removeLocalItem(itemId) {
    const index = items.findIndex(i => i.id === itemId);
    if (index !== -1) items.splice(index, 1);
}

export function addLocalSupplier(supplier) { suppliers.push(supplier); }
export function updateLocalSupplier(updatedSupplier) {
    const index = suppliers.findIndex(s => s.id === updatedSupplier.id);
    if (index !== -1) suppliers[index] = updatedSupplier;
}
export function removeLocalSupplier(supplierId) {
    const index = suppliers.findIndex(s => s.id === supplierId);
    if (index !== -1) suppliers.splice(index, 1);
}

export function addLocalMovement(movement) { movements.push(movement); }
// --------------------------------------

// Funções CRUD (Create, Read, Update, Delete) para a tabela 'items'
export async function addItem(itemData) {
    const { data, error } = await supabaseClient.from('items').insert([itemData]).select().single();
    if (error) {
        console.error('Erro ao adicionar item:', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}

export async function updateItem(itemId, itemData) {
    const { data, error } = await supabaseClient.from('items').update(itemData).eq('id', itemId).select().single();
    if (error) {
        console.error('Erro ao atualizar item:', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}

export async function deleteItemDB(itemId) {
    const { error } = await supabaseClient.from('items').delete().eq('id', itemId);
    if (error) {
        console.error('Erro ao deletar item:', JSON.stringify(error, null, 2));
        throw error;
    }
    return true;
}

// Funções CRUD para a tabela 'suppliers'
export async function addSupplier(supplierData) {
    const { data, error } = await supabaseClient.from('suppliers').insert([supplierData]).select().single();
    if (error) {
        console.error('Erro ao adicionar fornecedor:', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}

export async function updateSupplier(supplierId, supplierData) {
    const { data, error } = await supabaseClient.from('suppliers').update(supplierData).eq('id', supplierId).select().single();
    if (error) {
        console.error('Erro ao atualizar fornecedor:', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}

export async function deleteSupplierDB(supplierId) {
    const { error } = await supabaseClient.from('suppliers').delete().eq('id', supplierId);
    if (error) {
        console.error('Erro ao deletar fornecedor:', JSON.stringify(error, null, 2));
        throw error;
    }
    return true;
}

// Funções CRUD para a tabela 'movements'
export async function addMovement(movementData) {
    const { data, error } = await supabaseClient.from('movements').insert([movementData]).select().single();
    if (error) {
        console.error('Erro ao adicionar movimento:', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}

// Função para salvar uma operação no Supabase
export async function addOperation(operationData) {
    const { data, error } = await supabaseClient.from('operations').insert([operationData]).select().single();
    if (error) {
        console.error('Erro ao adicionar operação:', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}

export async function updateOperation(operationId, operationData) {
    const { data, error } = await supabaseClient.from('operations').update(operationData).eq('id', operationId).select().single();
    if (error) {
        console.error('Erro ao atualizar operação:', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}

// Função para salvar uma Ordem de Compra no Supabase
export async function addPurchaseOrder(poData) {
    const { data, error } = await supabaseClient.from('purchase_orders').insert([poData]).select().single();
    if (error) {
        console.error('Erro ao adicionar Ordem de Compra:', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}

export async function updatePurchaseOrder(poId, poData) {
    const { data, error } = await supabaseClient.from('purchase_orders').update(poData).eq('id', poId).select().single();
    if (error) {
        console.error('Erro ao atualizar Ordem de Compra:', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}

/**
 * Carrega todos os dados essenciais do Supabase para a memória da aplicação.
 * Lança um erro se o carregamento falhar.
 */
export async function loadDataAndRenderApp() {
    console.log("Iniciando o carregamento de dados do Supabase...");

    const { data: itemsData, error: itemsError } = await supabaseClient.from('items').select('*');
    if (itemsError) throw new Error(`Erro ao buscar itens: ${itemsError.message}`);

    const { data: suppliersData, error: suppliersError } = await supabaseClient.from('suppliers').select('*');
    if (suppliersError) throw new Error(`Erro ao buscar fornecedores: ${suppliersError.message}`);

    const { data: operationsData, error: operationsError } = await supabaseClient.from('operations').select('*');
    if (operationsError) throw new Error(`Erro ao buscar operações: ${operationsError.message}`);

    const { data: movementsData, error: movementsError } = await supabaseClient.from('movements').select('*');
    if (movementsError) throw new Error(`Erro ao buscar movimentos: ${movementsData.message}`);

    const { data: purchaseOrdersData, error: purchaseOrdersError } = await supabaseClient.from('purchase_orders').select('*');
    if (purchaseOrdersError) throw new Error(`Erro ao buscar Ordens de Compra: ${purchaseOrdersError.message}`);

    const { data: profilesData, error: profilesError } = await supabaseClient.from('profiles').select('*');
    if (profilesError) console.warn(`Aviso ao buscar perfis: ${profilesError.message}`);

    // Limpa os arrays locais antes de popular
    items.length = 0;
    suppliers.length = 0;
    operationsHistory.length = 0;
    movements.length = 0;
    pendingPurchaseOrders.length = 0;
    users.length = 0;

    // Popula os arrays com os dados do Supabase
    items.push(...itemsData);
    suppliers.push(...suppliersData);
    operationsHistory.push(...operationsData);
    movements.push(...movementsData);
    pendingPurchaseOrders.push(...purchaseOrdersData);
    if (profilesData) users.push(...profilesData);

    console.log('Dados carregados com sucesso do Supabase:');
    console.log(`  - ${items.length} itens`);
    console.log(`  - ${suppliers.length} fornecedores`);
    console.log(`  - ${operationsHistory.length} operações`);
    console.log(`  - ${movements.length} movimentos`);
    console.log(`  - ${pendingPurchaseOrders.length} Ordens de Compra`);
}

export async function deletePurchaseOrder(poId) {
    const { error } = await supabaseClient.from('purchase_orders').delete().eq('id', poId);
    if (error) {
        console.error('Erro ao deletar Ordem de Compra:', JSON.stringify(error, null, 2));
        throw error;
    }
    return true;
}

export async function updateUserStatus(userId, isActive) {
    // Uses the existing 'update-user' Edge Function
    const { data, error } = await supabaseClient.functions.invoke('update-user', {
        body: { userId, is_active: isActive }
    });

    if (error) {
        console.error('Erro ao atualizar status do usuário (Edge Function):', JSON.stringify(error, null, 2));
        throw error;
    }
    return data;
}
