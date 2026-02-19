// js/ui.js
import { checkPermission, getCurrentUserProfile } from './auth.js';
import {
    items, suppliers, movements, users, operationsHistory,
    addItem, updateItem, deleteItemDB,
    addSupplier, updateSupplier, deleteSupplierDB,
    addMovement,
    updateUserStatus,
    addLocalItem, updateLocalItem, removeLocalItem,
    addLocalSupplier, updateLocalSupplier, removeLocalSupplier,
    addLocalMovement // Final imports
} from './database.js';
import { escapeHTML } from './utils/helpers.js';

document.addEventListener('operation-saved', () => {
    openOperationsHistoryModal();
});



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
    if (item.quantity <= item.min_quantity) return { text: 'Crítico', class: 'bg-red-100 text-red-800', level: 2 };
    if (item.quantity <= item.min_quantity * 1.2) return { text: 'Baixo', class: 'bg-yellow-100 text-yellow-800', level: 1 };
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
            (item.name_en && item.name_en.toLowerCase().includes(searchTerm)) ||
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
        const boxes = (item.units_per_package > 0) ? Math.floor(item.quantity / item.units_per_package) : 0;
        const packageLabel = item.package_type === 'fardo' ? 'Fardos' : 'Caixas';
        const stockDisplay = `${boxes} ${packageLabel}`;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-header">
                <img src="${item.image_url || 'https://placehold.co/100x100/F9FAFB/1F2937?text=' + escapeHTML(item.name.charAt(0))}" alt="${escapeHTML(item.name)}" class="card-image">
                <div class="card-actions">
                    <button data-action="open-item" data-id="${item.id}" class="card-action-button" ${canEdit ? '' : 'disabled'} title="Editar Item"><i data-feather="edit-2"></i></button>
                    <button data-action="delete-item" data-id="${item.id}" class="card-action-button danger" ${canDelete ? '' : 'disabled'} title="Excluir Item"><i data-feather="trash-2"></i></button>
                </div>
            </div>
            <div class="card-body">
                <h3 class="card-title">${escapeHTML(item.name)}</h3>
                <p class="card-code">${escapeHTML(item.code || 'N/A')}</p>
                <div class="card-info-row">
                    <span class="card-info-label">Preço Venda</span>
                    <span class="card-info-value">${formatCurrency(item.sale_price, 'BRL')}</span>
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

        card.querySelector('.card-body').addEventListener('click', () => openItemDetailsModal(item.id));
        card.querySelector('[data-action="open-stock"]').addEventListener('click', () => openStockModal(item.id));
        card.querySelector('[data-action="open-item"]').addEventListener('click', (e) => { e.stopPropagation(); openItemModal(item.id); });
        card.querySelector('[data-action="delete-item"]').addEventListener('click', (e) => { e.stopPropagation(); deleteItem(item.id); });

        gridContainer.appendChild(card);
    });

    feather.replace();
}



function renderDashboardStats() {
    const statsContainer = document.getElementById('dashboard-stats');
    if (!statsContainer) return;

    const totalItems = items.length;
    const totalValue = items.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0);
    const lowStockItems = items.filter(item => item.quantity > 0 && item.quantity <= item.min_quantity).length;
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
    renderOperationsHistory();
    renderOperationsHistoryModal();
}

// Focus Management
let lastFocusedElement = null;

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        lastFocusedElement = document.activeElement; // Save focus
        document.body.classList.add('modal-is-open');
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false'); // A11y
        const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus(); // Focus first element
        feather.replace();
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        document.body.classList.remove('modal-is-open');
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true'); // A11y
        if (lastFocusedElement) {
            lastFocusedElement.focus(); // Restore focus
            lastFocusedElement = null;
        }
        history.pushState("", document.title, window.location.pathname + window.location.search);
        setTimeout(() => {
            const anyViewVisible = [...document.querySelectorAll('.main-view')].some(
                view => !view.classList.contains('hidden')
            );
            if (!anyViewVisible) {
                showView('dashboard');
            }
        }, 300);
    }
}

function showConfirmModal(title, text, onConfirm) {
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-text').innerText = text;
    const confirmBtn = document.getElementById('confirm-modal-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
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
    const supplier = suppliers.find(s => s.id === item.supplier_id);
    const margin = item.cost_price > 0 ? ((item.sale_price - item.cost_price) / item.cost_price) * 100 : 0;
    const totalBoxes = (item.units_per_package > 0) ? Math.floor(item.quantity / item.units_per_package) : 0;
    document.getElementById('details-item-name').innerText = item.name;
    document.getElementById('details-item-name-en').innerText = item.name_en || '';
    document.getElementById('details-item-image').src = item.image_url || `https://placehold.co/300x300/e0e7ff/4f46e5?text=${item.name.charAt(0)}`;
    document.getElementById('details-item-cost').innerText = formatCurrency(item.cost_price, 'BRL');
    document.getElementById('details-item-sale').innerText = formatCurrency(item.sale_price, 'BRL');
    document.getElementById('details-item-margin').innerText = `${margin.toFixed(1)}%`;
    document.getElementById('details-item-description').innerText = item.description || 'Nenhuma descrição fornecida.';
    document.getElementById('details-item-quantity').innerText = item.quantity;
    document.getElementById('details-item-supplier').innerText = supplier ? supplier.name : 'Não especificado';
    document.getElementById('details-item-code').innerText = item.code || 'N/A';
    document.getElementById('details-item-ncm').innerText = item.ncm ? formatNcm(item.ncm) : 'N/A';
    document.getElementById('details-item-qty-unit').innerText = item.qty_unit ? item.qty_unit.toFixed(2) : 'N/A';
    document.getElementById('details-item-boxes').innerText = totalBoxes;
    document.getElementById('details-package-type-label').innerText = `Total de ${item.package_type}s`;
    const movementsContainer = document.getElementById('details-item-history');
    movementsContainer.innerHTML = '';
    const itemMovements = movements.filter(m => m.item_id === id).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
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
                    ${mov.operation_id ? `<span class="movement-op">(${mov.operation_id})</span>` : ''}
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
    if (id) {
        const item = items.find(i => i.id === id);
        if (item) {
            document.getElementById('item-modal-title').innerText = 'Editar Item';
            document.getElementById('itemId').value = item.id;
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemNameEn').value = item.name_en;
            document.getElementById('itemCode').value = item.code;
            document.getElementById('itemNcm').value = formatNcm(item.ncm);
            document.getElementById('itemDescription').value = item.description;
            const boxes = (item.units_per_package > 0) ? (item.quantity / item.units_per_package) : 0;
            document.getElementById('quantityInBoxes').value = boxes;
            document.getElementById('itemMinQuantity').value = item.min_quantity;
            document.getElementById('itemCostPrice').value = item.cost_price;
            document.getElementById('itemSalePrice').value = item.sale_price;
            document.getElementById('itemSupplier').value = item.supplier_id;
            document.getElementById('packageType').value = item.package_type || 'caixa';
            document.getElementById('unitsPerPackage').value = item.units_per_package;
            document.getElementById('unitMeasureValue').value = item.unit_measure_value;
            document.getElementById('unitMeasureType').value = item.unit_measure_type || 'g';
            if (item.image_url) {
                const preview = document.getElementById('imagePreview');
                preview.src = item.image_url;
                preview.classList.remove('hidden');
                document.getElementById('imagePlaceholder').classList.add('hidden');
            }
        }
    } else {
        document.getElementById('item-modal-title').innerText = 'Adicionar Novo Item';
    }

    itemForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('itemName').value;
        if (!name) {
            showNotification('O nome do item é obrigatório.', 'warning');
            return;
        }

        const itemId = document.getElementById('itemId').value;

        try {
            if (itemId) { // Editando
                const updateData = {
                    name,
                    name_en: document.getElementById('itemNameEn').value,
                    code: document.getElementById('itemCode').value,
                    ncm: document.getElementById('itemNcm').value.replace(/\D/g, ''),
                    description: document.getElementById('itemDescription').value,
                    supplier_id: document.getElementById('itemSupplier').value || null,
                    package_type: document.getElementById('packageType').value,
                    units_per_package: parseInt(document.getElementById('unitsPerPackage').value, 10),
                    min_quantity: parseInt(document.getElementById('itemMinQuantity').value, 10),
                    cost_price: parseFloat(document.getElementById('itemCostPrice').value),
                    sale_price: parseFloat(document.getElementById('itemSalePrice').value),
                    unit_measure_value: parseFloat(document.getElementById('unitMeasureValue').value),
                    unit_measure_type: document.getElementById('unitMeasureType').value,
                };
                const updatedItem = await updateItem(itemId, updateData);
                updateLocalItem(updatedItem);
                showNotification('Item atualizado com sucesso!', 'success');
            } else { // Criando
                const currentUser = getCurrentUserProfile();
                if (!currentUser) {
                    showNotification('Erro: Utilizador não autenticado. Por favor, faça login novamente.', 'danger');
                    return;
                }
                const unitsPerPackage = parseInt(document.getElementById('unitsPerPackage').value, 10);
                const quantityInBoxes = parseInt(document.getElementById('quantityInBoxes').value, 10);

                const itemData = {
                    user_id: currentUser.id,
                    name,
                    code: document.getElementById('itemCode').value,
                    ncm: document.getElementById('itemNcm').value.replace(/\D/g, ''),
                    description: document.getElementById('itemDescription').value,
                    supplier_id: document.getElementById('itemSupplier').value || null,
                    package_type: document.getElementById('packageType').value,
                    units_per_package: unitsPerPackage,
                    quantity: quantityInBoxes * unitsPerPackage,
                    min_quantity: parseInt(document.getElementById('itemMinQuantity').value, 10),
                    cost_price: parseFloat(document.getElementById('itemCostPrice').value),
                    sale_price: parseFloat(document.getElementById('itemSalePrice').value),
                    unit_measure_value: parseFloat(document.getElementById('unitMeasureValue').value),
                    unit_measure_type: document.getElementById('unitMeasureType').value,
                };
                const newItem = await addItem(itemData);
                addLocalItem(newItem);
                showNotification('Item adicionado com sucesso!', 'success');
            }
            fullUpdate();
            closeModal('item-modal');
        } catch (error) {
            showNotification(`Erro ao salvar item: ${error.message}`, 'danger');
        }
    };

    openModal('item-modal');
}

async function deleteItem(id) {
    if (!checkPermission('delete')) {
        showNotification('Não tem permissão para excluir itens.', 'danger');
        return;
    }
    const itemToDelete = items.find(i => i.id === id);
    if (!itemToDelete) return;

    showConfirmModal(
        'Excluir Item?',
        `Tem a certeza de que deseja excluir o item "${itemToDelete.name}"?`,
        async () => {
            try {
                await deleteItemDB(id);
                removeLocalItem(id);
                showNotification('Item excluído com sucesso!', 'danger');
                fullUpdate();
            } catch (error) {
                showNotification(`Erro ao excluir o item: ${error.message}`, 'danger');
            }
        }
    );
}

export function refreshSupplierDropdowns(selectedSupplierId = null) {
    const dropdowns = ['itemSupplier', 'simItemSupplier'];
    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = `<option value="">Sem fornecedor</option>`;
            suppliers.forEach(s => {
                select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
            });
            // Select the new supplier if provided, otherwise keep previous selection
            if (selectedSupplierId) {
                select.value = selectedSupplierId;
            } else {
                select.value = currentValue;
            }
        }
    });
}

window.refreshSupplierDropdowns = refreshSupplierDropdowns;

async function openSuppliersModal(onSuccessCallback = null) {
    renderSuppliersList();
    resetSupplierForm();

    const supplierForm = document.getElementById('supplier-form');
    const cnpjInput = document.getElementById('supplierCnpj');
    const phoneInput = document.getElementById('supplierPhone');

    cnpjInput.addEventListener('input', (e) => { e.target.value = formatCnpj(e.target.value); });
    phoneInput.addEventListener('input', (e) => { e.target.value = formatPhone(e.target.value); });

    supplierForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('supplierId').value;
        const name = document.getElementById('supplierName').value;

        if (!name) {
            showNotification('O nome do fornecedor é obrigatório.', 'warning');
            return;
        }

        const currentUser = getCurrentUserProfile();
        if (!currentUser) {
            showNotification('Erro: Sessão inválida. Por favor, faça login novamente.', 'danger');
            return;
        }

        const supplierData = {
            name,
            cnpj: document.getElementById('supplierCnpj').value.replace(/\D/g, ''),
            address: document.getElementById('supplierAddress').value,
            fda: document.getElementById('supplierFda').value,
            email: document.getElementById('supplierEmail').value,
            salesperson: document.getElementById('supplierSalesperson').value,
            phone: document.getElementById('supplierPhone').value.replace(/\D/g, ''),
            user_id: currentUser.id
        };

        try {
            let resultSupplier;
            if (id) { // Editando
                resultSupplier = await updateSupplier(id, supplierData);
                updateLocalSupplier(resultSupplier);
                showNotification('Fornecedor atualizado com sucesso!', 'success');
            } else { // Criando
                resultSupplier = await addSupplier(supplierData);
                addLocalSupplier(resultSupplier);
                showNotification('Fornecedor adicionado com sucesso!', 'success');
            }
            renderSuppliersList();
            resetSupplierForm();

            if (onSuccessCallback && typeof onSuccessCallback === 'function' && resultSupplier) {
                onSuccessCallback(resultSupplier.id);
                closeModal('suppliers-modal');
            }
        } catch (error) {
            showNotification(`Erro ao salvar fornecedor: ${error.message}`, 'danger');
        }
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

async function deleteSupplier(id, event) {
    event.stopPropagation();
    const supplierToDelete = suppliers.find(s => s.id === id);
    if (!supplierToDelete) return;

    showConfirmModal(
        'Excluir Fornecedor?',
        `Tem a certeza de que deseja excluir o fornecedor "${supplierToDelete.name}"?`,
        async () => {
            try {
                await deleteSupplierDB(id);
                removeLocalSupplier(id);
                renderSuppliersList();
                resetSupplierForm();
                showNotification('Fornecedor excluído!', 'danger');
            } catch (error) {
                showNotification(`Erro ao excluir fornecedor: ${error.message}`, 'danger');
            }
        }
    );
}
window.deleteSupplier = deleteSupplier;

async function openStockModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const form = document.getElementById('stock-form');
    form.reset();
    document.getElementById('stockItemId').value = id;
    document.getElementById('stock-modal-title').innerText = `Entrada Manual: ${item.name}`;

    const packageLabel = item.package_type === 'fardo' ? 'Fardos' : 'Caixas';
    document.getElementById('movement-quantity-label').innerText = `Qtd. de ${packageLabel} a Adicionar`;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const itemId = document.getElementById('stockItemId').value;
        const itemIndex = items.findIndex(i => i.id === itemId);
        if (itemIndex === -1) {
            showNotification('Erro: Item não encontrado.', 'danger');
            return;
        }
        const itemToUpdate = items[itemIndex];

        const quantityInBoxes = parseInt(document.getElementById('movementQuantity').value, 10);
        if (isNaN(quantityInBoxes) || quantityInBoxes <= 0) {
            showNotification('Por favor, insira uma quantidade numérica válida e positiva.', 'warning');
            return;
        }

        const quantityInUnits = quantityInBoxes * (itemToUpdate.units_per_package || 1);
        const newTotalQuantity = itemToUpdate.quantity + quantityInUnits;
        const reason = document.getElementById('movementReason').value || 'Entrada manual';

        try {
            // 1. Atualizar a quantidade do item no DB
            const updatedItem = await updateItem(itemId, { quantity: newTotalQuantity });

            // 2. Se a atualização do item for bem-sucedida, criar o registo de movimento
            const movementData = {
                item_id: itemId,
                type: 'in',
                quantity: quantityInUnits,
                price: itemToUpdate.cost_price,
                reason: reason,
                date: new Date().toISOString()
            };
            const newMovement = await addMovement(movementData);
            addLocalMovement(newMovement);

            // 3. Atualizar a UI com os dados mais recentes
            updateLocalItem(updatedItem);
            fullUpdate();
            closeModal('stock-modal');
            showNotification(`Stock do item "${itemToUpdate.name}" atualizado com sucesso!`, 'success');

        } catch (error) {
            showNotification(`Erro ao atualizar stock: ${error.message}`, 'danger');
        }
    };

    openModal('stock-modal');
}

function showNotification(message, type = 'info', duration = 3000) {
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
    }, duration);
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
    const userProfile = getCurrentUserProfile();
    if (!userProfile || userProfile.role !== 'admin') {
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
        const role = 'user'; // Default role is user, logic can be enhanced if role selector is added

        // Coletar permissões
        const permissions = {};
        document.querySelectorAll('#permissions-container input[type="checkbox"]').forEach(checkbox => {
            const permKey = checkbox.id.replace('perm-', '');
            permissions[permKey] = checkbox.checked;
        });

        // Validação básica
        if (!userId && (!username || !password)) {
            showNotification('Email e Senha são obrigatórios para novos usuários.', 'warning');
            return;
        }

        try {
            const { createUser, updateUser, supabaseClient } = await import('./auth.js');

            let result;

            if (userId) {
                // EDITAR USUÁRIO
                showNotification('Atualizando usuário...', 'info');
                const updates = { role, permissions };
                if (password) {
                    // Se tiver senha, infelizmente a Edge Function update-user teria que suportar update de senha ou chamamos auth api.
                    // Por segurança e simplicidade, a update-user atual não muda senha.
                    // Vamos focar em permissões primeiro. Se precisar mudar senha, usamos supabaseClient.auth.admin.updateUserById (se tiver service role na edge function)
                    // A função update-user atualiza metadados. Vamos adicionar password ao payload da edge function se ela suportar, ou avisar que password não muda aqui.
                    // VERIFIQUEI: A função update-user NÃO tem lógica para mudar password via auth.admin.updateUserById(..., {password}).
                    // AVISO AO USER: Edição de senha via Admin ainda não implementada na Edge Function, apenas permissões.
                    // TODO: Implementar update de password na Edge Function update-user.
                    console.warn("Edição de senha via Admin requer atualização na Edge Function.");
                }

                result = await updateUser(userId, updates);

            } else {
                // CRIAR USUÁRIO
                showNotification('Criando usuário...', 'info');
                result = await createUser(username, password, role, permissions);
            }

            if (result.error) {
                throw new Error(result.error.message || 'Erro desconhecido ao salvar usuário.');
            }

            showNotification(userId ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!', 'success');
            resetUserForm();

            // Re-fetch profiles to update UI list
            const { data: profiles } = await supabaseClient.from('profiles').select('*');
            if (profiles) {
                users.length = 0;
                users.push(...profiles);
                renderUsersList();
            }

            closeModal('users-modal');

        } catch (err) {
            showNotification(err.message, 'danger');
        }
    };
}

function renderUsersList() {
    const usersListContainer = document.getElementById('users-list');
    const currentUser = getCurrentUserProfile();
    usersListContainer.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-list-item';
        div.innerHTML = `
            <div onclick="editUser('${user.id}')" class="user-info">
                <span class="user-name">${escapeHTML(user.username) || 'Administrador'}</span>
                <p class="user-meta">${escapeHTML(user.role)} ${user.is_active ? '<span class="text-green-500">(Ativo)</span>' : '<span class="text-red-500">(Pendente)</span>'}</p>
            </div>
            <div class="user-actions" style="display:flex; align-items:center; gap:10px;">
                ${!user.is_active
                ? `<button onclick="toggleUserStatus('${user.id}', true, event)" class="btn-icon" style="color: #10B981; border: 1px solid #10B981; padding: 4px; border-radius: 4px;" title="Ativar Acesso"><i data-feather="check-circle"></i></button>`
                : `<button onclick="toggleUserStatus('${user.id}', false, event)" class="btn-icon" style="color: #F59E0B; border: 1px solid #F59E0B; padding: 4px; border-radius: 4px;" title="Bloquear Acesso"><i data-feather="slash"></i></button>`
            }
                ${currentUser && currentUser.email !== user.username
                ? `<button onclick="deleteUser('${user.id}', event)" class="btn-icon" style="color: #EF4444; border: 1px solid #EF4444; padding: 4px; border-radius: 4px;" title="Excluir Usuário"><i data-feather="trash-2"></i></button>`
                : ''
            }
            </div>
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
        el.checked = user.permissions && user.permissions[permKey] ? true : false;
    });
}

function toggleUserStatus(userId, isActive, event) {
    if (event) event.stopPropagation();

    updateUserStatus(userId, isActive).then(() => {
        const user = users.find(u => u.id === userId);
        if (user) user.is_active = isActive;
        renderUsersList();
        showNotification(`Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso!`, 'success');
    }).catch(err => {
        showNotification(`Erro ao atualizar status: ${err.message}`, 'danger');
    });
}
window.toggleUserStatus = toggleUserStatus;
window.editUser = editUser;


function applyPermissionsToUI(userProfile) {
    if (!userProfile) return;

    // Helper para mostrar/esconder ou desabilitar elementos
    const setElementState = (id, hasPermission) => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
                el.disabled = !hasPermission;
                el.title = hasPermission ? '' : 'Sem permissão';
                // Opcional: Adicionar estilo visual para desabilitado se não for nativo
                if (!hasPermission) el.classList.add('opacity-50', 'cursor-not-allowed');
                else el.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                el.style.display = hasPermission ? '' : 'none';
            }
        }
    };

    // 1. Permissões de Usuário (Admin)
    const isAdmin = checkPermission('admin') || userProfile.role === 'admin';
    setElementState('menu-users', isAdmin);
    setElementState('desktop-nav-users', isAdmin); // Se existir link no desktop
    setElementState('nav-menu-users', isAdmin); // Link específico se houver

    // Atualiza nome do usuário
    const userNameEl = document.getElementById('menu-username');
    if (userNameEl) userNameEl.textContent = userProfile.email;

    // 2. Adicionar Itens
    const canAdd = checkPermission('add');
    setElementState('add-item-btn-header', canAdd);
    setElementState('desktop-add-item-btn', canAdd);
    setElementState('empty-add-btn', canAdd); // Botão "Adicionar Item" quando lista vazia

    // 3. Importar NF-e
    const canImport = checkPermission('import');
    setElementState('hub-import-op-btn', canImport);
    setElementState('dropdown-import-op-btn', canImport);
    setElementState('menu-purchase-orders', canImport); // Ordens de Compra geralmente requerem import/add
    setElementState('desktop-nav-purchase-orders', canImport);

    // 4. Criar Operações (Simular)
    const canOperate = checkPermission('operation');
    setElementState('hub-simulate-op-btn', canOperate);
    setElementState('dropdown-simulate-op-btn', canOperate);

    // 5. Relatórios
    const canViewReports = checkPermission('reports');
    setElementState('nav-reports', canViewReports);
    setElementState('desktop-reports-btn', canViewReports);
    setElementState('view-reports', canViewReports);

    // 6. Editar/Excluir (Estas verificações ocorrem ao renderizar a lista, mas podemos forçar re-render)
    // renderItems() deve chamar checkPermission('edit') e checkPermission('delete') para cada item.
    // Vamos garantir que a renderização inicial considere isso.
    if (typeof renderItems === 'function') renderItems();
    if (typeof renderSuppliersList === 'function') renderSuppliersList();
}
window.applyPermissionsToUI = applyPermissionsToUI;

function resetUserForm() {
    document.getElementById('user-form').reset();
    document.getElementById('userId').value = '';
    document.getElementById('formUsername').disabled = false;
    document.getElementById('user-form-title').innerText = "Adicionar Novo Usuário";
    document.getElementById('formPassword').placeholder = "Palavra-passe";
    // Limpar checkboxes
    document.querySelectorAll('#permissions-container input[type="checkbox"]').forEach(el => el.checked = false);
}

function deleteUser(userId, event) {
    event.stopPropagation();
    const userProfile = getCurrentUserProfile();
    if (!userProfile || userProfile.role !== 'admin') return;

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
        const formattedDisplayId = displayId.startsWith('OP-') ? displayId : `OP: ${displayId}`;
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center';

        card.innerHTML = `
            <div class="flex-grow mb-4 sm:mb-0">
                <p class="font-bold text-primary-DEFAULT">${formattedDisplayId}</p>
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
                renderOperationsHistory();
                showNotification('Operação excluída com sucesso!', 'danger');
            });
        });
    });
}



function showView(viewName) {
    document.querySelectorAll('.main-view').forEach(view => {
        view.classList.add('hidden');
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    history.pushState("", document.title, window.location.pathname + window.location.search);

    const headerTitle = document.getElementById('header-title');
    const viewTitles = {
        dashboard: 'Dashboard',
        operations: 'Central de Operações',
        reports: 'Relatórios',
        menu: 'Menu'
    };
    headerTitle.textContent = viewTitles[viewName] || 'StockControl Pro';

    document.querySelectorAll('.nav-item').forEach(link => link.classList.remove('active'));
    const activeMobileLink = document.getElementById(`nav-${viewName}`);
    if (activeMobileLink) {
        activeMobileLink.classList.add('active');
    }

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

            const displayId = op.invoiceNumber || op.id;
            const formattedDisplayId = displayId.startsWith('OP-') ? displayId : `OP: ${displayId}`;

            const card = document.createElement('div');
            card.className = 'history-card';

            card.innerHTML = `
                <div class="history-card-details">
                    <div class="history-card-header">
                        <p class="history-id">${formattedDisplayId}</p>
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

        container.querySelectorAll('.view-invoice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const opId = e.currentTarget.dataset.opId;
                const operation = operationsHistory.find(op => op.id === opId);
                if (operation) {
                    localStorage.setItem('currentDocument', JSON.stringify({ operation, allSuppliers: suppliers, allItems: items }));
                    window.open('gerenciador_invoice.html', '_self');
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

            operationToDelete.items.forEach(opItem => {
                const itemIndex = items.findIndex(i => i.id === opItem.id);
                if (itemIndex > -1) {
                    items[itemIndex].quantity += Number(opItem.operationQuantity || 0);
                }
            });

            const movementsToRemove = movements
                .map((mov, index) => (mov.operationId === operationId ? index : -1))
                .filter(index => index !== -1);

            for (let i = movementsToRemove.length - 1; i >= 0; i--) {
                movements.splice(movementsToRemove[i], 1);
            }

            operationsHistory.splice(opIndex, 1);

            fullUpdate();
            showNotification(`Operação ${operationId} excluída com sucesso!`, 'danger');

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