import { checkPermission, currentUser, hashPassword, generateSalt } from './auth.js';
import { items, suppliers, movements, saveData, users, saveUsers } from './database.js';

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const overlay = document.getElementById('sidebar-overlay');

    sidebar.classList.toggle('-translate-x-full');
    
    if (window.innerWidth < 768) {
        overlay.classList.toggle('hidden');
    } else {
        mainContent.classList.toggle('md:ml-64');
    }
}

function applyPermissionsToUI() {
    if (!currentUser) return;

    document.getElementById('current-username-desktop').textContent = currentUser.username;

    const isAdmin = currentUser.role === 'admin';
    
    document.getElementById('manage-users-btn-sidebar').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('manage-users-btn-mobile').style.display = isAdmin ? 'flex' : 'none';
    
    const mobileNavButtons = document.getElementById('mobile-nav-bar').querySelectorAll('button');
    if (!isAdmin) {
        let visibleButtons = 0;
        mobileNavButtons.forEach(btn => {
            if (btn.style.display !== 'none') visibleButtons++;
        });
        mobileNavButtons.forEach(btn => {
            if(btn.id !== 'manage-users-btn-mobile') btn.className = btn.className.replace(/w-\d\/\d/, `w-1/${visibleButtons}`);
        });
    }

    document.getElementById('add-item-btn-sidebar').disabled = !checkPermission('add');
    document.getElementById('import-btn').disabled = !checkPermission('import');
    document.getElementById('operation-btn-sidebar').disabled = !checkPermission('operation');
    document.getElementById('reports-btn-sidebar').disabled = !checkPermission('reports');
    
    renderItems();
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
    const cardsContainer = document.getElementById('items-cards-container');
    const tableBody = document.getElementById('items-table-body');
    const emptyState = document.getElementById('empty-state');
    cardsContainer.innerHTML = '';
    tableBody.innerHTML = '';

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
        cardsContainer.classList.add('hidden');
        document.getElementById('items-table-container').classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        cardsContainer.classList.remove('hidden');
        document.getElementById('items-table-container').classList.remove('hidden');
    }
    
    const canEdit = checkPermission('edit');
    const canDelete = checkPermission('delete');

    filteredItems.forEach(item => {
        const status = getStatus(item);
        const boxes = (item.unitsPerPackage > 0) ? Math.floor(item.quantity / item.unitsPerPackage) : 0;
        const packageLabel = item.packageType === 'fardo' ? 'fd' : 'cx';
        const stockDisplay = `${boxes} ${packageLabel}`;

        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md p-4 flex flex-col justify-between';
        card.innerHTML = `
            <div class="flex-grow cursor-pointer">
                <div class="flex items-start space-x-4">
                    <img src="${item.image || 'https://placehold.co/80x80/e0e7ff/4f46e5?text=' + item.name.charAt(0)}" alt="${item.name}" class="w-16 h-16 object-cover rounded-md flex-shrink-0">
                    <div class="flex-grow">
                        <h3 class="font-bold text-lg text-gray-800">${item.name}</h3>
                        <p class="text-sm text-secondary">${item.code || 'N/A'}</p>
                        <span class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${status.class}">${status.text}</span>
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-200">
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-secondary">Stock: <strong class="text-gray-900">${stockDisplay}</strong></span>
                        <span class="text-secondary">Venda: <strong class="text-gray-900">${formatCurrency(item.salePrice, 'BRL')}</strong></span>
                    </div>
                </div>
            </div>
            <div class="flex justify-end space-x-2 mt-4">
                <button data-action="open-stock" data-id="${item.id}" class="btn-icon-secondary"><i class="fas fa-plus"></i></button>
                <button data-action="open-item" data-id="${item.id}" class="btn-icon-secondary" ${canEdit ? '' : 'disabled'}><i class="fas fa-edit"></i></button>
                <button data-action="delete-item" data-id="${item.id}" class="btn-icon-danger" ${canDelete ? '' : 'disabled'}><i class="fas fa-trash"></i></button>
            </div>
        `;
        card.querySelector('.flex-grow.cursor-pointer').addEventListener('click', () => openItemDetailsModal(item.id));
        card.querySelector('[data-action="open-stock"]').addEventListener('click', () => openStockModal(item.id));
        card.querySelector('[data-action="open-item"]').addEventListener('click', () => openItemModal(item.id));
        card.querySelector('[data-action="delete-item"]').addEventListener('click', () => deleteItem(item.id));
        cardsContainer.appendChild(card);

        const row = document.createElement('tr');
        row.className = 'table-row';
        row.innerHTML = `
            <td class="table-body-cell clickable-cell">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <img class="h-10 w-10 rounded-full object-cover" src="${item.image || 'https://placehold.co/40x40/e0e7ff/4f46e5?text=' + item.name.charAt(0)}" alt="${item.name}">
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${item.name}</div>
                        <div class="text-sm text-secondary">${item.nameEn || ''}</div>
                    </div>
                </div>
            </td>
            <td class="table-body-cell text-sm text-secondary">${item.code || 'N/A'}</td>
            <td class="table-body-cell text-sm text-gray-900">${stockDisplay}</td>
            <td class="table-body-cell">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}">${status.text}</span>
            </td>
            <td class="table-body-cell text-sm text-gray-900 font-medium">${formatCurrency(item.salePrice, 'BRL')}</td>
            <td class="table-body-cell text-right text-sm font-medium space-x-2">
                <button data-action="open-stock" data-id="${item.id}" class="text-primary-DEFAULT hover:text-primary-hover" title="Entrada Manual"><i class="fas fa-plus"></i></button>
                <button data-action="open-item" data-id="${item.id}" class="text-indigo-600 hover:text-indigo-900" title="Editar" ${canEdit ? '' : 'disabled'}><i class="fas fa-edit"></i></button>
                <button data-action="delete-item" data-id="${item.id}" class="text-red-600 hover:text-red-900" title="Excluir" ${canDelete ? '' : 'disabled'}><i class="fas fa-trash"></i></button>
            </td>
        `;
        row.querySelector('.clickable-cell').addEventListener('click', () => openItemDetailsModal(item.id));
        row.querySelector('[data-action="open-stock"]').addEventListener('click', () => openStockModal(item.id));
        row.querySelector('[data-action="open-item"]').addEventListener('click', () => openItemModal(item.id));
        row.querySelector('[data-action="delete-item"]').addEventListener('click', () => deleteItem(item.id));
        tableBody.appendChild(row);
    });
}

function updateDashboard() {
    const statsContainer = document.getElementById('dashboard-stats');
    const totalItems = items.length;
    const lowStockItems = items.filter(item => getStatus(item).level > 0 && getStatus(item).level < 3).length;
    const totalValue = items.reduce((acc, item) => acc + (item.quantity * item.costPrice), 0);
    const avgValue = totalItems > 0 ? totalValue / totalItems : 0;

    statsContainer.innerHTML = `
        <div class="card p-4 flex items-center cursor-pointer col-span-2 sm:col-span-1">
            <div class="bg-primary-light p-3 rounded-full mr-4"><i class="fas fa-boxes-stacked text-primary-DEFAULT text-lg"></i></div>
            <div><h4 class="text-sm font-medium text-secondary">Total de Itens</h4><p class="text-xl font-bold text-gray-800">${totalItems}</p></div>
        </div>
        <div class="card p-4 flex items-center cursor-pointer col-span-2 sm:col-span-1">
            <div class="bg-yellow-100 p-3 rounded-full mr-4"><i class="fas fa-exclamation-triangle text-yellow-500 text-lg"></i></div>
            <div><h4 class="text-sm font-medium text-secondary">Itens em Alerta</h4><p class="text-xl font-bold ${lowStockItems > 0 ? 'text-warning-DEFAULT' : 'text-gray-800'}">${lowStockItems}</p></div>
        </div>
        <div class="card p-4 flex items-center col-span-2 sm:col-span-1">
            <div class="bg-green-100 p-3 rounded-full mr-4"><i class="fas fa-dollar-sign text-green-500 text-lg"></i></div>
            <div><h4 class="text-sm font-medium text-secondary">Valor do Stock</h4><p class="text-xl font-bold text-gray-800">${formatCurrency(totalValue, 'BRL')}</p></div>
        </div>
        <div class="card p-4 flex items-center col-span-2 sm:col-span-1">
            <div class="bg-indigo-100 p-3 rounded-full mr-4"><i class="fas fa-balance-scale text-indigo-500 text-lg"></i></div>
            <div><h4 class="text-sm font-medium text-secondary">Média por Item</h4><p class="text-xl font-bold text-gray-800">${formatCurrency(avgValue, 'BRL')}</p></div>
        </div>
    `;
}

function fullUpdate() {
    renderItems();
    updateDashboard();
    saveData();
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('flex');
    }, 10);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('flex');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function showConfirmModal(title, text, onConfirm) {
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-text').innerText = text;
    confirmAction = onConfirm;
    openModal('confirm-modal');
}

function openItemDetailsModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const supplier = suppliers.find(s => s.id === item.supplierId);
    const margin = item.costPrice > 0 ? ((item.salePrice - item.costPrice) / item.costPrice) * 100 : 0;
    
    let totalWeight = (item.quantity || 0) * (item.unitMeasureValue || 0);
    let weightUnit = item.unitMeasureType;
    if (weightUnit === 'g') {
        totalWeight /= 1000;
        weightUnit = 'kg';
    } else if (weightUnit === 'ml') {
        totalWeight /= 1000;
        weightUnit = 'L';
    }

    const totalBoxes = (item.unitsPerPackage > 0) ? Math.floor(item.quantity / item.unitsPerPackage) : 0;

    document.getElementById('details-item-name').innerText = item.name;
    document.getElementById('details-item-name-en').innerText = item.nameEn || 'No English name';
    document.getElementById('details-item-image').src = item.image || `https://placehold.co/300x300/e0e7ff/4f46e5?text=${item.name.charAt(0)}`;
    document.getElementById('details-item-cost').innerText = formatCurrency(item.costPrice, 'BRL');
    document.getElementById('details-item-sale').innerText = formatCurrency(item.salePrice, 'BRL');
    document.getElementById('details-item-margin').innerText = `${margin.toFixed(1)}%`;
    document.getElementById('details-item-description').innerText = item.description || 'Nenhuma descrição fornecida.';
    document.getElementById('details-item-quantity').innerText = item.quantity;
    document.getElementById('details-item-min-quantity').innerText = item.minQuantity;
    document.getElementById('details-item-supplier').innerText = supplier ? supplier.name : 'Não especificado';
    document.getElementById('details-item-code').innerText = item.code || 'N/A';
    document.getElementById('details-item-ncm').innerText = item.ncm ? formatNcm(item.ncm) : 'N/A';
    document.getElementById('details-item-units-box').innerText = item.unitsPerPackage || '0';
    document.getElementById('details-item-weight-unit').innerText = `${item.unitMeasureValue || 0} ${item.unitMeasureType}`;
    document.getElementById('details-item-updated').innerText = new Date(item.updatedAt).toLocaleString('pt-BR');
    document.getElementById('details-item-total-weight').innerText = `${totalWeight.toFixed(2)} ${weightUnit}`;
    document.getElementById('details-item-boxes').innerText = totalBoxes;
    document.getElementById('details-package-type-label').innerText = `Total de ${item.packageType}s`;
    document.getElementById('details-units-per-package-label').innerText = `Unid./${item.packageType}`;
    document.getElementById('details-total-weight-label').innerText = (item.unitMeasureType === 'g' || item.unitMeasureType === 'kg') ? 'Peso Total em Stock' : 'Volume Total em Stock';
    document.getElementById('details-item-total-weight-calc').innerText = `(${(item.quantity || 0)} un. x ${item.unitMeasureValue || 0} ${item.unitMeasureType}/un.)`;


    const movementsContainer = document.getElementById('details-item-movements');
    movementsContainer.innerHTML = '';
    const itemMovements = movements.filter(m => m.itemId === id).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

    if (itemMovements.length === 0) {
        movementsContainer.innerHTML = `<p class="text-secondary text-center py-4">Nenhuma movimentação para este item.</p>`;
    } else {
        itemMovements.forEach(mov => {
            const div = document.createElement('div');
            div.className = `p-3 rounded-md border-l-4 ${mov.type === 'in' ? 'bg-blue-50 border-blue-500' : 'bg-red-50 border-red-500'}`;
            div.innerHTML = `
                <div class="flex justify-between items-center text-sm">
                    <div>
                        <span class="font-bold uppercase">${mov.type === 'in' ? 'Entrada' : 'Saída'}</span>
                        <span class="text-secondary">(${mov.quantity} un.)</span>
                        ${mov.operationId ? `<span class="text-xs text-blue-600 ml-2">(${mov.operationId})</span>` : ''}
                    </div>
                    <span class="text-xs text-secondary">${new Date(mov.date).toLocaleString('pt-BR')}</span>
                </div>
            `;
            movementsContainer.appendChild(div);
        });
    }

    openModal('item-details-modal');
}

function openItemModal(id = null) {
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
    ncmInput.addEventListener('input', (e) => {
        e.target.value = formatNcm(e.target.value);
    });

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
            if(item.image) {
                const preview = document.getElementById('imagePreview');
                preview.src = item.image;
                preview.classList.remove('hidden');
                document.getElementById('imagePlaceholder').classList.add('hidden');
            }
        }
    } else {
        document.getElementById('item-modal-title').innerText = 'Adicionar Novo Item';
    }
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
            items = items.filter(i => i.id !== id);
            showNotification('Item excluído com sucesso!', 'danger');
            fullUpdate();
        }
    );
}

function openSuppliersModal() {
    renderSuppliersList();
    resetSupplierForm();
    
    const cnpjInput = document.getElementById('supplierCnpj');
    const phoneInput = document.getElementById('supplierPhone');
    
    cnpjInput.addEventListener('input', (e) => {
        e.target.value = formatCnpj(e.target.value);
    });
    phoneInput.addEventListener('input', (e) => {
        e.target.value = formatPhone(e.target.value);
    });

    openModal('suppliers-modal');
}

function renderSuppliersList() {
    const suppliersListContainer = document.getElementById('suppliers-list');
    suppliersListContainer.innerHTML = '';
    if (suppliers.length === 0) {
        suppliersListContainer.innerHTML = `<p class="text-secondary text-center">Nenhum fornecedor registado.</p>`;
        return;
    }
    suppliers.forEach(s => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center p-3 rounded-md hover:bg-gray-100 cursor-pointer';
        div.innerHTML = `
            <div onclick="editSupplier('${s.id}')" class="flex-grow">
                <span class="font-medium text-gray-800">${s.name}</span>
                <p class="text-xs text-gray-500">${s.email || ''}</p>
            </div>
            <button onclick="deleteSupplier('${s.id}', event)" class="text-red-500 hover:text-red-700 ml-4"><i class="fas fa-trash"></i></button>
        `;
        suppliersListContainer.appendChild(div);
    });
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
            suppliers = suppliers.filter(s => s.id !== id);
            renderSuppliersList();
            resetSupplierForm();
            saveData();
            showNotification('Fornecedor excluído!', 'danger');
        }
    );
}

function openStockModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const form = document.getElementById('stock-form');
    form.reset();
    document.getElementById('stockItemId').value = id;
    document.getElementById('stock-modal-title').innerText = `Entrada Manual: ${item.name}`;
    
    const packageLabel = item.packageType === 'fardo' ? 'Fardos' : 'Caixas';
    document.getElementById('movement-quantity-label').innerText = `Qtd. de ${packageLabel} a Adicionar`;

    openModal('stock-modal');
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notif = document.createElement('div');
    const colors = {
        info: 'bg-blue-500',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        danger: 'bg-red-500'
    };
    notif.className = `px-4 py-3 rounded-md text-white shadow-lg transform transition-all duration-300 translate-y-4 opacity-0 ${colors[type]}`;
    notif.innerText = message;
    container.appendChild(notif);
    
    setTimeout(() => {
        notif.classList.remove('translate-y-4', 'opacity-0');
    }, 10);
    
    setTimeout(() => {
        notif.classList.add('translate-y-4', 'opacity-0');
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
        div.className = 'flex justify-between items-center p-3 rounded-md hover:bg-gray-100 cursor-pointer';
        div.innerHTML = `
            <div onclick="editUser('${user.id}')" class="flex-grow">
                <span class="font-medium text-gray-800">${user.username}</span>
                <p class="text-xs text-gray-500">${user.role}</p>
            </div>
            ${currentUser.username !== user.username ? `<button onclick="deleteUser('${user.id}', event)" class="text-red-500 hover:text-red-700 ml-4"><i class="fas fa-trash"></i></button>` : ''}
        `;
        usersListContainer.appendChild(div);
    });
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
            users = users.filter(u => u.id !== userId);
            saveUsers();
            renderUsersList();
            resetUserForm();
            showNotification('Usuário excluído!', 'danger');
        }
    );
}

export { 
    toggleSidebar, applyPermissionsToUI, formatCnpj, formatPhone, formatNcm, getStatus, formatCurrency, 
    renderItems, updateDashboard, fullUpdate, openModal, closeModal, showConfirmModal, openItemDetailsModal, 
    openItemModal, deleteItem, openSuppliersModal, renderSuppliersList, editSupplier, resetSupplierForm, 
    deleteSupplier, openStockModal, showNotification, previewImage, readFileAsBase64,
    openUsersModal, renderUsersList, editUser, resetUserForm, deleteUser
};