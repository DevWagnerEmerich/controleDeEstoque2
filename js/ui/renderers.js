
// js/ui/renderers.js
import { items, suppliers, movements, users, operationsHistory } from '../database.js';
import { escapeHTML } from '../utils/helpers.js';
import { formatCurrency, getStatus, formatCnpj, formatPhone, PLACEHOLDER_IMAGE } from './utils.js';
import { checkPermission } from '../auth.js'; // RBAC

// Core Render Functions

export function fullUpdate() {
    renderItems();
    renderSuppliersList();
    renderDashboardStats();
    renderOperationsHistory(); // mini list
}

export function renderItems() {
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

        filteredItems.forEach(item => {
            const status = getStatus(item);
            const imageSrc = item.image ? item.image : PLACEHOLDER_IMAGE; // Fallback

            const card = document.createElement('div');
            card.className = 'product-card';
            card.setAttribute('role', 'article'); // A11y

            // RBAC Checks for Buttons
            const canEdit = checkPermission('edit');
            const canDelete = checkPermission('delete');
            const editBtn = canEdit ? `<button onclick="openItemModal('${item.id}')" class="card-action-button" title="Editar" aria-label="Editar ${escapeHTML(item.name)}"><i data-feather="edit-2"></i></button>` : '';
            const deleteBtn = canDelete ? `<button onclick="deleteItem('${item.id}')" class="card-action-button danger" title="Excluir" aria-label="Excluir ${escapeHTML(item.name)}"><i data-feather="trash-2"></i></button>` : '';


            card.innerHTML = `
                <div class="card-header">
                    <img src="${imageSrc}" alt="${escapeHTML(item.name)}" class="card-image">
                    <div class="card-actions">
                         ${editBtn}
                         ${deleteBtn}
                    </div>
                </div>
                <div class="card-body" onclick="openItemDetailsModal('${item.id}')" role="button" tabindex="0" aria-label="Ver detalhes de ${escapeHTML(item.name)}">
                    <h3 class="card-title">${escapeHTML(item.name)}</h3>
                    <p class="card-code">${escapeHTML(item.code || 'S/N')}</p>
                    
                    <div class="card-info-row">
                        <span class="card-info-label">Stock:</span>
                        <span class="card-info-value">${item.quantity} ${item.unit_measure_type || 'un'}</span>
                    </div>
                    <div class="card-info-row">
                        <span class="card-info-label">Embalagem:</span>
                        <span class="card-info-value">${item.quantity_in_boxes || 0} ${item.package_type || 'cx'}</span>
                    </div>
                    <div class="card-info-row">
                        <span class="card-info-label">Preço:</span>
                        <span class="card-info-value">${formatCurrency(item.sale_price, 'USD')}</span>
                    </div>
                </div>
                <div class="card-footer">
                    <span class="status-badge status-${status.text.toLowerCase()}">${status.text}</span>
                    <button onclick="openStockModal('${item.id}')" class="add-stock-button" aria-label="Movimentar Stock">
                        <i data-feather="package" style="width:16px; height:16px; margin-right:4px; vertical-align:text-bottom;"></i> Stock
                    </button>
                </div>
            `;
            gridContainer.appendChild(card);
        });
    }
    if (window.feather) window.feather.replace();
}

export function renderDashboardStats() {
    const totalItems = items.length;
    const totalStock = items.reduce((acc, item) => acc + item.quantity, 0);
    const totalValue = items.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0);
    const criticalItems = items.filter(item => getStatus(item).level >= 2).length;

    const statsContainer = document.getElementById('dashboard-stats');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon-wrapper"><i data-feather="package"></i></div>
            <div class="stat-info">
                <span class="stat-value">${totalItems}</span>
                <span class="stat-label">Itens Cadastrados</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon-wrapper"><i data-feather="layers"></i></div>
            <div class="stat-info">
                <span class="stat-value">${totalStock}</span>
                <span class="stat-label">Total em Stock</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon-wrapper"><i data-feather="dollar-sign"></i></div>
            <div class="stat-info">
                <span class="stat-value">${formatCurrency(totalValue, 'USD')}</span>
                <span class="stat-label">Valor do Stock (Custo)</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon-wrapper" style="background-color: #FEE2E2; color: #991B1B;"><i data-feather="alert-triangle"></i></div>
            <div class="stat-info">
                <span class="stat-value" style="color: #991B1B;">${criticalItems}</span>
                <span class="stat-label">Itens Críticos</span>
            </div>
        </div>
    `;
    if (window.feather) window.feather.replace();
}

export function renderSuppliersList() {
    const list = document.getElementById('suppliers-list');
    list.innerHTML = '';
    suppliers.forEach(supplier => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `
            <div style="flex-grow: 1;">
                <p style="font-weight: 600;">${escapeHTML(supplier.name)}</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">
                    ${escapeHTML(supplier.contact) || 'Sem contato'} • 
                    ${formatPhone(supplier.phone)} • 
                    ${escapeHTML(supplier.email)}
                </p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="window.editSupplier('${supplier.id}')" class="btn-icon" title="Editar"><i data-feather="edit-2"></i></button>
                <button onclick="window.deleteSupplier('${supplier.id}', event)" class="btn-icon" style="color: #EF4444;" title="Excluir"><i data-feather="trash-2"></i></button>
            </div>
        `;
        list.appendChild(div);
    });
    if (window.feather) window.feather.replace();
}

export function renderUsersList() {
    const usersListContainer = document.getElementById('users-list');
    if (!usersListContainer) return;

    usersListContainer.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-list-item';
        div.innerHTML = `
            <div onclick="window.editUser('${user.id}')" class="user-info">
                <span class="user-name">${escapeHTML(user.username) || 'Administrador'}</span>
                <p class="user-meta">${escapeHTML(user.role)} ${user.is_active ? '<span class="text-green-500">(Ativo)</span>' : '<span class="text-red-500">(Pendente)</span>'}</p>
            </div>
            <div class="user-actions" style="display:flex; align-items:center; gap:10px;">
                ${!user.is_active
                ? `<button onclick="window.toggleUserStatus('${user.id}', true, event)" class="btn-icon" style="color: #10B981; border: 1px solid #10B981; padding: 4px; border-radius: 4px;" title="Ativar Acesso"><i data-feather="check-circle"></i></button>`
                : `<button onclick="window.toggleUserStatus('${user.id}', false, event)" class="btn-icon" style="color: #F59E0B; border: 1px solid #F59E0B; padding: 4px; border-radius: 4px;" title="Bloquear Acesso"><i data-feather="slash"></i></button>`
            }
                <button onclick="window.deleteUser('${user.id}', event)" class="btn-icon" style="color: #EF4444; border: 1px solid #EF4444; padding: 4px; border-radius: 4px;" title="Excluir Usuário"><i data-feather="trash-2"></i></button>
            </div>
        `;
        usersListContainer.appendChild(div);
    });
    if (window.feather) window.feather.replace();
}

export function renderOperationsHistory() {
    const container = document.getElementById('reports-movements-history');
    if (!container) return;
    container.innerHTML = '';

    const recentOps = operationsHistory.slice(-5).reverse();

    if (recentOps.length === 0) {
        container.innerHTML = '<p class="text-secondary text-sm">Nenhuma operação recente.</p>';
        return;
    }

    recentOps.forEach(op => {
        const div = document.createElement('div');
        div.className = 'movement-item';
        const date = new Date(op.date);
        const typeLabel = op.type === 'import' ? 'Importação' : 'Manual';
        const itemCount = op.nfeData ? op.nfeData.reduce((acc, n) => acc + n.produtos.length, 0) : op.items.length;

        div.innerHTML = `
            <div class="movement-icon incoming">
                <i data-feather="arrow-down"></i>
            </div>
            <div class="movement-info">
                <h4>${op.invoiceNumber ? `NF ${op.invoiceNumber}` : `OP #${op.id.substring(0, 8)}`}</h4>
                <p>${typeLabel} • ${itemCount} itens</p>
            </div>
            <div class="movement-time">
                ${date.toLocaleDateString('pt-BR')}
            </div>
        `;
        container.appendChild(div);
    });
    if (window.feather) window.feather.replace();
}

export function renderOperationsHistoryModal() {
    const container = document.getElementById('operations-history-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (operationsHistory.length === 0) {
        container.innerHTML = '<p class="text-center text-secondary py-8">Nenhuma operação registrada.</p>';
        return;
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
                    <button class="btn btn-secondary view-invoice-btn" data-op-id="${op.id}" title="Ver Invoice"><i data-feather="file-text"></i></button>
                    <button class="btn btn-secondary view-packlist-btn" data-op-id="${op.id}" title="Ver Packing List"><i data-feather="package"></i></button>
                    <button onclick="window.deleteOperation('${op.id}')" class="btn btn-danger delete-op-btn" title="Excluir Operação"><i data-feather="trash-2"></i></button>
                </div>
            `;
            list.appendChild(card);
        });
        container.appendChild(list);

        // Add listeners for invoice/packing list buttons which are not global functions usually
        // They open windows.
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

        if (window.feather) window.feather.replace();
    }
}
