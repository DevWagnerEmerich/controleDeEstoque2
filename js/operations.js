import { 
    addItem, updateItem, deleteItem, addSupplier, updateSupplier, addMovement, addOperationToHistory,
    addPendingPurchaseOrder, updatePendingPurchaseOrder, deletePendingPurchaseOrder
} from './database.js';
import { showNotification, openModal, closeModal, formatCurrency, fullUpdate, normalizeCnpj } from './ui.js';
import { checkPermission } from './auth.js';
import { appData } from './main.js'; // Importa a variável global de dados

let currentOperation = { id: null, items: [], isEditing: false };

export function openOperationModal(itensPreenchidos = null) {
    if (!checkPermission('operation')) {
        showNotification('Não tem permissão para criar operações.', 'danger');
        return;
    }
    currentOperation = {
        id: `OP-${Date.now()}`,
        date: new Date().toISOString(),
        items: [],
        isEditing: false
    };

    if (itensPreenchidos && Array.isArray(itensPreenchidos)) {
        document.getElementById('operation-modal-title').innerText = 'Nova Operação (Itens Importados)';
        itensPreenchidos.forEach(prodImportado => {
            const itemDeEstoque = appData.items.find(i => i.code === prodImportado.code); // Usa appData.items
            if (itemDeEstoque) {
                currentOperation.items.push({
                    ...itemDeEstoque,
                    operationQuantity: prodImportado.quantity,
                    operationPrice: prodImportado.costPrice 
                });
            }
        });
    } else {
        document.getElementById('operation-modal-title').innerText = 'Nova Operação de Saída';
    }
    
    document.getElementById('operation-id').innerText = `ID: ${currentOperation.id}`;
    renderOperationAvailableItems();
    renderOperationSelectedItems();
    updateOperationSummary();
    openModal('operation-modal');
}

function renderOperationAvailableItems() {
    const container = document.getElementById('operation-available-items');
    container.innerHTML = '';
    const availableItems = appData.items.filter(item => item.quantity > 0); // Usa appData.items

    if (availableItems.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center">Nenhum item com stock disponível.</p>`;
        return;
    }

    availableItems.forEach(item => {
        const isAdded = currentOperation.items.some(opItem => opItem.id === item.id);
        const div = document.createElement('div');
        div.className = `op-item-card available ${isAdded ? 'added' : ''}`;

        const boxesInStock = (item.units_per_package > 0) ? Math.floor(item.quantity / item.units_per_package) : 0; // Ajustado para units_per_package
        const packageLabel = item.package_type === 'fardo' ? (boxesInStock === 1 ? 'fardo' : 'fardos') : (boxesInStock === 1 ? 'caixa' : 'caixas'); // Ajustado para package_type
        const stockDisplay = `${boxesInStock} ${packageLabel}`;
        const inputPackageLabel = item.package_type === 'fardo' ? 'Fardos' : 'Caixas'; // Ajustado para package_type

        div.innerHTML = `
            <div class="op-item-info">
                <p class="op-item-name">${item.name}</p>
                <p class="op-item-stock">Em stock: ${stockDisplay}</p>
            </div>
            <div class="op-item-actions">
                <div class="input-group">
                    <label>Qtd. (${inputPackageLabel})</label>
                    <input type="number" id="op-qty-box-${item.id}" class="form-input" min="1" max="${boxesInStock}">
                </div>
                <div class="input-group">
                    <label>Preço Venda</label>
                    <input type="number" id="op-price-${item.id}" class="form-input" step="0.01" value="${item.sale_price}">
                </div>
                <button class="btn btn-add-op" id="add-op-btn-${item.id}">Adicionar</button>
            </div>
        `;
        div.querySelector('.btn-add-op').addEventListener('click', () => addItemToOperation(item.id));
        container.appendChild(div);
    });
    feather.replace();
}

async function addItemToOperation(itemId) {
    const item = { ...appData.items.find(i => i.id === itemId) }; // Usa appData.items
    const qtyBoxInput = document.getElementById(`op-qty-box-${itemId}`);
    const priceInput = document.getElementById(`op-price-${itemId}`);
    
    const quantityInBoxes = parseInt(qtyBoxInput.value);
    const price = parseFloat(priceInput.value);

    if (!quantityInBoxes || quantityInBoxes <= 0) {
        showNotification("Por favor, insira uma quantidade válida.", "warning");
        return;
    }
    
    const quantityInUnits = quantityInBoxes * (item.units_per_package || 1); // Ajustado para units_per_package

    if (quantityInUnits > item.quantity) {
        showNotification("A quantidade de saída não pode ser maior que o stock disponível.", "warning");
        return;
    }

    currentOperation.items.push({
        ...item,
        operationQuantity: quantityInUnits,
        operationPrice: price
    });

    renderOperationSelectedItems();
    renderOperationAvailableItems();
    updateOperationSummary();
}

function renderOperationSelectedItems() {
    const container = document.getElementById('operation-selected-items');
    container.innerHTML = '';

    if (currentOperation.items.length === 0) {
        container.innerHTML = `<div class="panel-empty-state"><p>Nenhum item adicionado.</p></div>`;
        return;
    }

    currentOperation.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'op-item-card selected';
        
        const boxes = (item.units_per_package > 0) ? Math.floor(item.operationQuantity / item.units_per_package) : 0; // Ajustado para units_per_package
        const packageLabel = item.package_type === 'fardo' ? (boxes === 1 ? 'fardo' : 'fardos') : (boxes === 1 ? 'caixa' : 'caixas'); // Ajustado para package_type
        const selectedDisplay = `${boxes} ${packageLabel}`;

        div.innerHTML = `
            <div class="op-item-info">
                <p class="op-item-name">${item.name}</p>
                <p class="op-item-stock">A sair: ${selectedDisplay} @ ${formatCurrency(item.operationPrice, 'BRL')}</p>
            </div>
            <button class="btn-remove-op">
                <i data-feather="x"></i>
            </button>
        `;
        div.querySelector('.btn-remove-op').addEventListener('click', () => removeItemFromOperation(item.id));
        container.appendChild(div);
    });
    feather.replace();
}

function removeItemFromOperation(itemId) {
    currentOperation.items = currentOperation.items.filter(item => item.id !== itemId);
    renderOperationSelectedItems();
    renderOperationAvailableItems();
    updateOperationSummary();
}

function updateOperationSummary() {
    const summaryContainer = document.getElementById('operation-summary');
    if (currentOperation.items.length === 0) {
        summaryContainer.innerHTML = '';
        return;
    }

    let totalBoxes = 0;
    let totalNetWeight = 0;
    let totalAmount = 0;

    currentOperation.items.forEach(item => {
        const boxes = (item.units_per_package > 0) ? Math.floor(item.operationQuantity / item.units_per_package) : 0; // Ajustado para units_per_package
        totalBoxes += boxes;

        let itemNetWeight = item.operationQuantity * (item.unit_measure_value || 0); // Ajustado para unit_measure_value
        if (item.unit_measure_type === 'g' || item.unit_measure_type === 'ml') { // Ajustado para unit_measure_type
            itemNetWeight /= 1000;
        }
        totalNetWeight += itemNetWeight;
        totalAmount += item.operationQuantity * item.operationPrice;
    });
    
    const totalGrossWeight = totalNetWeight * 1.035;

    summaryContainer.innerHTML = `
        <div class="summary-row">
            <span>Total de Embalagens:</span>
            <span class="summary-value">${totalBoxes}</span>
        </div>
        <div class="summary-row">
            <span>Peso Líquido Total (est.):</span>
            <span class="summary-value">${totalNetWeight.toFixed(2)} kg</span>
        </div>
        <div class="summary-row">
            <span>Peso Bruto Total (est.):</span>
            <span class="summary-value">${totalGrossWeight.toFixed(2)} kg</span>
        </div>
        <div class="summary-total">
            <span>Valor Total:</span>
            <span class="summary-value total">${formatCurrency(totalAmount, 'BRL')}</span>
        </div>
    `;
}

export async function saveManualOperation() { // Adicionado async aqui
    if (currentOperation.items.length === 0) {
        showNotification("Adicione pelo menos um item à operação antes de finalizar.", 'warning');
        return;
    }

    // Cria uma cópia segura da operação para salvar
    const operationToSave = {
        operation_id: currentOperation.id, // Usar operation_id para corresponder ao esquema do BD
        date: currentOperation.date,
        items: currentOperation.items.map(item => ({ // Mapeia para remover propriedades desnecessárias e ajustar nomes
            id: item.id,
            name: item.name,
            code: item.code,
            quantity: item.operationQuantity,
            price: item.operationPrice
        })),
        type: 'manual'
    };

    const addedOperation = await addOperationToHistory(operationToSave); // Salva a operação no Supabase
    if (!addedOperation) {
        showNotification('Erro ao salvar operação!', 'danger');
        return;
    }

    showNotification(`Operação ${addedOperation.operation_id} criada com sucesso!`, 'success');

    // Atualiza o stock e cria os registos de movimento
    for (const opItem of currentOperation.items) { // Usar for...of para await
        const itemToUpdate = appData.items.find(i => i.id === opItem.id); // Usa appData.items
        if (itemToUpdate) {
            const newQuantity = itemToUpdate.quantity - opItem.operationQuantity;
            const updatedItem = await updateItem(itemToUpdate.id, { quantity: newQuantity, updated_at: new Date().toISOString() }); // Atualiza no Supabase
            if (!updatedItem) {
                showNotification(`Erro ao atualizar stock do item ${itemToUpdate.name}!`, 'danger');
                return;
            }
        }
        const movement = {
            item_id: opItem.id, // Ajustado para item_id
            type: 'out',
            quantity: opItem.operationQuantity,
            price: opItem.operationPrice,
            reason: `Saída por Operação`,
            operation_id: addedOperation.id, // Link para a operação recém-criada
            created_at: new Date().toISOString()
        };
        const newMovement = await addMovement(movement); // Adiciona movimento no Supabase
        if (!newMovement) {
            showNotification(`Erro ao registar movimento para o item ${opItem.name}!`, 'danger');
            return;
        }
    }
    
    closeModal('operation-modal');
    await fullUpdate(); // Atualiza a UI
    document.dispatchEvent(new CustomEvent('operation-saved'));
}

export function regenerateDocument(operationId, docType) {
    // Esta função precisará ser adaptada para buscar dados do Supabase
    // e não usar localStorage.setItem
    showNotification('Funcionalidade de Invoice/Packing List precisa ser adaptada para Supabase.', 'info');
}
window.regenerateDocument = regenerateDocument;

export async function finalizarOperacaoDeImportacao(stagedNfeData, operationId) { // Adicionado async aqui
    for (const nfe of stagedNfeData) { // Usar for...of para await
        const { fornecedor, produtos, notaFiscal } = nfe;

        // 1. Garante que o fornecedor existe
        const nfeCnpj = fornecedor.cnpj ? normalizeCnpj(fornecedor.cnpj) : '';
        let supplier = nfeCnpj ? appData.suppliers.find(s => normalizeCnpj(s.cnpj) === nfeCnpj) : null; // Usa appData.suppliers
        if (!supplier) {
            const newSupplierData = {
                name: fornecedor.nome,
                cnpj: fornecedor.cnpj,
                address: fornecedor.address || ''
            };
            supplier = await addSupplier(newSupplierData); // Adiciona no Supabase
            if (!supplier) {
                showNotification(`Erro ao adicionar fornecedor ${fornecedor.nome}!`, 'danger');
                continue;
            }
            showNotification(`Novo fornecedor "${supplier.name}" registado.`, 'info');
        } else {
            // Atualiza o endereço do fornecedor existente, caso tenha mudado ou não estivesse preenchido
            if (fornecedor.address && fornecedor.address !== supplier.address) {
                const updatedSupplier = await updateSupplier(supplier.id, { address: fornecedor.address }); // Atualiza no Supabase
                if (!updatedSupplier) {
                    showNotification(`Erro ao atualizar endereço do fornecedor ${supplier.name}!`, 'danger');
                }
            }
        }

        for (const prod of produtos) { // Usar for...of para await
            // 2. Garante que o item existe no estoque (por código e fornecedor)
            let existingItem = appData.items.find(item => item.code === prod.code && item.supplier_id === supplier.id); // Usa appData.items e supplier_id
            if (!existingItem) {
                const newItemData = {
                    name: prod.name,
                    name_en: '',
                    code: prod.code,
                    ncm: prod.ncm,
                    description: `Importado via NF-e ${notaFiscal.numero}`,
                    quantity: 0,
                    min_quantity: 10,
                    cost_price: prod.costPrice,
                    sale_price: prod.costPrice * 1.25,
                    supplier_id: supplier.id,
                    image: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                existingItem = await addItem(newItemData); // Adiciona no Supabase
                if (!existingItem) {
                    showNotification(`Erro ao adicionar item ${prod.name}!`, 'danger');
                    continue;
                }
                showNotification(`Novo item "${existingItem.name}" registado no estoque.`, 'info');
            }

            const itemId = existingItem.id;

            // 3. Cria o movimento de ENTRADA
            const inMovement = {
                item_id: itemId,
                type: 'in',
                quantity: prod.quantity,
                price: prod.costPrice,
                reason: `Entrada via NF-e: ${notaFiscal.numero}`,
                created_at: new Date().toISOString()
            };
            const newInMovement = await addMovement(inMovement); // Adiciona movimento no Supabase
            if (!newInMovement) {
                showNotification(`Erro ao registar entrada para o item ${prod.name}!`, 'danger');
                continue;
            }

            // 4. Cria o movimento de SAÍDA para a operação
            const outMovement = {
                item_id: itemId,
                type: 'out',
                quantity: prod.quantity,
                price: prod.costPrice,
                reason: `Saída por Operação de Importação`,
                operation_id: operationId, // Este operationId é o ID da operations_history
                created_at: new Date().toISOString()
            };
            const newOutMovement = await addMovement(outMovement); // Adiciona movimento no Supabase
            if (!newOutMovement) {
                showNotification(`Erro ao registar saída para o item ${prod.name}!`, 'danger');
                continue;
            }
        }
    }

    showNotification(`Movimentos de entrada/saída para ${stagedNfeData.length} NF-e(s) foram registados.`, 'success');
    await fullUpdate();
}

export async function stockInPurchaseOrder(orderId) { // Adicionado async aqui
    const orderToProcess = appData.pendingPurchaseOrders.find(op => op.id === orderId); // Usa appData.pendingPurchaseOrders
    if (!orderToProcess) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    if (orderToProcess.status !== 'pending_stock_entry') {
        showNotification(`A ordem de compra ${orderId} não está pronta para entrada no estoque.`, "warning");
        return;
    }

    // --- PART 1: Stock-IN (Entrada de Estoque) ---
    for (const orderItem of orderToProcess.items) { // Usar for...of para await
        const itemToUpdate = appData.items.find(i => i.id === orderItem.id); // Usa appData.items
        if (itemToUpdate) {
            const newQuantity = itemToUpdate.quantity + orderItem.operationQuantity;
            const updatedItem = await updateItem(itemToUpdate.id, { quantity: newQuantity, cost_price: orderItem.costPrice, updated_at: new Date().toISOString() }); // Atualiza no Supabase
            if (!updatedItem) {
                showNotification(`Erro ao atualizar stock do item ${itemToUpdate.name}!`, 'danger');
                return;
            }

            const inMovement = {
                item_id: orderItem.id,
                type: 'in',
                quantity: orderItem.operationQuantity,
                price: orderItem.costPrice,
                reason: `Entrada via OC ${orderToProcess.po_id}`, // Ajustado para po_id
                created_at: new Date().toISOString()
            };
            const newInMovement = await addMovement(inMovement); // Adiciona movimento no Supabase
            if (!newInMovement) {
                showNotification(`Erro ao registar entrada para o item ${itemToUpdate.name}!`, 'danger');
                return;
            }
        }
    }

    // --- PART 2: Transform the OC into an OP (Ordem de Saída) ---
    const finalOperation = { ...orderToProcess }; // Cria uma cópia para não modificar o original diretamente
    finalOperation.purchase_order_id = finalOperation.id; // Guarda o ID da OC original
    finalOperation.id = finalOperation.id.replace('OC-', 'OP-'); // Gera um novo ID para a operação
    finalOperation.type = 'manual'; // Ou um tipo mais específico
    finalOperation.status = 'completed';
    finalOperation.date = new Date().toISOString();

    const addedFinalOperation = await addOperationToHistory(finalOperation); // Adiciona a operação final no Supabase
    if (!addedFinalOperation) {
        showNotification('Erro ao finalizar operação de OC!', 'danger');
        return;
    }

    // --- PART 3: Create OUTgoing movements for the new OP ---
    for (const saleItem of finalOperation.items) { // Usar for...of para await
        const itemToUpdate = appData.items.find(i => i.id === saleItem.id); // Usa appData.items
        if (itemToUpdate) {
            const newQuantity = itemToUpdate.quantity - saleItem.operationQuantity;
            const updatedItem = await updateItem(itemToUpdate.id, { quantity: newQuantity, updated_at: new Date().toISOString() }); // Atualiza no Supabase
            if (!updatedItem) {
                showNotification(`Erro ao atualizar stock do item ${itemToUpdate.name} para saída!`, 'danger');
                return;
            }
        }
        const outMovement = {
            item_id: saleItem.id,
            type: 'out',
            quantity: saleItem.operationQuantity,
            price: saleItem.operationPrice,
            reason: `Saída por Operação de OC ${finalOperation.purchase_order_id}`,
            operation_id: addedFinalOperation.id, // Link para a operação recém-criada
            created_at: new Date().toISOString()
        };
        const newOutMovement = await addMovement(outMovement); // Adiciona movimento no Supabase
        if (!newOutMovement) {
            showNotification(`Erro ao registar saída para o item ${saleItem.name}!`, 'danger');
            return;
        }
    }

    // --- PART 4: Remover a Ordem de Compra Pendente ---
    const success = await deletePendingPurchaseOrder(orderToProcess.id); // Exclui do Supabase
    if (!success) {
        showNotification('Erro ao remover ordem de compra pendente!', 'danger');
        return;
    }

    showNotification(`Ordem de Compra ${orderToProcess.po_id} processada. Operação de Saída ${addedFinalOperation.operation_id} criada.`, 'success');
    await fullUpdate();
    regenerateDocument(addedFinalOperation.id, 'invoice');
}