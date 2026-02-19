import { openModal, closeModal, showNotification, showConfirmModal } from './ui.js';
import { items, suppliers, operationsHistory, pendingSimulations, movements, pendingPurchaseOrders, addPurchaseOrder, addItem } from './database.js';
import { finalizarOperacaoDeImportacao } from './operations.js';
import { openOperationsHistoryModal } from './ui.js';
import { getCurrentUserProfile } from './auth.js';

const AUTO_SAVE_KEY = 'stock_simulation_draft';
let currentSimulation = {};

function toggleSimulationActionButtons(enable) {

    document.getElementById('sim-finalize-btn').disabled = !enable;
}

export function openSimulationModal() {

    const savedDraft = localStorage.getItem(AUTO_SAVE_KEY);
    if (savedDraft) {
        showConfirmModal(
            'Continuar simulação?',
            'Encontramos uma simulação não finalizada. Deseja continuar de onde parou?',
            () => {
                currentSimulation = JSON.parse(savedDraft);
                document.getElementById('simulation-id').innerText = `ID: ${currentSimulation.id}`;
                renderSimulationAvailableItems();
                renderSimulationSelectedItems();
                renderSimulationSummary();
                openModal('simulation-modal');
                toggleSimulationActionButtons(true);
            },
            () => {
                localStorage.removeItem(AUTO_SAVE_KEY);
                startNewSimulation();
                toggleSimulationActionButtons(true);
            }
        );
    } else {
        startNewSimulation();
        toggleSimulationActionButtons(true);
    }
}

function startNewSimulation() {
    currentSimulation = {
        id: `SIM-${Date.now()}`,
        items: [],
        status: 'draft'
    };
    document.getElementById('simulation-id').innerText = `ID: ${currentSimulation.id}`;
    renderSimulationAvailableItems();
    renderSimulationSelectedItems();
    renderSimulationSummary();
    openModal('simulation-modal');
}

function autoSaveSimulation() {
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(currentSimulation));
}

function clearAutoSave() {
    localStorage.removeItem(AUTO_SAVE_KEY);
}

function renderSimulationSummary() {
    const summaryContainer = document.getElementById('sim-summary');
    if (currentSimulation.items.length === 0) {
        summaryContainer.innerHTML = '';
        return;
    }

    let totalQuantity = 0;
    let totalCost = 0;

    currentSimulation.items.forEach(simItem => {
        totalQuantity += simItem.operationQuantity;
        totalCost += simItem.operationQuantity * (simItem.costPrice || 0);
    });

    summaryContainer.innerHTML = `
        <div class="summary-row">
            <span>Total de Itens:</span>
            <span class="summary-value">${totalQuantity}</span>
        </div>
        <div class="summary-row">
            <span>Custo Total (est.):</span>
            <span class="summary-value">R$ ${totalCost.toFixed(2)}</span>
        </div>
    `;
}

function renderSimulationSelectedItems() {
    const container = document.getElementById('sim-selected-items');
    container.innerHTML = '';

    if (!currentSimulation || !currentSimulation.items || currentSimulation.items.length === 0) {
        container.innerHTML = `<div class="panel-empty-state"><p>Nenhum item adicionado à simulação.</p></div>`;
        return;
    }

    currentSimulation.items.forEach(simItem => {
        const div = document.createElement('div');
        div.className = 'op-item-card selected';

        div.innerHTML = `
            <div class="op-item-info">
                <p class="op-item-name">${simItem.name}</p>
                <p class="op-item-stock">Qtd: ${simItem.operationQuantity} @ ${simItem.operationPrice.toFixed(2)}</p>
            </div>
        `;
        const removeButton = document.createElement('button');
        removeButton.className = 'btn-remove-op';
        removeButton.dataset.itemId = simItem.id;
        removeButton.innerHTML = '<i data-feather="x"></i>';
        removeButton.addEventListener('click', (e) => {
            removeItemFromSimulation(e.currentTarget.dataset.itemId);
        });
        div.appendChild(removeButton);
        container.appendChild(div);
    });
    feather.replace();
    renderSimulationSummary();
}

function removeItemFromSimulation(itemId) {
    currentSimulation.items = currentSimulation.items.filter(simItem => simItem.id !== itemId);
    showNotification(`Item removido da simulação.`, 'info');
    renderSimulationSelectedItems();
    renderSimulationAvailableItems();
    autoSaveSimulation();
}
window.removeItemFromSimulation = removeItemFromSimulation;

function renderSimulationAvailableItems() {
    const container = document.getElementById('sim-available-items');
    container.innerHTML = '';

    const searchTerm = document.getElementById('sim-search-input').value.toLowerCase();
    const filteredItems = items.filter(item => {
        const nameMatch = item.name ? item.name.toLowerCase().includes(searchTerm) : false;
        const codeMatch = item.code ? item.code.toLowerCase().includes(searchTerm) : false;
        const ncmMatch = item.ncm ? item.ncm.toLowerCase().includes(searchTerm) : false;
        return nameMatch || codeMatch || ncmMatch;
    });

    if (filteredItems.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center">Nenhum item encontrado.</p>`;
        return;
    }

    filteredItems.forEach(item => {
        const isAdded = Array.isArray(currentSimulation.items) && currentSimulation.items.some(simItem => simItem.id === item.id);
        const div = document.createElement('div');
        div.className = `op-item-card available ${isAdded ? 'added' : ''}`;

        const supplier = suppliers.find(s => s.id === item.supplierId);
        const supplierName = supplier ? supplier.name : 'Fornecedor Desconhecido';

        div.innerHTML = `
            <div class="op-item-info">
                <p class="op-item-name">${item.name}</p>
                <p class="op-item-stock">Cód: ${item.code} | Forn: ${supplierName}</p>
            </div>
            <div class="op-item-actions">
                        <div class="input-group" style="display: none;">
                            <label>Qtd.</label>
                            <input type="number" id="sim-qty-${item.id}" class="form-input" min="1" value="1">
                        </div>                <button class="btn btn-add-op" id="add-sim-btn-${item.id}" data-item-id="${item.id}">Adicionar</button>
            </div>
        `;
        container.appendChild(div);

        // Adiciona o event listener ao botão Adicionar
        div.querySelector(`#add-sim-btn-${item.id}`).addEventListener('click', (e) => {
            addItemToSimulation(e.currentTarget.dataset.itemId);
        });
    });
}

function calculateSimulationItemQtyUnit(prod, supplier, allItems) {
    // Hierarquia de Métodos:
    // 1. Usar dados do estoque se forem válidos.
    // 2. Tentar extrair da descrição (padrão 12x400G).
    // 3. Tentar extrair da descrição (padrão 400G).

    // --- Prioridade 1: Dados do Estoque ---
    if (prod.unitMeasureValue > 0 && prod.unitsPerPackage > 0 && prod.unitMeasureType !== 'un') {
        // Os dados já estão no objeto 'prod', nada a fazer aqui.
    } else {
        // --- Prioridade 2: Extração da Descrição (Padrão Caixa/Fardo) ---
        const packageMatch = prod.name.match(/(\d+)\s*[xX]\s*(\d+(?:[.,]\d+)?)(?:[^\d\w]*)(G|GR|KG|L|ML)?/i);
        if (packageMatch) {
            prod.unitsPerPackage = parseInt(packageMatch[1], 10);
            prod.unitMeasureValue = parseFloat(packageMatch[2].replace(',', '.'));
            prod.unitMeasureType = (packageMatch[3] || '').toLowerCase();
        } else {
            // --- Prioridade 3: Extração da Descrição (Padrão Item Único) ---
            const singleItemMatch = prod.name.match(/(\d+(?:[.,]\d+)?)(?:[^\d\w]*)(G|GR|KG|L|ML)/i);
            if (singleItemMatch) {
                prod.unitsPerPackage = 1; // Para itens únicos, a embalagem é 1
                prod.unitMeasureValue = parseFloat(singleItemMatch[1].replace(',', '.'));
                prod.unitMeasureType = (singleItemMatch[2] || '').toLowerCase();
            }
        }
    }

    // Normaliza a unidade de medida (g, gr -> g)
    if (prod.unitMeasureType === 'gr') {
        prod.unitMeasureType = 'g';
    }

    // Formata a string de retorno para exibição (ex: "12X400G")
    let qtyUnitString = '';
    if (prod.unitsPerPackage > 0 && prod.unitMeasureValue > 0) {
        qtyUnitString = `${prod.unitsPerPackage}X${prod.unitMeasureValue}${prod.unitMeasureType.toUpperCase()}`;
    } else if (prod.unitMeasureValue > 0) {
        qtyUnitString = `${prod.unitMeasureValue}${prod.unitMeasureType.toUpperCase()}`;
    }

    return qtyUnitString;
}

function addItemToSimulation(itemId) {
    // Garante que a lista de itens da simulação existe para evitar erros
    if (!Array.isArray(currentSimulation.items)) {
        currentSimulation.items = [];
    }

    const item = { ...items.find(i => i.id === itemId) };
    const supplier = suppliers.find(s => s.id === item.supplierId);
    const calculatedQtyUnit = calculateSimulationItemQtyUnit(item, supplier, items);

    const quantity = 1; // Quantity is always 1 in the simulation phase

    const existingSimItem = currentSimulation.items.find(simItem => simItem.id === itemId);
    if (existingSimItem) {
        existingSimItem.operationQuantity = quantity;
        showNotification(`Quantidade de ${item.name} atualizada para ${quantity}.`, 'info');
    } else {
        currentSimulation.items.push({
            ...item,
            operationQuantity: quantity,
            operationPrice: item.salePrice || item.costPrice || 0, // Usa preço de venda ou custo
            qtyUnit: calculatedQtyUnit // Adiciona o qtyUnit calculado
        });
        showNotification(`${item.name} adicionado à simulação.`, 'success');
    }

    // Habilita os botões de ação se a simulação deixar de estar vazia
    if (currentSimulation.items.length > 0) {
        toggleSimulationActionButtons(true);
    }

    renderSimulationSelectedItems();
    renderSimulationAvailableItems();
    autoSaveSimulation();
}

window.addItemToSimulation = addItemToSimulation;
window.renderSimulationAvailableItems = renderSimulationAvailableItems; // Para o input de busca

export function openSimAddItemModal() {
    const supplierSelect = document.getElementById('simItemSupplier');
    supplierSelect.innerHTML = '';
    suppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.innerText = supplier.name;
        supplierSelect.appendChild(option);
    });

    // Adiciona sanitização para campos numéricos
    const sanitizeNumeric = (e) => { e.target.value = e.target.value.replace(/\D/g, ''); };
    document.getElementById('simItemCode').oninput = sanitizeNumeric;
    document.getElementById('simItemNcm').oninput = sanitizeNumeric;

    document.getElementById('sim-item-form').onsubmit = saveSimItem;
    openModal('sim-add-item-modal');
}

async function saveSimItem(event) {
    event.preventDefault();

    const currentUser = getCurrentUserProfile();
    if (!currentUser) {
        showNotification('Usuário não autenticado. Não é possível salvar o item.', 'danger');
        return;
    }

    // Captura todos os valores do formulário
    const name = document.getElementById('simItemName').value;
    const nameEn = document.getElementById('simItemNameEn').value;
    const code = document.getElementById('simItemCode').value;
    const ncm = document.getElementById('simItemNcm').value;
    const description = document.getElementById('simItemDescription').value;
    const costPrice = parseFloat(document.getElementById('simItemCostPrice').value);
    const supplierId = document.getElementById('simItemSupplier').value;
    const unitsPerPackage = parseInt(document.getElementById('simUnitsPerPackage').value) || 1;
    const unitMeasureValue = parseFloat(document.getElementById('simUnitMeasureValue').value) || 1;
    const unitMeasureType = document.getElementById('simUnitMeasureType').value;

    // --- VALIDAÇÃO DETALHADA ---
    const validationChecks = [
        { check: name, message: 'O campo "Nome do Item" é obrigatório.' },
        { check: code, message: 'O campo "Código/SKU" é obrigatório.' },
        { check: !isNaN(costPrice) && costPrice > 0, message: 'O "Preço de Custo" deve ser um número maior que zero.' },
        { check: supplierId, message: 'O campo "Fornecedor" é obrigatório.' },
        { check: !ncm || ncm.length === 8, message: 'O NCM, se preenchido, deve conter exatamente 8 dígitos.' }
    ];

    for (const rule of validationChecks) {
        if (!rule.check) {
            showNotification(rule.message, 'warning');
            return;
        }
    }

    const alreadyExists = items.some(item => item.code === code && item.supplierId === supplierId);
    if (alreadyExists) {
        showNotification('Um item com este Código/SKU e Fornecedor já existe no estoque.', 'danger');
        return;
    }

    const newItemData = {
        user_id: currentUser.id,
        name: name,
        name_en: nameEn,
        code: code,
        ncm: ncm,
        description: description || `Item ${name} adicionado via simulação.`,
        cost_price: costPrice,
        sale_price: costPrice * 1.25,
        supplier_id: supplierId,
        quantity: 0,
        min_quantity: 0,
        units_per_package: unitsPerPackage,
        package_type: unitsPerPackage > 1 ? 'caixa' : 'unidade',
        unit_measure_value: unitMeasureValue,
        unit_measure_type: unitMeasureType,
        image_url: null
    };

    try {
        const addedItem = await addItem(newItemData);
        items.push(addedItem);
        showNotification(`Novo item "${name}" foi adicionado ao estoque!`, 'success');
    } catch (error) {
        showNotification(`Erro ao salvar novo item: ${error.message}`, 'danger');
        console.error("Erro ao salvar novo item:", error);
        return;
    }

    closeModal('sim-add-item-modal');
    document.getElementById('sim-item-form').reset();
    renderSimulationAvailableItems();
}




export function resumeSimulation(simulationData) {
    currentSimulation = simulationData;
    document.getElementById('simulation-id').innerText = `ID: ${currentSimulation.id}`;
    renderSimulationAvailableItems();
    renderSimulationSelectedItems();
    renderSimulationSummary();
    openModal('simulation-modal');
    toggleSimulationActionButtons(true);
}



export async function createPurchaseOrder() {
    // Check if we are in editing mode
    if (currentSimulation.status === 'editing') {
        await updateExistingPurchaseOrder();
        return;
    }

    if (!currentSimulation || !currentSimulation.items || currentSimulation.items.length === 0) {
        showNotification('Adicione itens à simulação antes de criar uma Ordem de Compra.', 'warning');
        return;
    }

    const currentUser = getCurrentUserProfile();
    if (!currentUser) {
        showNotification('Usuário não autenticado. Não é possível criar a Ordem de Compra.', 'danger');
        return;
    }

    const newPurchaseOrder = {
        id: currentSimulation.id.replace('SIM', 'OC'),
        user_id: currentUser.id,
        date: new Date().toISOString(),
        items: currentSimulation.items,
        type: 'purchase_order',
        status: 'pending_xml'
    };

    try {
        const addedPO = await addPurchaseOrder(newPurchaseOrder);
        pendingPurchaseOrders.push(addedPO);
        showNotification(`Ordem de Compra ${addedPO.id} criada com sucesso!`, 'success');
    } catch (error) {
        showNotification(`Erro ao criar Ordem de Compra: ${error.message}`, 'danger');
        console.error("Erro ao criar Ordem de Compra:", error);
        return;
    }

    clearAutoSave();
    closeModal('simulation-modal');
    toggleSimulationActionButtons(false);
}

export function editPurchaseOrderInSimulation(purchaseOrder) {
    currentSimulation = {
        id: purchaseOrder.id,
        items: purchaseOrder.items.map(item => ({
            ...item,
            operationQuantity: item.operationQuantity || item.quantity || 1, // Fallback
            operationPrice: item.operationPrice || item.sale_price || item.cost_price || 0
        })),
        status: 'editing', // Custom status to indicate editing mode
        originalPoId: purchaseOrder.id
    };

    document.getElementById('simulation-id').innerText = `Editando OC: ${currentSimulation.id}`;

    // Change button text to indicate update
    const finalizeBtn = document.getElementById('sim-finalize-btn');
    finalizeBtn.innerText = 'Atualizar Ordem de Compra';
    // REMOVED onclick assignment to avoid duplicate listeners

    renderSimulationAvailableItems();
    renderSimulationSelectedItems();
    renderSimulationSummary();
    openModal('simulation-modal');
    toggleSimulationActionButtons(true);
}

async function updateExistingPurchaseOrder() {
    if (!currentSimulation || !currentSimulation.items || currentSimulation.items.length === 0) {
        showNotification('A simulação deve ter itens.', 'warning');
        return;
    }

    const updatedPO = {
        items: currentSimulation.items,
        status: 'pending_xml', // Reset status or keep? Usually pending_xml if items changed.
        suppliers: null // Force invoice.js to rebuild suppliers from items
    };

    try {
        const { updatePurchaseOrder } = await import('./database.js'); // Lazy import to avoid cycle if any
        const updatedPodb = await updatePurchaseOrder(currentSimulation.originalPoId, updatedPO);

        // Update local state in pendingPurchaseOrders if needed (reference based?)
        const poIndex = pendingPurchaseOrders.findIndex(p => p.id === currentSimulation.originalPoId);
        if (poIndex >= 0) {
            pendingPurchaseOrders[poIndex] = updatedPodb;
            // trigger render?
        }

        showNotification(`Ordem de Compra ${currentSimulation.originalPoId} atualizada!`, 'success');
        closeModal('simulation-modal');

        // Reset button
        // Reset button
        const finalizeBtn = document.getElementById('sim-finalize-btn');
        finalizeBtn.innerText = 'Gerar Ordem de Compra';
        // REMOVED onclick assignment

    } catch (error) {
        showNotification(`Erro ao atualizar: ${error.message}`, 'danger');
    }
}


export function finalizeSimulation() {
    // Esta função foi substituída pela createPurchaseOrder para implementar o novo fluxo de compra.
    // A lógica original de débito de estoque foi removida.
    showNotification('Esta função foi desativada. Use "Criar Ordem de Compra".', 'info');
}
