import { items, suppliers, operationsHistory, movements, saveData } from './database.js';
import { showNotification, openModal, closeModal } from './ui.js';

let currentOperation = { id: null, items: [], isEditing: false };

function openOperationModal(itensPreenchidos = null) {
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
            const itemDeEstoque = items.find(i => i.code === prodImportado.code);
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
    const availableItems = items.filter(item => item.quantity > 0);

    if (availableItems.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center">Nenhum item com stock disponível.</p>`;
        return;
    }

    availableItems.forEach(item => {
        const isAdded = currentOperation.items.some(opItem => opItem.id === item.id);
        const div = document.createElement('div');
        div.className = `p-3 rounded-md border ${isAdded ? 'bg-gray-100' : 'bg-white'}`;

        const boxesInStock = (item.unitsPerPackage > 0) ? Math.floor(item.quantity / item.unitsPerPackage) : 0;
        const packageLabel = item.packageType === 'fardo' ? (boxesInStock === 1 ? 'fardo' : 'fardos') : (boxesInStock === 1 ? 'caixa' : 'caixas');
        const stockDisplay = `${boxesInStock} ${packageLabel}`;
        const inputPackageLabel = item.packageType === 'fardo' ? 'Fardos' : 'Caixas';

        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold">${item.name}</p>
                    <p class="text-sm text-secondary">Em stock: ${stockDisplay}</p>
                </div>
                <button onclick="addItemToOperation('${item.id}')" class="btn btn-sm btn-primary ${isAdded ? 'hidden' : ''}" id="add-op-btn-${item.id}">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="mt-2 grid grid-cols-2 gap-2">
                <div>
                    <label class="text-xs font-medium">Qtd. Saída (${inputPackageLabel})</label>
                    <input type="number" id="op-qty-box-${item.id}" class="input-field text-sm p-1" min="1" max="${boxesInStock}">
                </div>
                <div>
                    <label class="text-xs font-medium">Preço Venda (Unit)</label>
                    <input type="number" id="op-price-${item.id}" class="input-field text-sm p-1" step="0.01" value="${item.salePrice}">
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function addItemToOperation(itemId) {
    const item = { ...items.find(i => i.id === itemId) };
    const qtyBoxInput = document.getElementById(`op-qty-box-${itemId}`);
    const priceInput = document.getElementById(`op-price-${itemId}`);
    
    const quantityInBoxes = parseInt(qtyBoxInput.value);
    const price = parseFloat(priceInput.value);

    if (!quantityInBoxes || quantityInBoxes <= 0) {
        showNotification("Por favor, insira uma quantidade válida.", "warning");
        return;
    }
    
    const quantityInUnits = quantityInBoxes * (item.unitsPerPackage || 1);

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
        container.innerHTML = `<div class="flex-grow flex items-center justify-center"><p class="text-secondary text-center">Nenhum item adicionado à operação.</p></div>`;
        return;
    }

    currentOperation.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-3 rounded-md bg-blue-50 border border-blue-200 flex justify-between items-center';
        
        const boxes = (item.unitsPerPackage > 0) ? Math.floor(item.operationQuantity / item.unitsPerPackage) : 0;
        const packageLabel = item.packageType === 'fardo' ? (boxes === 1 ? 'fardo' : 'fardos') : (boxes === 1 ? 'caixa' : 'caixas');
        const selectedDisplay = `${boxes} ${packageLabel}`;

        div.innerHTML = `
            <div>
                <p class="font-bold">${item.name}</p>
                <p class="text-sm text-blue-800">A sair: ${selectedDisplay} @ ${formatCurrency(item.operationPrice, 'BRL')}</p>
            </div>
            <button onclick="removeItemFromOperation('${item.id}')" class="btn-icon-danger btn-sm">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(div);
    });
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
        const boxes = (item.unitsPerPackage > 0) ? Math.floor(item.operationQuantity / item.unitsPerPackage) : 0;
        totalBoxes += boxes;

        let itemNetWeight = item.operationQuantity * (item.unitMeasureValue || 0);
        if (item.unitMeasureType === 'g' || item.unitMeasureType === 'ml') {
            itemNetWeight /= 1000;
        }
        totalNetWeight += itemNetWeight;
        totalAmount += item.operationQuantity * item.operationPrice;
    });
    
    const totalGrossWeight = totalNetWeight * 1.035;

    summaryContainer.innerHTML = `
        <div class="flex justify-between"><span class="font-medium text-gray-600">Total de Embalagens:</span><span class="font-bold">${totalBoxes}</span></div>
        <div class="flex justify-between"><span class="font-medium text-gray-600">Peso Líquido Total (est.):</span><span class="font-bold">${totalNetWeight.toFixed(2)} kg</span></div>
        <div class="flex justify-between"><span class="font-medium text-gray-600">Peso Bruto Total (est.):</span><span class="font-bold">${totalGrossWeight.toFixed(2)} kg</span></div>
        <div class="flex justify-between text-lg mt-2 pt-2 border-t"><span class="font-bold text-gray-800">Valor Total:</span><span class="font-bold text-success">${formatCurrency(totalAmount, 'BRL')}</span></div>
    `;
}

function finalizeOperationAndGenerate(docType) {
    if (currentOperation.items.length === 0) {
        showNotification("Adicione pelo menos um item à operação antes de finalizar.", 'warning');
        return;
    }

    if (currentOperation.isEditing) {
        const originalOpIndex = operationsHistory.findIndex(op => op.id === currentOperation.id);
        if (originalOpIndex === -1) {
            showNotification("Erro: Operação original não encontrada para editar.", "danger");
            return;
        }
        const originalOp = operationsHistory[originalOpIndex];
        originalOp.items.forEach(opItem => {
            const itemIndex = items.findIndex(i => i.id === opItem.id);
            if (itemIndex > -1) {
                items[itemIndex].quantity += opItem.operationQuantity;
            }
        });
        movements = movements.filter(mov => mov.operationId !== originalOp.id);
        currentOperation.date = new Date().toISOString(); 
        operationsHistory[originalOpIndex] = { ...currentOperation };
        showNotification(`Operação ${currentOperation.id} atualizada com sucesso!`, 'success');

    } else {
        operationsHistory.unshift({ ...currentOperation });
        showNotification(`Operação ${currentOperation.id} criada com sucesso!`, 'success');
    }

    currentOperation.items.forEach(opItem => {
        const itemIndex = items.findIndex(i => i.id === opItem.id);
        if (itemIndex > -1) {
            items[itemIndex].quantity -= opItem.operationQuantity;
        }
        const movement = {
            id: `mov_${Date.now()}_${opItem.id}`,
            itemId: opItem.id, type: 'out', quantity: opItem.operationQuantity,
            price: opItem.operationPrice, reason: `Saída por Operação`,
            operationId: currentOperation.id, date: currentOperation.date
        };
        movements.push(movement);
    });
    
    regenerateDocument(currentOperation.id, docType);
    
    closeModal('operation-modal');
    fullUpdate();
}

function regenerateDocument(operationId, docType) {
    const operationData = operationsHistory.find(op => op.id === operationId);
    if (!operationData) {
        showNotification('Operação não encontrada no histórico.', 'danger');
        return;
    }

    const dataForDocument = {
        operation: operationData,
        allSuppliers: suppliers 
    };

    if (docType === 'invoice') {
        sessionStorage.setItem('invoiceData', JSON.stringify(dataForDocument));
        window.open('gerenciador_invoice.html', '_blank');

    } else if (docType === 'packlist') {
        sessionStorage.setItem('packlistData', JSON.stringify(dataForDocument));
        window.open('gerador_packing_list.html', '_blank');
    }
}

function editOperation(operationId) {
    const operationToEdit = operationsHistory.find(op => op.id === operationId);
    if (!operationToEdit) {
        showNotification('Operação não encontrada no histórico.', 'danger');
        return;
    }

    closeModal('reports-modal');
    
    currentOperation = {
        ...JSON.parse(JSON.stringify(operationToEdit)),
        isEditing: true
    };
    
    document.getElementById('operation-modal-title').innerText = `A editar Operação`;
    document.getElementById('operation-id').innerText = `ID: ${currentOperation.id}`;
    
    renderOperationAvailableItems();
    renderOperationSelectedItems();
    updateOperationSummary();
    openModal('operation-modal');
}

export { openOperationModal, editOperation, finalizeOperationAndGenerate };
