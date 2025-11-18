import { initializeAuth, handleLogout, checkPermission } from './auth.js';
import { loadDataAndRenderApp, saveData, items, operationsHistory, suppliers } from './database.js';
import { openReportsModal } from './reports.js';
import { finalizarOperacaoDeImportacao, regenerateDocument } from './operations.js';
import { 
    applyPermissionsToUI, fullUpdate, showView, showNotification, openModal, closeModal, openOperationsHistoryModal
} from './ui.js';
import { initializeEventListeners } from './events.js';
import { openSimulationModal, resumeSimulation } from './simulation.js';
import { openPurchaseOrdersModal } from './purchase-orders.js';

// --- Variáveis de Estado para o Novo Fluxo de Extração ---
let stagedNfeData = []; // Array para guardar dados de múltiplas NF-e
let stagedItems = []; // Array para guardar os itens acumulados

document.addEventListener('DOMContentLoaded', () => {

    loadDataAndRenderApp();

    if (initializeAuth()) {

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        applyPermissionsToUI();
        fullUpdate();

        // Handle hash-based navigation and session-based state restoration
        const hash = window.location.hash;
        const simReturnData = sessionStorage.getItem('simulationReturnData');

        if (simReturnData) {
            sessionStorage.removeItem('simulationReturnData');
            const simulationData = JSON.parse(simReturnData);
            resumeSimulation(simulationData);
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



    // Adiciona o listener para o upload de XML, que estava ausente
    document.getElementById('xml-upload-main').addEventListener('change', handleXmlUpload);

    window.addEventListener('storage', (event) => {
        if (event.key === 'currentDocument') {
            const documentDataString = event.newValue;
            if (documentDataString) {
                const documentData = JSON.parse(documentDataString);
                const operationId = documentData.operation.id;
                const opIndex = operationsHistory.findIndex(op => op.id === operationId);
                if (opIndex > -1) {
                    const originalDate = operationsHistory[opIndex].date;
                    operationsHistory[opIndex] = documentData.operation;
                    operationsHistory[opIndex].date = originalDate; // Keep original date
                    saveData();
                    showNotification(`Operação ${operationId} atualizada.`, 'info');
                }
            }
        }
    });
});

// --- Nova Lógica de Extração de XML (Frontend envia para Backend) --- //

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
        // Substitua pela URL do seu backend se for diferente
        const response = await fetch('http://localhost:8001/upload/', {
            method: 'POST',
            headers: {
                // A chave de API precisa ser gerenciada de forma segura
                // Por agora, vamos assumir que ela está disponível ou não é estritamente necessária para o desenvolvimento local
                'Authorization': 'secret' // ATENÇÃO: Usar uma chave fixa no código não é seguro para produção
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


function showExtractionMenu(data) {
    // Implementa a lógica A-B-C para o campo QTY UNIT
    const supplier = suppliers.find(s => s.cnpj === data.fornecedor.cnpj);

    data.produtos.forEach(prod => {
        let qtyUnit = null;

        // Plano A: Extrair padrão de pacote da descrição do XML (ex: 12X500)
        const packageMatch = (prod.name.match(/(\d+\s*[xX]\s*\d+)/) || [])[0];
        if (packageMatch) {
            qtyUnit = packageMatch.toUpperCase().replace(" ", "");
        }

        // Plano B: Se o Plano A falhar, buscar no estoque
        if (!qtyUnit && supplier) {
            const existingItem = items.find(item => item.code === prod.code && item.supplierId === supplier.id);
            if (existingItem && existingItem.unitsPerPackage > 0 && existingItem.unitMeasureValue > 0) {
                qtyUnit = `${existingItem.unitsPerPackage}X${existingItem.unitMeasureValue}`;
            }
        }

        // Plano C: Se A e B falharem, extrair padrão de item único da descrição (ex: 400)
        if (!qtyUnit) {
            const singleItemMatch = (prod.name.match(/(\d+)\s*(?:G|GR|KG)/i) || [])[1];
            if (singleItemMatch) {
                qtyUnit = singleItemMatch.trim();
            }
        }

        // Atribui o valor encontrado (ou string vazia) ao produto
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

function handlePerformOperation() {
    if (stagedItems.length === 0) {
        showNotification('Nenhum item carregado para realizar a operação.', 'warning');
        return;
    }

    const operationId = `OP-${Date.now()}`;
    const newOperation = {
        id: operationId,
        invoiceNumber: operationId.replace('OP-', ''), // Initialize invoiceNumber
        date: new Date().toISOString(),
        items: [...stagedItems],
        nfeData: [...stagedNfeData],
        type: 'import'
    };

    operationsHistory.push(newOperation);

    // Processa a entrada e saída dos itens no estoque e cria os movimentos
    finalizarOperacaoDeImportacao(stagedNfeData, newOperation.id);

    saveData();
    clearStagedData();
    closeModal('extraction-menu-modal');
    showNotification(`Operação ${newOperation.id} criada com sucesso!`, 'success');

    // Abre o histórico de operações para o usuário ver o resultado
    regenerateDocument(newOperation.id, 'invoice');
}