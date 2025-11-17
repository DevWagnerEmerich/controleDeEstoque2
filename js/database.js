// Importa o cliente Supabase
import { supabase } from './supabase.js';
import { currentUserProfile } from './auth.js'; // Para verificar permissões, se necessário

// --- Funções de Leitura de Dados ---

/**
 * Busca todos os itens da base de dados.
 * @returns {Array} - Uma lista de itens.
 */
export async function getAllItems() {
    const { data, error } = await supabase.from('items').select('*');
    if (error) {
        console.error('Erro ao buscar itens:', error.message);
        return [];
    }
    return data;
}

/**
 * Busca todos os fornecedores da base de dados.
 * @returns {Array} - Uma lista de fornecedores.
 */
export async function getAllSuppliers() {
    const { data, error } = await supabase.from('suppliers').select('*');
    if (error) {
        console.error('Erro ao buscar fornecedores:', error.message);
        return [];
    }
    return data;
}

/**
 * Busca todos os movimentos da base de dados.
 * @returns {Array} - Uma lista de movimentos.
 */
export async function getAllMovements() {
    const { data, error } = await supabase.from('movements').select('*');
    if (error) {
        console.error('Erro ao buscar movimentos:', error.message);
        return [];
    }
    return data;
}

/**
 * Busca todo o histórico de operações da base de dados.
 * @returns {Array} - Uma lista de operações.
 */
export async function getAllOperationsHistory() {
    const { data, error } = await supabase.from('operations_history').select('*');
    if (error) {
        console.error('Erro ao buscar histórico de operações:', error.message);
        return [];
    }
    return data;
}

/**
 * Busca todas as ordens de compra pendentes da base de dados.
 * @returns {Array} - Uma lista de ordens de compra pendentes.
 */
export async function getAllPendingPurchaseOrders() {
    const { data, error } = await supabase.from('pending_purchase_orders').select('*');
    if (error) {
        console.error('Erro ao buscar ordens de compra pendentes:', error.message);
        return [];
    }
    return data;
}

/**
 * Busca perfis de utilizador da base de dados.
 * @returns {Array} - Uma lista de perfis de utilizador.
 */
export async function getUserProfiles() {
    const { data, error } = await supabase.from('user_profiles').select('*');
    if (error) {
        console.error('Erro ao buscar perfis de utilizador:', error.message);
        return [];
    }
    return data;
}

// --- Funções de Escrita/Manipulação de Dados ---

/**
 * Adiciona um novo item à base de dados.
 * @param {Object} item - O objeto item a ser adicionado.
 * @returns {Object|null} - O item adicionado ou null em caso de erro.
 */
export async function addItem(item) {
    const { data, error } = await supabase.from('items').insert([item]).select();
    if (error) {
        console.error('Erro ao adicionar item:', error.message);
        return null;
    }
    return data[0];
}

/**
 * Atualiza um item existente na base de dados.
 * @param {string} id - O ID do item a ser atualizado.
 * @param {Object} updates - Os campos a serem atualizados.
 * @returns {Object|null} - O item atualizado ou null em caso de erro.
 */
export async function updateItem(id, updates) {
    const { data, error } = await supabase.from('items').update(updates).eq('id', id).select();
    if (error) {
        console.error('Erro ao atualizar item:', error.message);
        return null;
    }
    return data[0];
}

/**
 * Exclui um item da base de dados.
 * @param {string} id - O ID do item a ser excluído.
 * @returns {boolean} - True se a exclusão foi bem-sucedida, senão false.
 */
export async function deleteItem(id) {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
        console.error('Erro ao excluir item:', error.message);
        return false;
    }
    return true;
}

/**
 * Adiciona um novo fornecedor à base de dados.
 * @param {Object} supplier - O objeto fornecedor a ser adicionado.
 * @returns {Object|null} - O fornecedor adicionado ou null em caso de erro.
 */
export async function addSupplier(supplier) {
    const { data, error } = await supabase.from('suppliers').insert([supplier]).select();
    if (error) {
        console.error('Erro ao adicionar fornecedor:', error.message);
        return null;
    }
    return data[0];
}

/**
 * Atualiza um fornecedor existente na base de dados.
 * @param {string} id - O ID do fornecedor a ser atualizado.
 * @param {Object} updates - Os campos a serem atualizados.
 * @returns {Object|null} - O fornecedor atualizado ou null em caso de erro.
 */
export async function updateSupplier(id, updates) {
    const { data, error } = await supabase.from('suppliers').update(updates).eq('id', id).select();
    if (error) {
        console.error('Erro ao atualizar fornecedor:', error.message);
        return null;
    }
    return data[0];
}

/**
 * Exclui um fornecedor da base de dados.
 * @param {string} id - O ID do fornecedor a ser excluído.
 * @returns {boolean} - True se a exclusão foi bem-sucedida, senão false.
 */
export async function deleteSupplier(id) {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) {
        console.error('Erro ao excluir fornecedor:', error.message);
        return false;
    }
    return true;
}

/**
 * Adiciona um novo movimento à base de dados.
 * @param {Object} movement - O objeto movimento a ser adicionado.
 * @returns {Object|null} - O movimento adicionado ou null em caso de erro.
 */
export async function addMovement(movement) {
    const { data, error } = await supabase.from('movements').insert([movement]).select();
    if (error) {
        console.error('Erro ao adicionar movimento:', error.message);
        return null;
    }
    return data[0];
}

/**
 * Adiciona uma nova operação ao histórico.
 * @param {Object} operation - O objeto operação a ser adicionado.
 * @returns {Object|null} - A operação adicionada ou null em caso de erro.
 */
export async function addOperationToHistory(operation) {
    const { data, error } = await supabase.from('operations_history').insert([operation]).select();
    if (error) {
        console.error('Erro ao adicionar operação ao histórico:', error.message);
        return null;
    }
    return data[0];
}

/**
 * Adiciona uma nova ordem de compra pendente.
 * @param {Object} po - O objeto ordem de compra a ser adicionado.
 * @returns {Object|null} - A ordem de compra adicionada ou null em caso de erro.
 */
export async function addPendingPurchaseOrder(po) {
    const { data, error } = await supabase.from('pending_purchase_orders').insert([po]).select();
    if (error) {
        console.error('Erro ao adicionar ordem de compra pendente:', error.message);
        return null;
    }
    return data[0];
}

/**
 * Atualiza uma ordem de compra pendente existente.
 * @param {string} id - O ID da ordem de compra a ser atualizada.
 * @param {Object} updates - Os campos a serem atualizados.
 * @returns {Object|null} - A ordem de compra atualizada ou null em caso de erro.
 */
export async function updatePendingPurchaseOrder(id, updates) {
    const { data, error } = await supabase.from('pending_purchase_orders').update(updates).eq('id', id).select();
    if (error) {
        console.error('Erro ao atualizar ordem de compra pendente:', error.message);
        return null;
    }
    return data[0];
}

/**
 * Exclui uma ordem de compra pendente.
 * @param {string} id - O ID da ordem de compra a ser excluída.
 * @returns {boolean} - True se a exclusão foi bem-sucedida, senão false.
 */
export async function deletePendingPurchaseOrder(id) {
    const { error } = await supabase.from('pending_purchase_orders').delete().eq('id', id);
    if (error) {
        console.error('Erro ao excluir ordem de compra pendente:', error.message);
        return false;
    }
    return true;
}

/**
 * Atualiza um perfil de utilizador existente.
 * @param {string} id - O ID do perfil do utilizador a ser atualizado.
 * @param {Object} updates - Os campos a serem atualizados.
 * @returns {Object|null} - O perfil do utilizador atualizado ou null em caso de erro.
 */
export async function updateUserProfile(id, updates) {
    const { data, error } = await supabase.from('user_profiles').update(updates).eq('id', id).select();
    if (error) {
        console.error('Erro ao atualizar perfil do utilizador:', error.message);
        return null;
    }
    return data[0];
}

// --- Funções de Carregamento Inicial e Limpeza ---

/**
 * Carrega todos os dados iniciais da base de dados.
 * Esta função é um ponto central para buscar todos os dados necessários na inicialização.
 * @returns {Object} - Um objeto contendo todos os dados carregados.
 */
export async function loadAllData() {
    const items = await getAllItems();
    const suppliers = await getAllSuppliers();
    const movements = await getAllMovements();
    const operationsHistory = await getAllOperationsHistory();
    const pendingPurchaseOrders = await getAllPendingPurchaseOrders();
    const userProfiles = await getUserProfiles(); // Pode ser necessário para gerir permissões

    return { items, suppliers, movements, operationsHistory, pendingPurchaseOrders, userProfiles };
}

/**
 * Limpa todos os dados de todas as tabelas da base de dados.
 * @returns {boolean} - True se a limpeza foi bem-sucedida, senão false.
 */
export async function clearAllData() {
    // Exclui todos os registos de cada tabela.
    // A ordem pode ser importante devido a chaves estrangeiras.
    // Começamos pelas tabelas "filhas" (movements, operation_items) e depois as "pai".
    const { error: movementsError } = await supabase.from('movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: pendingPOError } = await supabase.from('pending_purchase_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: operationsError } = await supabase.from('operations_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: itemsError } = await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: suppliersError } = await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: userProfilesError } = await supabase.from('user_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');


    if (itemsError || suppliersError || movementsError || operationsError || pendingPOError || userProfilesError) {
        console.error('Erro ao limpar dados:', itemsError, suppliersError, movementsError, operationsError, pendingPOError, userProfilesError);
        return false;
    }
    window.location.reload(); // Recarrega para refletir o estado vazio
    return true;
}

// A função loadFictitiousData será tratada separadamente, pois envolve a inserção de dados.
// Por enquanto, ela não será exportada ou usada diretamente aqui.
