import { checkPermission, currentUserProfile } from './auth.js';
import { 
    getAllItems, getAllSuppliers, getAllMovements, getAllOperationsHistory, getAllPendingPurchaseOrders, getUserProfiles,
    addItem, updateItem, deleteItem, addSupplier, updateSupplier, deleteSupplier, addMovement, addOperationToHistory,
    addPendingPurchaseOrder, updatePendingPurchaseOrder, deletePendingPurchaseOrder,
    clearAllData
} from './database.js';
import { appData } from './main.js'; // Importa a variável global de dados

document.addEventListener('operation-saved', () => {
    openOperationsHistoryModal();
});

export async function applyPermissionsToUI() {
    if (!currentUserProfile) return;

    // Mobile menu username
    document.getElementById('menu-username').textContent = currentUserProfile.username;
    // Desktop nav username
    document.getElementById('desktop-username').textContent = currentUserProfile.username;

    const isAdmin = currentUserProfile.role === 'admin';
    
    // Toggle admin-only buttons
    document.getElementById('menu-users').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('desktop-users-btn').style.display = isAdmin ? 'flex' : 'none';

    // Disable/Enable buttons based on permissions
    document.getElementById('add-item-btn-header').disabled = !checkPermission('add');
    document.getElementById('desktop-add-item-btn').disabled = !checkPermission('add');
    
    await renderItems(); // Renderiza itens após aplicar permissões
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
    if (item.quantity <= item.min_quantity) return { text: 'Crítico', class: 'bg-red-100 text-red-800', level: 2 };
    if (item.quantity <= item.min_quantity * 1.2) return { text: 'Baixo', class: 'bg-yellow-100 text-yellow-800', level: 1 };
    return { text: 'OK', class: 'bg-green-100 text-green-800', level: 0 };
};

const formatCurrency = (value, currency = 'USD') => {
    const options = { style: 'currency', currency: currency, minimumFractionDigits: 2 };
    const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
    return new Intl.NumberFormat(locale, options).format(value || 0);
}

export async function renderItems() {
    const gridContainer = document.getElementById('items-grid-container');
    const emptyState = document.getElementById('empty-state');
    gridContainer.innerHTML = '';

    let filteredItems = [...appData.items]; // Usa appData.items
    
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

        // Adicionar event listeners
        card.querySelector('.card-body').addEventListener('click', () => openItemDetailsModal(item.id));
        card.querySelector('[data-action="open-stock"]').addEventListener('click', () => openStockModal(item.id));
        card.querySelector('[data-action="open-item"]').addEventListener('click', (e) => { e.stopPropagation(); openItemModal(item.id); });
        card.querySelector('[data-action="delete-item"]').addEventListener('click', (e) => { 
            e.stopPropagation(); 
            const itemToDelete = appData.items.find(i => i.id === item.id);
            if (!itemToDelete) return;
            showConfirmModal(
                'Excluir Item?',
                `Tem a certeza de que deseja excluir o item "${itemToDelete.name}"?`,
                async () => {
                    const success = await deleteItem(item.id); // Chama a função importada de database.js
                    if (success) {
                        showNotification('Item excluído com sucesso!', 'danger');
                        await fullUpdate();
                    } else {
                        showNotification('Erro ao excluir item!', 'danger');
                    }
                }
            );
        });

        gridContainer.appendChild(card);
    });

    // Ativar os ícones da Feather
    feather.replace();
}



export async function renderDashboardStats() {
    const statsContainer = document.getElementById('dashboard-stats');
    if (!statsContainer) return;

    const totalItems = appData.items.length; // Usa appData.items
    const totalValue = appData.items.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0); // Usa appData.items
    const lowStockItems = appData.items.filter(item => item.quantity > 0 && item.quantity <= item.min_quantity).length; // Usa appData.items
    const outOfStockItems = appData.items.filter(item => item.quantity <= 0).length; // Usa appData.items

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

export async function fullUpdate() {
    // Recarrega todos os dados da base de dados
    const loadedData = await loadAllData();
    Object.assign(appData, loadedData);

    await renderDashboardStats();
    await renderItems();
    await renderOperationsHistory(); // Atualiza o histórico na aba de relatórios
    await renderOperationsHistoryModal(); // Atualiza o conteúdo do modal de histórico
    // saveData() não é mais necessário aqui, pois as funções de manipulação já salvam no BD
}

export function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        document.body.classList.add('modal-is-open');
        modal.classList.add('is-open');
        feather.replace();
    }
}

export function closeModal(id) {
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

export function showConfirmModal(title, text, onConfirm) {
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

export async function openItemDetailsModal(id) {
    const item = appData.items.find(i => i.id === id); // Usa appData.items
    if (!item) return;

    const supplier = appData.suppliers.find(s => s.id === item.supplier_id); // Usa appData.suppliers
    const margin = item.cost_price > 0 ? ((item.sale_price - item.cost_price) / item.cost_price) * 100 : 0;
    const totalBoxes = (item.units_per_package > 0) ? Math.floor(item.quantity / item.units_per_package) : 0;

    document.getElementById('details-item-name').innerText = item.name;
    document.getElementById('details-item-name-en').innerText = item.name_en || '';
    document.getElementById('details-item-image').src = item.image || `https://placehold.co/300x300/e0e7ff/4f46e5?text=${item.name.charAt(0)}`;
    document.getElementById('details-item-cost').innerText = formatCurrency(item.cost_price, 'BRL');
    document.getElementById('details-item-sale').innerText = formatCurrency(item.sale_price, 'BRL');
    document.getElementById('details-item-margin').innerText = `${margin.toFixed(1)}%`;
    document.getElementById('details-item-description').innerText = item.description || 'Nenhuma descrição fornecida.';
    document.getElementById('details-item-quantity').innerText = item.quantity;
    document.getElementById('details-item-supplier').innerText = supplier ? supplier.name : 'Não especificado';
    document.getElementById('details-item-code').innerText = item.code || 'N/A';
    document.getElementById('details-item-ncm').innerText = item.ncm ? formatNcm(item.ncm) : 'N/A';
    document.getElementById('details-item-qty-unit').innerText = item.unit_measure_value ? item.unit_measure_value.toFixed(2) : 'N/A'; // Ajustado para unit_measure_value
    document.getElementById('details-item-boxes').innerText = totalBoxes;
    document.getElementById('details-package-type-label').innerText = `Total de ${item.package_type}s`;

    const movementsContainer = document.getElementById('details-item-history');
    movementsContainer.innerHTML = '';
    const itemMovements = appData.movements.filter(m => m.item_id === id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5); // Usa appData.movements e created_at

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
                <span class="movement-date">${new Date(mov.created_at).toLocaleString('pt-BR')}</span>
            `;
            movementsContainer.appendChild(div);
        });
    }

    openModal('item-details-modal');
}

export async function openItemModal(id = null) {
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
    // Popula o select de fornecedores com dados do Supabase
    appData.suppliers.forEach(s => { // Usa appData.suppliers
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
        const item = appData.items.find(i => i.id === id); // Usa appData.items
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
            name_en: document.getElementById('itemNameEn').value, // Ajustado para name_en
            code: document.getElementById('itemCode').value,
            ncm: document.getElementById('itemNcm').value.replace(/\D/g, ''),
            description: document.getElementById('itemDescription').value,
            supplier_id: document.getElementById('itemSupplier').value, // Ajustado para supplier_id
            package_type: document.getElementById('packageType').value, // Ajustado para package_type
            units_per_package: unitsPerPackage, // Ajustado para units_per_package
            quantity: quantityInBoxes * unitsPerPackage,
            min_quantity: minQuantity, // Ajustado para min_quantity
            cost_price: parsedCostPrice, // Ajustado para cost_price
            sale_price: parsedSalePrice, // Ajustado para sale_price
            unit_measure_value: isNaN(unitMeasureValue) ? 0 : unitMeasureValue, // Ajustado para unit_measure_value
            unit_measure_type: document.getElementById('unitMeasureType').value, // Ajustado para unit_measure_type
            updated_at: new Date().toISOString(),
            image: imageBase64 // Nova imagem ou null
        };

        // --- 4. Salvamento ---
        if (itemId) { // Editando
            const updatedItem = await updateItem(itemId, itemData); // Chama a função do Supabase
            if (updatedItem) {
                showNotification('Item atualizado com sucesso!', 'success');
            } else {
                showNotification('Erro ao atualizar item!', 'danger');
            }
        } else { // Criando
            const newItem = await addItem(itemData); // Chama a função do Supabase
            if (newItem) {
                showNotification('Item adicionado com sucesso!', 'success');
            } else {
                showNotification('Erro ao adicionar item!', 'danger');
            }
        }

        await fullUpdate(); // Espera a atualização completa
        closeModal('item-modal');
    };

    openModal('item-modal');
}

// A função deleteItem agora é importada de database.js e usada diretamente.
// A lógica de confirmação foi movida para o event listener em renderItems.

export async function openSuppliersModal() {
    await renderSuppliersList(); // Espera a renderização
    resetSupplierForm();

    const supplierForm = document.getElementById('supplier-form');
    const cnpjInput = document.getElementById('supplierCnpj');
    const phoneInput = document.getElementById('supplierPhone');
    
    cnpjInput.addEventListener('input', (e) => { e.target.value = formatCnpj(e.target.value); });
    phoneInput.addEventListener('input', (e) => { e.target.value = formatPhone(e.target.value); });

    supplierForm.onsubmit = async (e) => { // Adicionado async aqui
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
            const updatedSupplier = await updateSupplier(id, supplierData); // Chama a função do Supabase
            if (updatedSupplier) {
                showNotification('Fornecedor atualizado com sucesso!', 'success');
            } else {
                showNotification('Erro ao atualizar fornecedor!', 'danger');
            }
        } else { // Criando
            const newSupplier = await addSupplier(supplierData); // Chama a função do Supabase
            if (newSupplier) {
                showNotification('Fornecedor adicionado com sucesso!', 'success');
            } else {
                showNotification('Erro ao adicionar fornecedor!', 'danger');
            }
        }

        await fullUpdate(); // Espera a atualização completa
        await renderSuppliersList(); // Espera a renderização
        resetSupplierForm();
    };

    openModal('suppliers-modal');
}

export async function renderSuppliersList() {
    const suppliersListContainer = document.getElementById('suppliers-list');
    suppliersListContainer.innerHTML = '';
    if (appData.suppliers.length === 0) { // Usa appData.suppliers
        suppliersListContainer.innerHTML = `<p class="text-secondary" style="text-align: center;">Nenhum fornecedor registado.</p>`;
        return;
    }
    appData.suppliers.forEach(s => { // Usa appData.suppliers
        const div = document.createElement('div');
        div.className = 'supplier-list-item';
        div.innerHTML = `
            <div onclick="editSupplier('${s.id}')" class="supplier-info">
                <span class="supplier-name">${s.name}</span>
                <p class="supplier-meta">${s.email || ''}</p>
            </div>
        const deleteBtn = div.querySelector('.btn-delete-supplier');
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const supplierToDelete = appData.suppliers.find(sup => sup.id === s.id);
            if (!supplierToDelete) return;

            showConfirmModal(
                'Excluir Fornecedor?',
                `Tem a certeza de que deseja excluir o fornecedor "${supplierToDelete.name}"?`,
                async () => {
                    const success = await deleteSupplier(s.id); // Chama a função importada de database.js
                    if (success) {
                        showNotification('Fornecedor excluído!', 'danger');
                        await fullUpdate();
                        await renderSuppliersList();
                        resetSupplierForm();
                    } else {
                        showNotification('Erro ao excluir fornecedor!', 'danger');
                    }
                }
            );
        });
        suppliersListContainer.appendChild(div);
    });
    feather.replace();
}

export function editSupplier(id) {
    const supplier = appData.suppliers.find(s => s.id === id); // Usa appData.suppliers
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

export function resetSupplierForm() {
    document.getElementById('supplier-form').reset();
    document.getElementById('supplierId').value = '';
    document.getElementById('supplier-form-title').innerText = "Adicionar Novo Fornecedor";
}

// A função deleteSupplier agora é importada de database.js e usada diretamente.
// A lógica de confirmação foi movida para o event listener em renderSuppliersList.


export async function openStockModal(id) {
    const item = appData.items.find(i => i.id === id); // Usa appData.items
    if (!item) return;
    const form = document.getElementById('stock-form');
    form.reset();
    document.getElementById('stockItemId').value = id;
    document.getElementById('stock-modal-title').innerText = `Entrada Manual: ${item.name}`;
    
    const packageLabel = item.package_type === 'fardo' ? 'Fardos' : 'Caixas'; // Ajustado para package_type
    document.getElementById('movement-quantity-label').innerText = `Qtd. de ${packageLabel} a Adicionar`;

    form.onsubmit = async (e) => { // Adicionado async aqui
        e.preventDefault();
        const itemId = document.getElementById('stockItemId').value;
        const itemToUpdate = appData.items.find(i => i.id === itemId); // Usa appData.items
        if (!itemToUpdate) {
            showNotification('Erro: Item não encontrado.', 'danger');
            return;
        }

        const quantityInBoxes = parseInt(document.getElementById('movementQuantity').value, 10);
        if (isNaN(quantityInBoxes) || quantityInBoxes <= 0) {
            showNotification('Por favor, insira uma quantidade numérica válida e positiva.', 'warning');
            return;
        }

        const quantityInUnits = quantityInBoxes * (itemToUpdate.units_per_package || 1); // Ajustado para units_per_package
        const reason = document.getElementById('movementReason').value || 'Entrada manual';

        // Atualizar a quantidade do item
        const updatedItem = await updateItem(itemId, { quantity: itemToUpdate.quantity + quantityInUnits, updated_at: new Date().toISOString() }); // Chama a função do Supabase
        if (!updatedItem) {
            showNotification('Erro ao atualizar quantidade do item!', 'danger');
            return;
        }

        // Criar registo de movimento
        const movement = {
            item_id: itemId, // Ajustado para item_id
            type: 'in',
            quantity: quantityInUnits,
            price: itemToUpdate.cost_price, // Usa o preço de custo do item para a entrada, ajustado para cost_price
            reason: reason,
            created_at: new Date().toISOString()
        };
        const newMovement = await addMovement(movement); // Chama a função do Supabase
        if (!newMovement) {
            showNotification('Erro ao registar movimento!', 'danger');
            return;
        }

        showNotification(`Stock do item "${itemToUpdate.name}" atualizado com sucesso!`, 'success');
        await fullUpdate(); // Espera a atualização completa
        closeModal('stock-modal');
    };

    openModal('stock-modal');
}

export function showNotification(message, type = 'info') {
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

export function previewImage(event, previewId, placeholderId) {
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

export function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

export async function openUsersModal() {
    if (currentUserProfile.role !== 'admin') { // Usa currentUserProfile
        showNotification('Acesso negado.', 'danger');
        return;
    }
    await renderUsersList(); // Espera a renderização
    resetUserForm();
    openModal('users-modal');

    const userForm = document.getElementById('user-form');
    userForm.onsubmit = async (e) => { // Adicionado async aqui
        e.preventDefault();
        const userId = document.getElementById('userId').value;
        const username = document.getElementById('formUsername').value;
        // A senha não é mais gerenciada diretamente aqui para utilizadores existentes
        // Novos utilizadores são criados via Supabase Auth e depois o perfil é criado aqui.

        const permissions = {};
        document.querySelectorAll('#permissions-container input[type="checkbox"').forEach(el => {
            permissions[el.id.replace('perm-', '')] = el.checked;
        });

        if (userId) { // Editando perfil de utilizador existente
            const updatedProfile = await updateUserProfile(userId, { username, permissions, updated_at: new Date().toISOString() }); // Chama a função do Supabase
            if (updatedProfile) {
                showNotification('Perfil de utilizador atualizado com sucesso!', 'success');
            } else {
                showNotification('Erro ao atualizar perfil de utilizador!', 'danger');
            }
        } else { // Criando novo perfil de utilizador (assumindo que o utilizador já foi criado via Supabase Auth)
            // Esta lógica precisará ser revista. Idealmente, a criação de utilizador e perfil
            // seria feita num único fluxo, talvez com uma função de "signup" no auth.js
            // Por enquanto, vamos apenas notificar que o perfil precisa de um utilizador Supabase Auth existente.
            showNotification('Para criar um novo utilizador, primeiro crie-o no Supabase Auth e depois edite o perfil aqui.', 'info');
        }
        await fullUpdate(); // Espera a atualização completa
        await renderUsersList(); // Espera a renderização
        resetUserForm();
    };
}

export async function renderUsersList() {
    const usersListContainer = document.getElementById('users-list');
    usersListContainer.innerHTML = '';
    const userProfiles = await getUserProfiles(); // Busca perfis do Supabase
    if (userProfiles.length === 0) {
        usersListContainer.innerHTML = `<p class="text-secondary" style="text-align: center;">Nenhum utilizador registado.</p>`;
        return;
    }
    userProfiles.forEach(profile => {
        const div = document.createElement('div');
        div.className = 'user-list-item';
        div.innerHTML = `
            <div onclick="editUser('${profile.id}')" class="user-info">
                <span class="user-name">${profile.username}</span>
                <p class="user-meta">${profile.role}</p>
            </div>
            ${currentUserProfile.id !== profile.id ? `<button onclick="deleteUser('${profile.id}', event)" class="btn-delete-user"><i data-feather="trash-2"></i></button>` : ''}
        `;
        usersListContainer.appendChild(div);
    });
    feather.replace();
}

export function editUser(userId) {
    const user = appData.userProfiles.find(u => u.id === userId); // Usa appData.userProfiles
    if (!user) return;

    document.getElementById('user-form-title').innerText = "Editar Utilizador";
    document.getElementById('userId').value = user.id;
    document.getElementById('formUsername').value = user.username;
    document.getElementById('formUsername').disabled = true; // Username não pode ser alterado aqui
    document.getElementById('formPassword').value = '';
    document.getElementById('formPassword').placeholder = "Não é possível alterar a senha aqui.";
    document.getElementById('formPassword').disabled = true; // Senha não pode ser alterada aqui

    document.querySelectorAll('#permissions-container input[type="checkbox"').forEach(el => {
        const permKey = el.id.replace('perm-', '');
        el.checked = user.permissions && user.permissions[permKey] || false;
    });
}
window.editUser = editUser;

export function resetUserForm() {
    document.getElementById('user-form').reset();
    document.getElementById('userId').value = '';
    document.getElementById('formUsername').disabled = false;
    document.getElementById('user-form-title').innerText = "Adicionar Novo Utilizador";
    document.getElementById('formPassword').placeholder = "Não é possível adicionar utilizadores aqui.";
    document.getElementById('formPassword').disabled = true; // Não adicionamos utilizadores por aqui
}

export async function deleteUser(userId, event) { // Adicionado async aqui
    event.stopPropagation();
    if (currentUserProfile.role !== 'admin') return; // Usa currentUserProfile

    const userToDelete = appData.userProfiles.find(u => u.id === userId); // Usa appData.userProfiles
    if (!userToDelete) return;

    showConfirmModal(
        'Excluir Utilizador?',
        `Tem a certeza de que deseja excluir o utilizador "${userToDelete.username}"?`,
        async () => { // Adicionado async aqui
            // Para excluir um utilizador, precisamos excluir o perfil e depois o utilizador do Supabase Auth
            const { error: profileError } = await supabase.from('user_profiles').delete().eq('id', userId);
            if (profileError) {
                console.error('Erro ao excluir perfil:', profileError.message);
                showNotification('Erro ao excluir perfil do utilizador!', 'danger');
                return;
            }

            // ATENÇÃO: Excluir utilizadores diretamente via cliente Supabase JS não é recomendado por segurança.
            // Isso deve ser feito via um backend seguro (Serverless Function) ou manualmente no painel do Supabase.
            // Por enquanto, vamos apenas excluir o perfil.
            showNotification('Perfil de utilizador excluído com sucesso! (Exclua o utilizador do Supabase Auth manualmente)', 'success');
            
            await fullUpdate(); // Espera a atualização completa
            await renderUsersList(); // Espera a renderização
            resetUserForm();
        }
    );
}
window.deleteUser = deleteUser;

export async function renderOperationsHistory() {
    const container = document.getElementById('operations-history-list');
    if (!container) return;

    container.innerHTML = '';
    if (appData.operationsHistory.length === 0) { // Usa appData.operationsHistory
        container.innerHTML = `<div class="text-center py-8 bg-white rounded-lg border border-gray-200">
            <i class="fas fa-history text-4xl text-gray-300 mb-3"></i>
            <p class="text-secondary">Nenhuma operação realizada ainda.</p>
        </div>`;
        return;
    }

    appData.operationsHistory.slice().reverse().forEach(op => { // Usa appData.operationsHistory
        const opDate = new Date(op.date);
        const displayId = op.operation_id || op.id; // Ajustado para operation_id
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center';
        
        card.innerHTML = `
            <div class="flex-grow mb-4 sm:mb-0">
                <p class="font-bold text-primary-DEFAULT">OP: ${displayId}</p>
                <p class="text-sm text-secondary">Data: ${opDate.toLocaleDateString('pt-BR')} às ${opDate.toLocaleTimeString('pt-BR')}</p>
                <p class="text-sm text-secondary">Total de Itens: ${op.items ? op.items.length : 0}</p>
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
            const operation = appData.operationsHistory.find(op => op.id === opId); // Usa appData.operationsHistory
            if (operation) {
                // localStorage.setItem('currentDocument', JSON.stringify({ operation, allSuppliers: appData.suppliers, allItems: appData.items })); // Adaptação para appData
                // window.open('gerenciador_invoice.html?origin=history', '_self');
                showNotification('Funcionalidade de Invoice/Packing List precisa ser adaptada para Supabase.', 'info');
            }
        });
    });

    document.querySelectorAll('#operations-history-list .view-packlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const opId = e.currentTarget.dataset.opId;
            const operation = appData.operationsHistory.find(op => op.id === opId); // Usa appData.operationsHistory
            if (operation) {
                // localStorage.setItem('currentDocument', JSON.stringify({ operation, allSuppliers: appData.suppliers, allItems: appData.items })); // Adaptação para appData
                // window.open('gerador_packing_list.html', '_self');
                showNotification('Funcionalidade de Invoice/Packing List precisa ser adaptada para Supabase.', 'info');
            }
        });
    });

    document.querySelectorAll('#operations-history-list .delete-op-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const opId = e.currentTarget.dataset.opId;
            deleteOperation(opId);
        });
    });

    feather.replace();
}



export function showView(viewName) {
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

export async function renderOperationsHistoryModal() {
    const container = document.getElementById('operations-history-list-container');
    if (!container) return;

    container.innerHTML = '';
    if (appData.operationsHistory.length === 0) { // Usa appData.operationsHistory
        container.innerHTML = `<div style="text-align: center; padding: 2rem;">
            <i data-feather="clock" style="width: 48px; height: 48px; margin: 0 auto 1rem; color: var(--text-secondary);"></i>
            <p class="text-secondary">Nenhuma operação realizada ainda.</p>
        </div>`;
        feather.replace();
    } else {
        const list = document.createElement('div');
        list.className = 'history-list';
        appData.operationsHistory.slice().reverse().forEach(op => { // Usa appData.operationsHistory
            const opDate = new Date(op.date);
            const typeBadge = op.type === 'import' 
                ? '<span class="badge import">Importada</span>' 
                : '<span class="badge manual">Manual</span>';

            // Use operation_id as the primary display, with id as a safeguard.
            const displayId = op.operation_id || op.id;

            const card = document.createElement('div');
            card.className = 'history-card';
            
            card.innerHTML = `
                <div class="history-card-details">
                    <div class="history-card-header">
                        <p class="history-id">OP: ${displayId}</p>
                        ${typeBadge}
                    </div>
                    <p class="history-meta">Data: ${opDate.toLocaleDateString('pt-BR')} às ${opDate.toLocaleTimeString('pt-BR')}</p>
                    <p class="history-meta">Total de Itens: ${op.items ? op.items.length : 0}</p>
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
                const operation = appData.operationsHistory.find(op => op.id === opId); // Usa appData.operationsHistory
                if (operation) {
                    // localStorage.setItem('currentDocument', JSON.stringify({ operation, allSuppliers: appData.suppliers, allItems: appData.items })); // Adaptação para appData
                    // window.open('gerenciador_invoice.html?origin=history', '_self');
                    showNotification('Funcionalidade de Invoice/Packing List precisa ser adaptada para Supabase.', 'info');
                }
            });
        });

        container.querySelectorAll('.view-packlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const opId = e.currentTarget.dataset.opId;
                const operation = appData.operationsHistory.find(op => op.id === opId); // Usa appData.operationsHistory
                if (operation) {
                    // localStorage.setItem('currentDocument', JSON.stringify({ operation, allSuppliers: appData.suppliers, allItems: appData.items })); // Adaptação para appData
                    // window.open('gerador_packing_list.html', '_self');
                    showNotification('Funcionalidade de Invoice/Packing List precisa ser adaptada para Supabase.', 'info');
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

export function openOperationsHistoryModal() {
    renderOperationsHistoryModal();
    openModal('operations-history-modal');
}

export async function deleteOperation(operationId) { // Adicionado async aqui
    showConfirmModal(
        'Excluir Operação?',
        `Tem a certeza que deseja excluir a operação ${operationId}? Esta ação não pode ser desfeita.`,
        async () => { // Adicionado async aqui
            const operationToDelete = appData.operationsHistory.find(op => op.id === operationId); // Usa appData.operationsHistory
            if (!operationToDelete) {
                showNotification("Erro: Operação não encontrada para excluir.", "danger");
                return;
            }

            // 1. Reverter o stock dos itens (precisa ser adaptado para Supabase)
            // Isso é complexo e envolve buscar e atualizar itens no BD.
            // Por enquanto, vamos apenas excluir a operação.
            showNotification('Reversão de stock não implementada para Supabase ainda.', 'warning');

            // 2. Remover os movimentos associados (precisa ser adaptado para Supabase)
            // await supabase.from('movements').delete().eq('operation_id', operationId);

            // 3. Remover a operação do histórico
            const { error } = await supabase.from('operations_history').delete().eq('id', operationId); // Chama a função do Supabase
            if (error) {
                console.error('Erro ao excluir operação:', error.message);
                showNotification('Erro ao excluir operação!', 'danger');
                return;
            }

            showNotification(`Operação ${operationId} excluída com sucesso!`, 'danger');
            await fullUpdate(); // Espera a atualização completa
            await renderOperationsHistoryModal(); // Re-renderiza o modal de histórico
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