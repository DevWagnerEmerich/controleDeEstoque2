import { initializeAuth, handleLogout, checkPermission, currentUserProfile } from './auth.js';
import { loadAllData, clearAllData, getAllSuppliers, getAllItems } from './database.js'; // Novas importações
import { openReportsModal } from './reports.js';
import { finalizarOperacaoDeImportacao, regenerateDocument } from './operations.js';
import { 
    applyPermissionsToUI, fullUpdate, showView, showNotification, openModal, closeModal, openOperationsHistoryModal, renderItems
} from './ui.js';
import { initializeEventListeners } from './events.js';
import { openSimulationModal, resumeSimulation } from './simulation.js';
import { openPurchaseOrdersModal } from './purchase-orders.js';

// Variáveis de estado globais para os dados da aplicação
// Serão populadas após o carregamento do Supabase
export let appData = {
    items: [],
    suppliers: [],
    movements: [],
    operationsHistory: [],
    pendingPurchaseOrders: [],
    userProfiles: []
};

// --- Variáveis de Estado para o Novo Fluxo de Extração (temporariamente mantidas) ---
let stagedNfeData = [];
let stagedItems = [];

document.addEventListener('DOMContentLoaded', async () => { // Adicionado 'async' aqui

    const isAuthenticated = await initializeAuth(); // Espera a autenticação

    if (isAuthenticated) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        // Carrega todos os dados da base de dados Supabase
        const loadedData = await loadAllData();
        Object.assign(appData, loadedData); // Popula a variável global appData

        applyPermissionsToUI();
        fullUpdate(); // fullUpdate precisará ser adaptado para usar appData

        // Handle hash-based navigation and session-based state restoration
        const hash = window.location.hash;
        const simReturnData = sessionStorage.getItem('simulationReturnData');

        if (simReturnData) {
            sessionStorage.removeItem('simulationReturnData');
            const simulationData = JSON.parse(simReturnData);
            resumeSimulation(simulationData); // resumeSimulation precisará ser adaptado
        } else if (hash.includes('#operations-history')) {
            openOperationsHistoryModal();
        } else if (hash.includes('#purchase-orders')) {
            openPurchaseOrdersModal();
        } else if (hash.includes('#menu')) {
            showView('menu');
        } else {
            showView('dashboard');
        }

    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
    
    initializeEventListeners();
    
    // Listener de Navegação Principal (Bottom Nav - Mobile)
    document.querySelector('.bottom-nav').addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;

        e.preventDefault();
        const viewName = navItem.id.split('-')[1]; // e.g., 'dashboard', 'operations'
        
        if (viewName === 'reports') {
            openReportsModal();
        } else if (viewName === 'operations') {
            openModal('operations-hub-modal');
        } else {
            showView(viewName);
        }
    });

    // Adiciona o listener para o upload de XML (temporariamente mantido, mas será refatorado)
    document.getElementById('xml-upload-main').addEventListener('change', handleXmlUpload);

    // Remove o listener de 'storage' que não é mais necessário com Supabase
    // window.addEventListener('storage', (...) => { ... });
});

// --- Nova Lógica de Extração de XML (Frontend envia para Backend) --- //
// Esta função será refatorada na Parte 3 para usar o backend Python na Vercel
async function handleXmlUpload(event) {
    if (!checkPermission('import')) {
        showNotification('Não tem permissão para importar ficheiros.', 'danger');
        return;
    }

    const file = event.target.files[0];
    if (!file) return;

    showNotification('Processando NF-e XML no servidor...', 'info');

    const formData = new FormData();
    formData.append('file', file);

    try {
        // Esta URL será substituída pela URL da sua Serverless Function na Vercel
        const response = await fetch('http://localhost:8001/upload/', {
            method: 'POST',
            headers: {
                'Authorization': 'secret' // ATENÇÃO: Isso será removido/segurizado
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Erro do servidor: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data || !data.produtos || data.produtos.length === 0) {
            throw new Error("Nenhum produto encontrado no XML processado pelo servidor.");
        }

        showNotification('XML processado com sucesso!', 'success');
        showExtractionMenu(data);

    } catch (error) {
        console.error('Falha ao processar XML via backend:', error);
        showNotification(`Falha ao processar XML: ${error.message}`, 'danger');
    } finally {
        event.target.value = ''; // Limpa o input para permitir o upload do mesmo arquivo novamente
    }
}

// Esta função será refatorada na Parte 3
function showExtractionMenu(data) {
    // A lógica de busca de fornecedor e itens existentes precisará ser adaptada para usar getAllSuppliers e getAllItems
    const supplier = appData.suppliers.find(s => s.cnpj === data.fornecedor.cnpj); // Usando appData.suppliers

    data.produtos.forEach(prod => {
        let qtyUnit = null;

        const packageMatch = (prod.name.match(/(\d+\s*[xX]\s*\d+)/) || [])[0];
        if (packageMatch) {
            qtyUnit = packageMatch.toUpperCase().replace(" ", "");
        }

        if (!qtyUnit && supplier) {
            const existingItem = appData.items.find(item => item.code === prod.code && item.supplierId === supplier.id); // Usando appData.items
            if (existingItem && existingItem.unitsPerPackage > 0 && existingItem.unitMeasureValue > 0) {
                qtyUnit = `${existingItem.unitsPerPackage}X${existingItem.unitMeasureValue}`;
            }
        }

        if (!qtyUnit) {
            const singleItemMatch = (prod.name.match(/(\d+)\s*(?:G|GR|KG)/i) || [])[1];
            if (singleItemMatch) {
                qtyUnit = singleItemMatch.trim();
            }
        }

        prod.qtyUnit = qtyUnit || '';
    });

    stagedNfeData.push(data);
    stagedItems.push(...data.produtos);

    const summaryEl = document.getElementById('extraction-summary');
    summaryEl.innerHTML = `
        <p><strong>Fornecedor:</strong> ${data.fornecedor?.nome || 'N/A'}</p>
        <p><strong>Itens nesta nota:</strong> ${data.produtos?.length || 0}</p>
        <p><strong>Total de itens acumulados:</strong> ${stagedItems.length}</p>
    `;

    document.getElementById('menu-action-save-stock').style.display = 'none';
    document.getElementById('menu-action-load-another').onclick = () => {
        closeModal('extraction-menu-modal');
        document.getElementById('xml-upload-main').click();
    };
    document.getElementById('menu-action-perform-op').onclick = handlePerformOperation;
    document.getElementById('menu-action-cancel').onclick = () => {
        clearStagedData();
        closeModal('extraction-menu-modal');
        showNotification('Operação cancelada.', 'warning');
    };

    openModal('extraction-menu-modal');
}

function clearStagedData() {
    stagedNfeData = [];
    stagedItems = [];
}

// Esta função será refatorada na Parte 3
async function handlePerformOperation() {
    if (stagedItems.length === 0) {
        showNotification('Nenhum item carregado para realizar a operação.', 'warning');
        return;
    }

    const operationId = `OP-${Date.now()}`;
    const newOperation = {
        operation_id: operationId, // Usar operation_id para corresponder ao esquema do BD
        date: new Date().toISOString(),
        items: stagedItems, // stagedItems já é um array
        nfe_data: stagedNfeData, // stagedNfeData já é um array
        type: 'import'
    };

    // Aqui você precisará chamar addOperationToHistory do database.js
    // const addedOperation = await addOperationToHistory(newOperation);
    // if (addedOperation) { ... }

    // Temporariamente, vamos apenas simular o sucesso
    showNotification(`Operação ${newOperation.operation_id} criada com sucesso! (Simulado)`, 'success');

    // Processa a entrada e saída dos itens no estoque e cria os movimentos
    // finalizarOperacaoDeImportacao(stagedNfeData, newOperation.operation_id); // Isso também precisará ser adaptado

    clearStagedData();
    closeModal('extraction-menu-modal');
    
    // Abre o histórico de operações para o usuário ver o resultado
    // regenerateDocument(newOperation.operation_id, 'invoice'); // Isso também precisará ser adaptado
}
