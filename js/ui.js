import { checkPermission, currentUser, hashPassword, generateSalt } from './auth.js';
import { items, suppliers, movements, saveData, users, saveUsers, operationsHistory } from './database.js';

document.addEventListener('operation-saved', () => {
    openOperationsHistoryModal();
});

function applyPermissionsToUI() {
    if (!currentUser) return;

    // Mobile menu username
    document.getElementById('menu-username').textContent = currentUser.username;
    // Desktop nav username
    document.getElementById('desktop-username').textContent = currentUser.username;

    const isAdmin = currentUser.role === 'admin';
    
    // Toggle admin-only buttons
    document.getElementById('menu-users').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('desktop-users-btn').style.display = isAdmin ? 'flex' : 'none';

    // Disable/Enable buttons based on permissions
    document.getElementById('add-item-btn-header').disabled = !checkPermission('add');
    document.getElementById('desktop-add-item-btn').disabled = !checkPermission('add');
    
    renderItems();
}

export function normalizeCnpj(cnpj) {
    return cnpj ? String(cnpj).replace(/\D/g, '') : '';
}

function formatCnpj(value) {
    if (!value) return "";
    value = value.replace(/\D/g, '');
    value = value.replace(/^(\d{2})(\d)/, '$1.$2');
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
    value = value.replace(/(\d{4})(\d)/, '$1-$2');
    return value;
}

function formatPhone(value) {
    if (!value) return "";
    value = value.replace(/\D/g, '');
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    return value;
}

function formatNcm(value) {
    if (!value) return "";
    value = value.replace(/\D/g, '');
    value = value.replace(/^(\d{4})(\d)/, '$1.$2');
    value = value.replace(/^(\d{4})\.(\d{2})(\d)/, '$1.$2.$3');
    return value;
}

const getStatus = (item) => {
    if (item.quantity <= 0) return { text: 'Esgotado', class: 'bg-gray-200 text-gray-800', level: 3 };
    if (item.quantity <= item.minQuantity) return { text: 'Crítico', class: 'bg-red-100 text-red-800', level: 2 };
    if (item.quantity <= item.minQuantity * 1.2) return { text: 'Baixo', class: 'bg-yellow-100 text-yellow-800', level: 1 };
    return { text: 'OK', class: 'bg-green-100 text-green-800', level: 0 };
};

const formatCurrency = (value, currency = 'USD') => {
    const options = { style: 'currency', currency: currency, minimumFractionDigits: 2 };
    const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
    return new Intl.NumberFormat(locale, options).format(value || 0);
}

function renderItems() {
    const gridContainer = document.getElementById('items-grid-container');
    const emptyState = document.getElementById('empty-state');
    gridContainer.innerHTML = '';

    let filteredItems = [...items];
    
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filteredItems = filteredItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm) || 
            (item.nameEn && item.nameEn.toLowerCase().includes(searchTerm)) ||
            (item.code && item.code.toLowerCase().includes(searchTerm))
        );
    }

    const filterValue = document.getElementById('filterSelect').value;
    if (filterValue !== 'all') {
        filteredItems = filteredItems.filter(item => getStatus(item).text.toLowerCase() === filterValue);
    }

    const sortValue = document.getElementById('sortSelect').value;
    filteredItems.sort((a, b) => {
        switch (sortValue) {
            case 'name-asc': return a.name.localeCompare(b.name);
            case 'name-desc': return b.name.localeCompare(a.name);
            case 'qty-asc': return a.quantity - b.quantity;
            case 'qty-desc': return b.quantity - a.quantity;
            default: return 0;
        }
    });
    
    if (filteredItems.length === 0) {
        emptyState.classList.remove('hidden');
        gridContainer.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        gridContainer.classList.remove('hidden');
    }
    
    const canEdit = checkPermission('edit');
    const canDelete = checkPermission('delete');

    filteredItems.forEach(item => {
        const status = getStatus(item);
        const boxes = (item.unitsPerPackage > 0) ? Math.floor(item.quantity / item.unitsPerPackage) : 0;
        const packageLabel = item.packageType === 'fardo' ? 'Fardos' : 'Caixas';
        const stockDisplay = `${boxes} ${packageLabel}`;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-header">
                <img src="${item.image || 'https://placehold.co/100x100/F9FAFB/1F2937?text=' + item.name.charAt(0)}" alt="${item.name}" class="card-image">
                <div class="card-actions">
                    <button data-action="open-item" data-id="${item.id}" class="card-action-button" ${canEdit ? '' : 'disabled'} title="Editar Item"><i data-feather="edit-2"></i></button>
                    <button data-action="delete-item" data-id="${item.id}" class="card-action-button danger" ${canDelete ? '' : 'disabled'} title="Excluir Item"><i data-feather="trash-2"></i></button>
                </div>
            </div>
            <div class="card-body">
                <h3 class="card-title">${item.name}</h3>
                <p class="card-code">${item.code || 'N/A'}</p>
                <div class="card-info-row">
                    <span class="card-info-label">Preço Venda</span>
                    <span class="card-info-value">${formatCurrency(item.salePrice, 'BRL')}</span>
                </div>
                <div class="card-info-row">
                    <span class="card-info-label">Stock</span>
                    <span class="card-info-value">${stockDisplay}</span>
                </div>
            </div>
            <div class="card-footer">
                 <span class="status-badge status-${status.text.toLowerCase()}">${status.text}</span>
                 <button data-action="open-stock" data-id="${item.id}" class="add-stock-button">Adicionar Stock</button>
            </div>
        `;

        // Adicionar event listeners
        card.querySelector('.card-body').addEventListener('click', () => openItemDetailsModal(item.id));
        card.querySelector('[data-action="open-stock"]').addEventListener('click', () => openStockModal(item.id));
        card.querySelector('[data-action="open-item"]').addEventListener('click', (e) => { e.stopPropagation(); openItemModal(item.id); });
        card.querySelector('[data-action="delete-item"]').addEventListener('click', (e) => { e.stopPropagation(); deleteItem(item.id); });

        gridContainer.appendChild(card);
    });

    // Ativar os ícones da Feather
    feather.replace();
}



function renderDashboardStats() {
    const statsContainer = document.getElementById('dashboard-stats');
    if (!statsContainer) return;

    const totalItems = items.length;
    const totalValue = items.reduce((acc, item) => acc + (item.quantity * item.costPrice), 0);
    const lowStockItems = items.filter(item => item.quantity > 0 && item.quantity <= item.minQuantity).length;
    const outOfStockItems = items.filter(item => item.quantity <= 0).length;

    const stats = [
        { label: 'Valor Total do Stock', value: formatCurrency(totalValue, 'BRL'), icon: 'dollar-sign' },
        { label: 'Itens Totais', value: totalItems, icon: 'package' },
        { label: 'Itens com Stock Baixo', value: lowStockItems, icon: 'trending-down' },
        { label: 'Itens Esgotados', value: outOfStockItems, icon: 'alert-triangle' }
    ];

    statsContainer.innerHTML = stats.map(stat => `
        <div class="stat-card">
            <div class="stat-icon-wrapper">
                <i data-feather="${stat.icon}"></i>
            </div>
            <div class="stat-info">
                <span class="stat-value">${stat.value}</span>
                <span class="stat-label">${stat.label}</span>
            </div>
        </div>
    `).join('');

    feather.replace();
}

function fullUpdate() {
    renderDashboardStats();
    renderItems();
    renderOperationsHistory(); // Atualiza o histórico na aba de relatórios
    renderOperationsHistoryModal(); // Atualiza o conteúdo do modal de histórico
    saveData();
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        document.body.classList.add('modal-is-open');
        modal.classList.add('is-open');
        feather.replace();
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        document.body.classList.remove('modal-is-open');
        modal.classList.remove('is-open');

        // Limpa o hash da URL para evitar que o modal de histórico seja reaberto
        history.pushState("", document.title, window.location.pathname + window.location.search);

        // --- CORREÇÃO: Garante que uma view principal esteja sempre visível ---
        // Aguarda a transição do modal terminar antes de verificar
        setTimeout(() => {
            const anyViewVisible = [...document.querySelectorAll('.main-view')].some(
                view => !view.classList.contains('hidden')
            );
    
            // Se nenhuma view estiver visível, mostra o dashboard por padrão.
            if (!anyViewVisible) {
                showView('dashboard');
            }
        }, 300); // 300ms é a duração da transição do modal
    }
}

function showConfirmModal(title, text, onConfirm) {
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-text').innerText = text;

    const confirmBtn = document.getElementById('confirm-modal-btn');
    
    // Replace the button with a clone of itself to remove old event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    // Add the new event listener
    newConfirmBtn.addEventListener('click', () => {
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
        closeModal('confirm-modal');
    });

    openModal('confirm-modal');
}

function openItemDetailsModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const supplier = suppliers.find(s => s.id === item.supplierId);
    const margin = item.costPrice > 0 ? ((item.salePrice - item.costPrice) / item.costPrice) * 100 : 0;
    const totalBoxes = (item.unitsPerPackage > 0) ? Math.floor(item.quantity / item.unitsPerPackage) : 0;

    document.getElementById('details-item-name').innerText = item.name;
    document.getElementById('details-item-name-en').innerText = item.nameEn || '';
    document.getElementById('details-item-image').src = item.image || `https://placehold.co/300x300/e0e7ff/4f46e5?text=${item.name.charAt(0)}`;
    document.getElementById('details-item-cost').innerText = formatCurrency(item.costPrice, 'BRL');
    document.getElementById('details-item-sale').innerText = formatCurrency(item.salePrice, 'BRL');
    document.getElementById('details-item-margin').innerText = `${margin.toFixed(1)}%`;
    document.getElementById('details-item-description').innerText = item.description || 'Nenhuma descrição fornecida.';
    document.getElementById('details-item-quantity').innerText = item.quantity;
    document.getElementById('details-item-supplier').innerText = supplier ? supplier.name : 'Não especificado';
    document.getElementById('details-item-code').innerText = item.code || 'N/A';
    document.getElementById('details-item-ncm').innerText = item.ncm ? formatNcm(item.ncm) : 'N/A';
    document.getElementById('details-item-qty-unit').innerText = item.qtyUnit ? item.qtyUnit.toFixed(2) : 'N/A';
    document.getElementById('details-item-boxes').innerText = totalBoxes;
    document.getElementById('details-package-type-label').innerText = `Total de ${item.packageType}s`;

    const movementsContainer = document.getElementById('details-item-history');
    movementsContainer.innerHTML = '';
    const itemMovements = movements.filter(m => m.itemId === id).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (itemMovements.length === 0) {
        movementsContainer.innerHTML = `<p class="text-secondary text-center py-4">Nenhuma movimentação para este item.</p>`;
    } else {
        itemMovements.forEach(mov => {
            const div = document.createElement('div');
            div.className = `report-movement-item ${mov.type}`;
            div.innerHTML = `
                <div class="movement-info">
                    <span class="font-bold uppercase">${mov.type === 'in' ? 'Entrada' : 'Saída'}</span>
                    <span class="text-secondary">(${mov.quantity} un.)</span>
                    ${mov.operationId ? `<span class="movement-op">(${mov.operationId})</span>` : ''}
                </div>
                <span class="movement-date">${new Date(mov.date).toLocaleString('pt-BR')}</span>
            `;
            movementsContainer.appendChild(div);
        });
    }

    openModal('item-details-modal');
}

async function openItemModal(id = null) {
    if (id && !checkPermission('edit')) {
        showNotification('Não tem permissão para editar itens.', 'danger');
        return;
    }
    if (!id && !checkPermission('add')) {
        showNotification('Não tem permissão para adicionar itens.', 'danger');
        return;
    }

    const itemForm = document.getElementById('item-form');
    itemForm.reset();
    document.getElementById('itemId').value = '';
    previewImage(null, 'imagePreview', 'imagePlaceholder');

    const supplierSelect = document.getElementById('itemSupplier');
    supplierSelect.innerHTML = `<option value="">Sem fornecedor</option>`;
    suppliers.forEach(s => {
        supplierSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });

    const ncmInput = document.getElementById('itemNcm');
    const codeInput = document.getElementById('itemCode');

    const sanitizeNumericInput = (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    };

    ncmInput.addEventListener('input', (e) => {
        sanitizeNumericInput(e);
        e.target.value = formatNcm(e.target.value);
    });
    codeInput.addEventListener('input', sanitizeNumericInput);

    if (id) {
        const item = items.find(i => i.id === id);
        if (item) {
            document.getElementById('item-modal-title').innerText = 'Editar Item';
            document.getElementById('itemId').value = item.id;
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemNameEn').value = item.nameEn;
            document.getElementById('itemCode').value = item.code;
            document.getElementById('itemNcm').value = formatNcm(item.ncm);
            document.getElementById('itemDescription').value = item.description;
            const boxes = (item.unitsPerPackage > 0) ? (item.quantity / item.unitsPerPackage) : 0;
            document.getElementById('quantityInBoxes').value = boxes;
            document.getElementById('itemMinQuantity').value = item.minQuantity;
            document.getElementById('itemCostPrice').value = item.costPrice;
            document.getElementById('itemSalePrice').value = item.salePrice;
            document.getElementById('itemSupplier').value = item.supplierId;
            document.getElementById('packageType').value = item.packageType || 'caixa';
            document.getElementById('unitsPerPackage').value = item.unitsPerPackage;
            document.getElementById('unitMeasureValue').value = item.unitMeasureValue;
            document.getElementById('unitMeasureType').value = item.unitMeasureType || 'g';
            if (item.image) {
                const preview = document.getElementById('imagePreview');
                preview.src = item.image;
                preview.classList.remove('hidden');
                document.getElementById('imagePlaceholder').classList.add('hidden');
            }
        }
    } else {
        document.getElementById('item-modal-title').innerText = 'Adicionar Novo Item';
    }

    itemForm.onsubmit = async (e) => {
        e.preventDefault();

        // --- 1. Coleta e Validação de Dados ---
        const name = document.getElementById('itemName').value;
        const costPrice = document.getElementById('itemCostPrice').value;
        const salePrice = document.getElementById('itemSalePrice').value;
        const unitsPerPackageRaw = document.getElementById('unitsPerPackage').value;
        const quantityInBoxesRaw = document.getElementById('quantityInBoxes').value;

        if (!name) {
            showNotification('O nome do item é obrigatório.', 'warning');
            return;
        }
        if (!costPrice) {
            showNotification('O Preço de Custo é obrigatório.', 'warning');
            return;
        }
        if (!salePrice) {
            showNotification('O Preço de Venda é obrigatório.', 'warning');
            return;
        }
        if (!unitsPerPackageRaw) {
            showNotification('Unidades por Embalagem é obrigatório.', 'warning');
            return;
        }
        if (!quantityInBoxesRaw) {
            showNotification('A Quantidade em Stock é obrigatória.', 'warning');
            return;
        }

        // --- 2. Processamento e Parsing ---
        const ncm = document.getElementById('itemNcm').value;
        const ncmDigits = ncm.replace(/\D/g, '');
        if (ncm && ncmDigits.length !== 8) {
            showNotification('O NCM deve conter exatamente 8 dígitos.', 'warning');
            return;
        }

        const unitsPerPackage = parseInt(unitsPerPackageRaw, 10);
        const quantityInBoxes = parseInt(quantityInBoxesRaw, 10);
        const minQuantity = parseInt(document.getElementById('itemMinQuantity').value, 10);
        const parsedCostPrice = parseFloat(costPrice);
        const parsedSalePrice = parseFloat(salePrice);
        const unitMeasureValue = parseFloat(document.getElementById('unitMeasureValue').value);

        if (isNaN(unitsPerPackage) || isNaN(quantityInBoxes) || isNaN(minQuantity) || isNaN(parsedCostPrice) || isNaN(parsedSalePrice)) {
            showNotification('Campos numéricos inválidos. Verifique as quantidades e preços.', 'danger');
            return;
        }

        const itemId = document.getElementById('itemId').value;
        const imageFile = document.getElementById('itemImageInput').files[0];
        let imageBase64 = null;

        if (imageFile) {
            try {
                imageBase64 = await readFileAsBase64(imageFile);
            } catch (error) {
                showNotification('Erro ao processar a imagem.', 'danger');
                return;
            }
        }

        // --- 3. Montagem do Objeto de Dados ---
        const itemData = {
            name,
            nameEn: document.getElementById('itemNameEn').value,
            code: document.getElementById('itemCode').value,
            ncm: document.getElementById('itemNcm').value.replace(/\D/g, ''),
            description: document.getElementById('itemDescription').value,
            supplierId: document.getElementById('itemSupplier').value,
            packageType: document.getElementById('packageType').value,
            unitsPerPackage,
            quantity: quantityInBoxes * unitsPerPackage,
            minQuantity,
            costPrice: parsedCostPrice,
            salePrice: parsedSalePrice,
            unitMeasureValue: isNaN(unitMeasureValue) ? 0 : unitMeasureValue,
            unitMeasureType: document.getElementById('unitMeasureType').value,
            updatedAt: new Date().toISOString(),
        };

        // --- 4. Salvamento ---
        if (itemId) { // Editando
            const itemIndex = items.findIndex(i => i.id === itemId);
            if (itemIndex > -1) {
                const existingItem = items[itemIndex];
                items[itemIndex] = { 
                    ...existingItem, 
                    ...itemData, 
                    image: imageBase64 || existingItem.image // Mantém a imagem antiga se nenhuma nova for enviada
                };
                showNotification('Item atualizado com sucesso!', 'success');
            }
        } else { // Criando
            const newItem = {
                ...itemData,
                id: `item_${Date.now()}`,
                image: imageBase64
            };
            items.push(newItem);
            showNotification('Item adicionado com sucesso!', 'success');
        }

        fullUpdate();
        closeModal('item-modal');
    };

    openModal('item-modal');
}

function deleteItem(id) {
    if (!checkPermission('delete')) {
         showNotification('Não tem permissão para excluir itens.', 'danger');
        return;
    }
    const itemToDelete = items.find(i => i.id === id);
    if (!itemToDelete) return;
    
    showConfirmModal(
        'Excluir Item?', 
        `Tem a certeza de que deseja excluir o item "${itemToDelete.name}"?`, 
        () => {
            const itemIndex = items.findIndex(i => i.id === id);
            if (itemIndex > -1) {
                items.splice(itemIndex, 1);
            }
            showNotification('Item excluído com sucesso!', 'danger');
            fullUpdate();
        }
    );
}

function openSuppliersModal() {
    renderSuppliersList();
    resetSupplierForm();

    const supplierForm = document.getElementById('supplier-form');
    const cnpjInput = document.getElementById('supplierCnpj');
    const phoneInput = document.getElementById('supplierPhone');
    
    cnpjInput.addEventListener('input', (e) => { e.target.value = formatCnpj(e.target.value); });
    phoneInput.addEventListener('input', (e) => { e.target.value = formatPhone(e.target.value); });

    supplierForm.onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('supplierId').value;
        const name = document.getElementById('supplierName').value;

        if (!name) {
            showNotification('O nome do fornecedor é obrigatório.', 'warning');
            return;
        }

        const supplierData = {
            name,
            cnpj: document.getElementById('supplierCnpj').value.replace(/\D/g, ''),
            address: document.getElementById('supplierAddress').value,
            fda: document.getElementById('supplierFda').value,
            email: document.getElementById('supplierEmail').value,
            salesperson: document.getElementById('supplierSalesperson').value,
            phone: document.getElementById('supplierPhone').value.replace(/\D/g, '')
        };

        if (id) { // Editando
            const supplierIndex = suppliers.findIndex(s => s.id === id);
            if (supplierIndex > -1) {
                suppliers[supplierIndex] = { ...suppliers[supplierIndex], ...supplierData };
                showNotification('Fornecedor atualizado com sucesso!', 'success');
            }
        } else { // Criando
            const newSupplier = {
                ...supplierData,
                id: `sup_${Date.now()}`
            };
            suppliers.push(newSupplier);
            showNotification('Fornecedor adicionado com sucesso!', 'success');
        }

        saveData();
        renderSuppliersList();
        resetSupplierForm();
    };

    openModal('suppliers-modal');
}

function renderSuppliersList() {
    const suppliersListContainer = document.getElementById('suppliers-list');
    suppliersListContainer.innerHTML = '';
    if (suppliers.length === 0) {
        suppliersListContainer.innerHTML = `<p class="text-secondary" style="text-align: center;">Nenhum fornecedor registado.</p>`;
        return;
    }
    suppliers.forEach(s => {
        const div = document.createElement('div');
        div.className = 'supplier-list-item';
        div.innerHTML = `
            <div onclick="editSupplier('${s.id}')" class="supplier-info">
                <span class="supplier-name">${s.name}</span>
                <p class="supplier-meta">${s.email || ''}</p>
            </div>
            <button onclick="deleteSupplier('${s.id}', event)" class="btn-delete-supplier"><i data-feather="trash-2"></i></button>
        `;
        suppliersListContainer.appendChild(div);
    });
    feather.replace();
}

function editSupplier(id) {
    const supplier = suppliers.find(s => s.id === id);
    if (!supplier) return;
    
    document.getElementById('supplier-form-title').innerText = "Editar Fornecedor";
    document.getElementById('supplierId').value = supplier.id;
    document.getElementById('supplierName').value = supplier.name;
    document.getElementById('supplierCnpj').value = formatCnpj(supplier.cnpj);
    document.getElementById('supplierAddress').value = supplier.address;
    document.getElementById('supplierFda').value = supplier.fda;
    document.getElementById('supplierEmail').value = supplier.email;
    document.getElementById('supplierSalesperson').value = supplier.salesperson;
    document.getElementById('supplierPhone').value = formatPhone(supplier.phone);
}
window.editSupplier = editSupplier;

function resetSupplierForm() {
    document.getElementById('supplier-form').reset();
    document.getElementById('supplierId').value = '';
    document.getElementById('supplier-form-title').innerText = "Adicionar Novo Fornecedor";
}

function deleteSupplier(id, event) {
    event.stopPropagation();
    const supplierToDelete = suppliers.find(s => s.id === id);
    if (!supplierToDelete) return;

    showConfirmModal(
        'Excluir Fornecedor?', 
        `Tem a certeza de que deseja excluir o fornecedor "${supplierToDelete.name}"?`, 
        () => {
            const supplierIndex = suppliers.findIndex(s => s.id === id);
            if (supplierIndex > -1) {
                suppliers.splice(supplierIndex, 1);
            }
            renderSuppliersList();
            resetSupplierForm();
            saveData();
            showNotification('Fornecedor excluído!', 'danger');
        }
    );
}
window.deleteSupplier = deleteSupplier;

function openStockModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const form = document.getElementById('stock-form');
    form.reset();
    document.getElementById('stockItemId').value = id;
    document.getElementById('stock-modal-title').innerText = `Entrada Manual: ${item.name}`;
    
    const packageLabel = item.packageType === 'fardo' ? 'Fardos' : 'Caixas';
    document.getElementById('movement-quantity-label').innerText = `Qtd. de ${packageLabel} a Adicionar`;

    form.onsubmit = (e) => {
        e.preventDefault();
        const itemId = document.getElementById('stockItemId').value;
        const itemToUpdate = items.find(i => i.id === itemId);
        if (!itemToUpdate) {
            showNotification('Erro: Item não encontrado.', 'danger');
            return;
        }

        const quantityInBoxes = parseInt(document.getElementById('movementQuantity').value, 10);
        if (isNaN(quantityInBoxes) || quantityInBoxes <= 0) {
            showNotification('Por favor, insira uma quantidade numérica válida e positiva.', 'warning');
            return;
        }

        const quantityInUnits = quantityInBoxes * (itemToUpdate.unitsPerPackage || 1);
        const reason = document.getElementById('movementReason').value || 'Entrada manual';

        // Atualizar a quantidade do item
        itemToUpdate.quantity += quantityInUnits;
        itemToUpdate.updatedAt = new Date().toISOString();

        // Criar registo de movimento
        const movement = {
            id: `mov_${Date.now()}_${itemId}`,
            itemId: itemId,
            type: 'in',
            quantity: quantityInUnits,
            price: itemToUpdate.costPrice, // Usa o preço de custo do item para a entrada
            reason: reason,
            date: new Date().toISOString()
        };
        movements.push(movement);

        fullUpdate();
        closeModal('stock-modal');
        showNotification(`Stock do item "${itemToUpdate.name}" atualizado com sucesso!`, 'success');
    };

    openModal('stock-modal');
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerText = message;
    container.appendChild(notif);
    
    setTimeout(() => {
        notif.classList.add('visible');
    }, 10);
    
    setTimeout(() => {
        notif.classList.remove('visible');
        setTimeout(() => notif.remove(), 500);
    }, 3000);
}

function previewImage(event, previewId, placeholderId) {
    const preview = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);
    if (event && event.target.files && event.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(event.target.files[0]);
    } else {
         preview.src = '#';
         preview.classList.add('hidden');
         if (placeholder) placeholder.classList.remove('hidden');
    }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function openUsersModal() {
    if (currentUser.role !== 'admin') {
        showNotification('Acesso negado.', 'danger');
        return;
    }
    renderUsersList();
    resetUserForm();
    openModal('users-modal');

    const userForm = document.getElementById('user-form');
    userForm.onsubmit = async (e) => {
        e.preventDefault();
        const userId = document.getElementById('userId').value;
        const username = document.getElementById('formUsername').value;
        const password = document.getElementById('formPassword').value;

        const permissions = {};
        document.querySelectorAll('#permissions-container input[type="checkbox"').forEach(el => {
            permissions[el.id.replace('perm-', '')] = el.checked;
        });

        if (userId) { // Editing user
            const user = users.find(u => u.id === userId);
            if (password) {
                user.salt = generateSalt();
                user.password = await hashPassword(password, user.salt);
            }
            user.permissions = permissions;
            showNotification('Usuário atualizado com sucesso!', 'success');
        } else { // Adding new user
            if (!password) {
                showNotification('A senha é obrigatória para novos usuários.', 'danger');
                return;
            }
            const salt = generateSalt();
            const hashedPassword = await hashPassword(password, salt);
            const newUser = {
                id: `user_${Date.now()}`,
                username,
                password: hashedPassword,
                salt,
                role: 'user', // Default role
                permissions
            };
            users.push(newUser);
            showNotification('Usuário adicionado com sucesso!', 'success');
        }
        saveUsers();
        renderUsersList();
        resetUserForm();
    };
}

function renderUsersList() {
    const usersListContainer = document.getElementById('users-list');
    usersListContainer.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-list-item';
        div.innerHTML = `
            <div onclick="editUser('${user.id}')" class="user-info">
                <span class="user-name">${user.username}</span>
                <p class="user-meta">${user.role}</p>
            </div>
            ${currentUser.username !== user.username ? `<button onclick="deleteUser('${user.id}', event)" class="btn-delete-user"><i data-feather="trash-2"></i></button>` : ''}
        `;
        usersListContainer.appendChild(div);
    });
    feather.replace();
}

function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('user-form-title').innerText = "Editar Usuário";
    document.getElementById('userId').value = user.id;
    document.getElementById('formUsername').value = user.username;
    document.getElementById('formUsername').disabled = true;
    document.getElementById('formPassword').value = '';
    document.getElementById('formPassword').placeholder = "Deixe em branco para não alterar";

    document.querySelectorAll('#permissions-container input[type="checkbox"').forEach(el => {
        const permKey = el.id.replace('perm-', '');
        el.checked = user.permissions[permKey] || false;
    });
}
window.editUser = editUser;

function resetUserForm() {
    document.getElementById('user-form').reset();
    document.getElementById('userId').value = '';
    document.getElementById('formUsername').disabled = false;
    document.getElementById('user-form-title').innerText = "Adicionar Novo Usuário";
    document.getElementById('formPassword').placeholder = "Palavra-passe";
}

function deleteUser(userId, event) {
    event.stopPropagation();
    if (currentUser.role !== 'admin') return;

    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;

    showConfirmModal(
        'Excluir Usuário?',
        `Tem a certeza de que deseja excluir o usuário "${userToDelete.username}"?`,
        () => {
            const userIndex = users.findIndex(u => u.id === userId);
            if (userIndex > -1) {
                users.splice(userIndex, 1);
            }
            saveUsers();
            renderUsersList();
            resetUserForm();
            showNotification('Usuário excluído!', 'danger');
        }
    );
}
window.deleteUser = deleteUser;

function renderOperationsHistory() {
    const container = document.getElementById('operations-history-list');
    if (!container) return;

    container.innerHTML = '';
    if (operationsHistory.length === 0) {
        container.innerHTML = `<div class="text-center py-8 bg-white rounded-lg border border-gray-200">
            <i class="fas fa-history text-4xl text-gray-300 mb-3"></i>
            <p class="text-secondary">Nenhuma operação realizada ainda.</p>
        </div>`;
        return;
    }

    operationsHistory.slice().reverse().forEach(op => {
        const opDate = new Date(op.date);
        const displayId = op.invoiceNumber || op.id;
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center';
        
        card.innerHTML = `
            <div class="flex-grow mb-4 sm:mb-0">
                <p class="font-bold text-primary-DEFAULT">OP: ${displayId}</p>
                <p class="text-sm text-secondary">Data: ${opDate.toLocaleDateString('pt-BR')} às ${opDate.toLocaleTimeString('pt-BR')}</p>
                <p class="text-sm text-secondary">Total de Itens: ${op.items.length}</p>
            </div>
            <div class="flex space-x-2 flex-shrink-0">
                <button data-op-id="${op.id}" class="btn-icon-secondary view-invoice-btn" title="Ver Invoice"><i class="fas fa-file-invoice-dollar"></i></button>
                <button data-op-id="${op.id}" class="btn-icon-secondary view-packlist-btn" title="Ver Packing List"><i class="fas fa-box-open"></i></button>
                <button data-op-id="${op.id}" class="btn-icon-danger delete-op-btn" title="Excluir Operação"><i class="fas fa-trash"></i></button>
            </div>
        `;

        container.appendChild(card);
    });

    // Adicionar event listeners para os novos botões
    document.querySelectorAll('#operations-history-list .view-invoice-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const opId = e.currentTarget.dataset.opId;
            const operation = operationsHistory.find(op => op.id === opId);
            if (operation) {
                sessionStorage.setItem('invoiceData', JSON.stringify({ operation, allSuppliers: suppliers, allItems: items }));
                window.open('gerenciador_invoice.html', '_blank');
            }
        });
    });

    document.querySelectorAll('#operations-history-list .view-packlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const opId = e.currentTarget.dataset.opId;
            const operation = operationsHistory.find(op => op.id === opId);
            if (operation) {
                sessionStorage.setItem('packlistData', JSON.stringify({ operation, allSuppliers: suppliers, allItems: items }));
                window.open('gerador_packing_list.html', '_blank');
            }
        });
    });

    document.querySelectorAll('#operations-history-list .delete-op-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const opId = e.currentTarget.dataset.opId;
            showConfirmModal('Excluir Operação?', `Tem a certeza que deseja excluir a operação ${opId}?`, () => {
                const opIndex = operationsHistory.findIndex(op => op.id === opId);
                if (opIndex > -1) {
                    operationsHistory.splice(opIndex, 1);
                }
                saveData();
                renderOperationsHistory(); // Apenas re-renderiza este componente
                showNotification('Operação excluída com sucesso!', 'danger');
            });
        });
    });
}



function showView(viewName) {
    // Esconde todas as telas principais
    document.querySelectorAll('.main-view').forEach(view => {
        view.classList.add('hidden');
    });

    // Mostra a tela alvo
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    // Limpa o hash da URL para evitar que o modal de histórico seja reaberto
    history.pushState("", document.title, window.location.pathname + window.location.search);

    // Atualiza o título do cabeçalho mobile
    const headerTitle = document.getElementById('header-title');
    const viewTitles = {
        dashboard: 'Dashboard',
        operations: 'Central de Operações',
        reports: 'Relatórios',
        menu: 'Menu'
    };
    headerTitle.textContent = viewTitles[viewName] || 'StockControl Pro';

    // Atualiza o estado ativo na navegação inferior (mobile)
    document.querySelectorAll('.nav-item').forEach(link => link.classList.remove('active'));
    const activeMobileLink = document.getElementById(`nav-${viewName}`);
    if (activeMobileLink) {
        activeMobileLink.classList.add('active');
    }

    // Atualiza o estado ativo na navegação superior (desktop)
    document.querySelectorAll('.top-nav .nav-link').forEach(link => link.classList.remove('active'));
    const activeDesktopLink = document.getElementById(`desktop-nav-${viewName}`);
    if (activeDesktopLink) {
        activeDesktopLink.classList.add('active');
    }
}

function renderOperationsHistoryModal() {
    const container = document.getElementById('operations-history-list-container');
    if (!container) return;

    container.innerHTML = '';
    if (operationsHistory.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 2rem;">
            <i data-feather="clock" style="width: 48px; height: 48px; margin: 0 auto 1rem; color: var(--text-secondary);"></i>
            <p class="text-secondary">Nenhuma operação realizada ainda.</p>
        </div>`;
        feather.replace();
    } else {
        const list = document.createElement('div');
        list.className = 'history-list';
        operationsHistory.slice().reverse().forEach(op => {
            const opDate = new Date(op.date);
            const typeBadge = op.type === 'import' 
                ? '<span class="badge import">Importada</span>' 
                : '<span class="badge manual">Manual</span>';

            // Use invoiceNumber as the primary display, with id as a safeguard.
            const displayId = op.invoiceNumber || op.id;

            const card = document.createElement('div');
            card.className = 'history-card';
            
            card.innerHTML = `
                <div class="history-card-details">
                    <div class="history-card-header">
                        <p class="history-id">OP: ${displayId}</p>
                        ${typeBadge}
                    </div>
                    <p class="history-meta">Data: ${opDate.toLocaleDateString('pt-BR')} às ${opDate.toLocaleTimeString('pt-BR')}</p>
                    <p class="history-meta">Total de Itens: ${op.nfeData ? op.nfeData.reduce((acc, nfe) => acc + nfe.produtos.length, 0) : op.items.length}</p>
                </div>
                <div class="history-card-actions">
                    <button data-op-id="${op.id}" class="btn btn-secondary view-invoice-btn" title="Ver Invoice"><i data-feather="file-text"></i></button>
                    <button data-op-id="${op.id}" class="btn btn-secondary view-packlist-btn" title="Ver Packing List"><i data-feather="package"></i></button>
                    <button data-op-id="${op.id}" class="btn btn-danger delete-op-btn" title="Excluir Operação"><i data-feather="trash-2"></i></button>
                </div>
            `;
            list.appendChild(card);
        });
        container.appendChild(list);

        // Adicionar event listeners após a renderização
        container.querySelectorAll('.view-invoice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const opId = e.currentTarget.dataset.opId;
                const operation = operationsHistory.find(op => op.id === opId);
                if (operation) {
                    localStorage.setItem('currentDocument', JSON.stringify({ operation, allSuppliers: suppliers, allItems: items }));
                    window.open('gerenciador_invoice.html?origin=history', '_self');
                }
            });
        });

        container.querySelectorAll('.view-packlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const opId = e.currentTarget.dataset.opId;
                const operation = operationsHistory.find(op => op.id === opId);
                if (operation) {
                    localStorage.setItem('currentDocument', JSON.stringify({ operation, allSuppliers: suppliers, allItems: items }));
                    window.open('gerador_packing_list.html', '_self');
                }
            });
        });

        container.querySelectorAll('.delete-op-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const opId = e.currentTarget.dataset.opId;
                deleteOperation(opId);
            });
        });

        feather.replace();
    }
}

function openOperationsHistoryModal() {
    renderOperationsHistoryModal();
    openModal('operations-history-modal');
}

function deleteOperation(operationId) {
    showConfirmModal(
        'Excluir Operação?',
        `Tem a certeza que deseja excluir a operação ${operationId}? Esta ação não pode ser desfeita.`,
        () => {
            const opIndex = operationsHistory.findIndex(op => op.id === operationId);
            if (opIndex === -1) {
                showNotification("Erro: Operação não encontrada para excluir.", "danger");
                return;
            }

            const operationToDelete = operationsHistory[opIndex];

            // 1. Reverter o stock dos itens
            operationToDelete.items.forEach(opItem => {
                const itemIndex = items.findIndex(i => i.id === opItem.id);
                if (itemIndex > -1) {
                    // Garante que a quantidade é um número antes de somar
                    items[itemIndex].quantity += Number(opItem.operationQuantity || 0);
                }
            });

            // 2. Remover os movimentos associados
            const movementsToRemove = movements
                .map((mov, index) => (mov.operationId === operationId ? index : -1))
                .filter(index => index !== -1);

            for (let i = movementsToRemove.length - 1; i >= 0; i--) {
                movements.splice(movementsToRemove[i], 1);
            }

            // 3. Remover a operação do histórico
            operationsHistory.splice(opIndex, 1);

            // 4. Salvar dados e atualizar a UI
            fullUpdate();
            showNotification(`Operação ${operationId} excluída com sucesso!`, 'danger');
            
            // 5. Re-renderizar o modal de histórico
            renderOperationsHistoryModal();
        }
    );
}
window.deleteOperation = deleteOperation;

export { 
    applyPermissionsToUI, fullUpdate, openModal, closeModal, 
    showConfirmModal, openItemModal, openSuppliersModal, openStockModal, 
    showNotification, openUsersModal, openItemDetailsModal, renderItems,
    previewImage, resetSupplierForm, resetUserForm, renderOperationsHistory,
    showView, formatCurrency, getStatus, renderOperationsHistoryModal, openOperationsHistoryModal
};