import { supabaseClient, handleLogin, handleLogout, checkPermission, fetchUserProfile, setCurrentUserProfile, getCurrentUserProfile } from './auth.js';
import {
    loadDataAndRenderApp, items, operationsHistory, suppliers, addOperation
} from './database.js';
import { openReportsModal } from './reports.js';
import { finalizarOperacaoDeImportacao, regenerateDocument } from './operations.js';
import {
    applyPermissionsToUI, fullUpdate, showView, showNotification, openModal, closeModal, openOperationsHistoryModal, showConfirmModal
} from './ui.js';
import { initializeEventListeners } from './events.js';
import { openSimulationModal, resumeSimulation } from './simulation.js';
import { openPurchaseOrdersModal } from './purchase-orders.js';
import { exportBackup, restoreBackup } from './backup.js'; // Import Backup functionality
import { escapeHTML } from './utils/helpers.js';
import { API_CONFIG } from './config.js'; // Import config

// --- Variáveis de Estado para o Novo Fluxo de Extração ---
let stagedNfeData = []; // Array para guardar dados de múltiplas NF-e
let stagedItems = []; // Array para guardar os itens acumulados


/**
 * Função principal de inicialização da aplicação quando o usuário está logado.
 * @param {object} userProfile - O perfil completo do usuário (auth + profile).
 */
async function initializeApp(user) { // Receives user, not userProfile
    console.log("Attempting to initialize app for user:", user);

    console.log("Fetching full user profile...");
    const userProfile = await fetchUserProfile(user);
    console.log("Full user profile fetched:", userProfile);

    if (!userProfile) {
        console.error("Could not get user profile. Aborting app initialization and logging out.");
        showNotification('Sessão inválida ou perfil não encontrado. Por favor, faça login novamente.', 'danger');
        await handleLogout();
        return; // Stop initialization
    }

    console.log("Usuário autenticado com perfil. Inicializando a aplicação...", userProfile);
    setCurrentUserProfile(userProfile); // Set the profile now

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');

    // 1. Aplica as permissões primeiro para evitar race conditions
    applyPermissionsToUI(userProfile);

    try {
        // 2. Carrega os dados e renderiza o resto da aplicação
        await loadDataAndRenderApp();

        fullUpdate();

        // Lógica de navegação e restauração de estado
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
    } catch (error) {
        console.error("Falha ao inicializar a aplicação:", error);
        showNotification(`Erro crítico ao carregar dados: ${error.message}. Por favor, recarregue a página.`, 'danger', 10000);
        // Se o carregamento de dados falhar, não devemos mostrar a app, mas sim a tela de erro/login.
        await handleLogout();
    }
}

/**
 * Limpa a UI e os dados quando o usuário faz logout.
 */
function shutdownApp() {
    console.log("Usuário deslogado. Desligando a aplicação.");
    setCurrentUserProfile(null); // Limpa o perfil do usuário
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    // Limpar quaisquer dados sensíveis em memória, se necessário
    items.length = 0;
    operationsHistory.length = 0;
    suppliers.length = 0;
}


// --- Ponto de Entrada da Aplicação ---

document.addEventListener('DOMContentLoaded', () => {
    // Listener principal de autenticação do Supabase
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        // This is the robust logging version, which is fine to keep.
        console.log('--- Auth State Change ---');
        console.log('Event:', event);
        console.log('Session exists:', !!session);

        if (session) {
            // Session exists, proceed to initialize the app immediately.
            // We will fetch the detailed profile inside initializeApp.
            console.log('Session found. Calling initializeApp...');
            initializeApp(session.user);
        } else {
            console.log('No session found. Shutting down app.');
            shutdownApp();
        }
        console.log('--- End Auth State Change ---');
    });

    // Listener para o formulário de login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const button = e.target.querySelector('button');

        button.disabled = true;
        button.textContent = 'A entrar...';

        await handleLogin(email, password);

        button.disabled = false;
        button.textContent = 'Entrar';
    });

    // Inicializa todos os outros event listeners da aplicação
    initializeEventListeners();

    // --- Backup & Restore Events ---
    const backupBtn = document.getElementById('desktop-backup-btn');
    if (backupBtn) {
        backupBtn.addEventListener('click', () => {
            openModal('backup-modal');
        });
    }

    const doBackupBtn = document.getElementById('btn-do-backup');
    if (doBackupBtn) {
        doBackupBtn.addEventListener('click', async () => {
            doBackupBtn.disabled = true;
            doBackupBtn.textContent = "Gerando Backup...";
            await exportBackup();
            doBackupBtn.disabled = false;
            doBackupBtn.textContent = "Baixar Backup Agora";
        });
    }

    const triggerRestoreBtn = document.getElementById('btn-trigger-restore');
    const backupInput = document.getElementById('backup-file-input');

    if (triggerRestoreBtn && backupInput) {
        triggerRestoreBtn.addEventListener('click', () => {
            backupInput.click();
        });

        backupInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            backupInput.value = ''; // Reset input immediately
            if (!file) return;

            showConfirmModal(
                "Restaurar Backup?",
                "ATENÇÃO: Restaurar um backup irá sobrescrever dados existentes com o mesmo ID.\nPode haver perda de dados recentes se o backup for antigo.\n\nTem certeza que deseja continuar?",
                async () => {
                    triggerRestoreBtn.disabled = true;
                    triggerRestoreBtn.textContent = "Restaurando...";

                    try {
                        await restoreBackup(file);
                        closeModal('backup-modal');
                    } catch (err) {
                        // Error handled in restoreBackup
                    } finally {
                        triggerRestoreBtn.disabled = false;
                        triggerRestoreBtn.textContent = "Selecionar Arquivo...";
                    }
                }
            );
        });
    }

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

    // O listener de 'storage' pode ser removido ou adaptado, pois não usaremos mais localStorage para o documento
    window.addEventListener('storage', (event) => {
        // Esta lógica precisa ser repensada com o Supabase (talvez usando Realtime)
    });
});

// O resto do arquivo (handleXmlUpload, showExtractionMenu, etc.) permanece o mesmo por enquanto.
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
        const response = await fetch(API_CONFIG.XML_UPLOAD_URL, {
            method: 'POST',
            headers: {
                [API_CONFIG.API_KEY_HEADER]: API_CONFIG.API_KEY_VALUE
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

async function handlePerformOperation() {
    if (stagedItems.length === 0) {
        showNotification('Nenhum item carregado para realizar a operação.', 'warning');
        return;
    }

    const currentUser = getCurrentUserProfile();
    if (!currentUser) {
        showNotification('Usuário não autenticado. Não é possível salvar a operação.', 'danger');
        return;
    }

    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');

    const operationId = `OP-${Date.now()}`;
    const newOperation = {
        id: operationId,
        user_id: currentUser.id,
        invoiceNumber: operationId.replace('OP-', ''),
        date: new Date().toISOString(),
        items: [...stagedItems],
        nfeData: [...stagedNfeData],
        type: 'import'
    };

    try {
        // Salva a operação principal primeiro
        await addOperation(newOperation);
        operationsHistory.push(newOperation);

        // Em seguida, salva todos os itens, fornecedores e movimentos, esperando a conclusão
        await finalizarOperacaoDeImportacao(stagedNfeData, newOperation.id);

        clearStagedData();
        closeModal('extraction-menu-modal');
        showNotification(`Operação ${newOperation.id} criada e salva com sucesso!`, 'success');

        // Por fim, gera o documento
        regenerateDocument(newOperation.id, 'invoice');

    } catch (error) {
        showNotification(`Erro ao salvar operação no banco de dados: ${error.message}`, 'danger');
        console.error("Falha ao salvar operação:", error);
    } finally {
        // Garante que o overlay de carregamento seja sempre escondido
        loadingOverlay.classList.add('hidden');
    }
}