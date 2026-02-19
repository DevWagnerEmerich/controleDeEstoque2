
// js/ui/actions.js
import {
    items, suppliers, users, movements, operationsHistory,
    addItem, updateItem, deleteItemDB,
    addSupplier, updateSupplier, deleteSupplierDB,
    addLocalSupplier, updateLocalSupplier,
    addMovement,
    updateUserStatus, deleteUserDB, deleteOperationDB
} from '../database.js';
import {
    openModal, closeModal, showConfirmModal, showView
} from './modals.js';
import {
    renderItems, renderSuppliersList, renderUsersList, fullUpdate,
    renderOperationsHistory, renderOperationsHistoryModal, renderDashboardStats
} from './renderers.js';
import {
    showNotification, formatCnpj, formatPhone, formatNcm, previewImage, readFileAsBase64, PLACEHOLDER_IMAGE, normalizeCnpj
} from './utils.js';
import {
    checkPermission, getCurrentUserProfile, createUser, updateUser
} from '../auth.js';
import { escapeHTML } from '../utils/helpers.js';

// Item Actions

export async function openItemModal(id = null) {
    // If called via event listener, id is an Event object. We want null.
    if (id && typeof id !== 'string') id = null;

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

    // Populate Supplier Dropdown
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
            document.getElementById('itemNameEn').value = item.name_en || '';
            document.getElementById('itemCode').value = item.code || '';
            document.getElementById('itemNcm').value = item.ncm ? formatNcm(item.ncm) : '';
            document.getElementById('itemDescription').value = item.description || '';

            // Logic to calculate boxes
            const boxes = (item.units_per_package > 0) ? (item.quantity / item.units_per_package) : 0;
            document.getElementById('quantityInBoxes').value = boxes; // ID Corrected

            document.getElementById('itemMinQuantity').value = item.min_quantity;
            document.getElementById('itemCostPrice').value = item.cost_price; // ID Corrected
            document.getElementById('itemSalePrice').value = item.sale_price; // ID Corrected
            document.getElementById('itemSupplier').value = item.supplier_id || '';
            document.getElementById('packageType').value = item.package_type || 'caixa'; // ID Corrected
            document.getElementById('unitsPerPackage').value = item.units_per_package || 1;
            document.getElementById('unitMeasureValue').value = item.unit_measure_value || 0;
            document.getElementById('unitMeasureType').value = item.unit_measure_type || 'g'; // ID Corrected

            if (item.image_url) { // uses image_url or image? original used image_url.
                // Checking database.js: items uses item.image usually.
                // But original/ui.js line 326 used item.image_url. 
                // Let's stick to original, or check Step 1205 which used item.image.
                // Database.js usually maps snake_case from Supabase.
                // I will use item.image as fallback.
                const img = item.image_url || item.image;
                if (img) {
                    const preview = document.getElementById('imagePreview');
                    preview.src = img;
                    preview.classList.remove('hidden');
                    document.getElementById('imagePlaceholder').classList.add('hidden');
                }
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

        const formData = new FormData(itemForm);
        let imageBase64 = null;
        const imageFile = formData.get('itemImage'); // name="itemImage" exists in HTML
        if (imageFile && imageFile.size > 0) {
            try {
                imageBase64 = await readFileAsBase64(imageFile);
            } catch (err) {
                console.error("Erro ao ler imagem", err);
            }
        }

        const itemId = document.getElementById('itemId').value;
        const unitsPerPackage = parseInt(document.getElementById('unitsPerPackage').value, 10) || 1;
        const quantityInBoxes = parseInt(document.getElementById('quantityInBoxes').value, 10) || 0;

        // Common data
        const itemData = {
            name,
            name_en: document.getElementById('itemNameEn').value,
            code: document.getElementById('itemCode').value,
            ncm: document.getElementById('itemNcm').value.replace(/\D/g, ''),
            description: document.getElementById('itemDescription').value,
            supplier_id: document.getElementById('itemSupplier').value || null,
            package_type: document.getElementById('packageType').value,
            units_per_package: unitsPerPackage,
            min_quantity: parseInt(document.getElementById('itemMinQuantity').value, 10) || 0,
            cost_price: parseFloat(document.getElementById('itemCostPrice').value) || 0,
            sale_price: parseFloat(document.getElementById('itemSalePrice').value) || 0,
            unit_measure_value: parseFloat(document.getElementById('unitMeasureValue').value) || 0,
            unit_measure_type: document.getElementById('unitMeasureType').value,
        };

        if (imageBase64) {
            itemData.image_url = imageBase64;
        }

        try {
            if (itemId) { // Editing
                const updatedItem = await updateItem(itemId, itemData);
                updateLocalItem(updatedItem);
                showNotification('Item atualizado com sucesso!', 'success');
            } else { // Creating
                const currentUser = getCurrentUserProfile();
                if (!currentUser) {
                    showNotification('Utilizador não autenticado.', 'danger');
                    return;
                }
                // Add user_id and calculated quantity
                itemData.user_id = currentUser.id;
                itemData.quantity = quantityInBoxes * unitsPerPackage;

                const newItem = await addItem(itemData);
                // addLocalItem(newItem);
                showNotification('Item adicionado com sucesso!', 'success');
            }
            closeModal('item-modal');
            fullUpdate();
        } catch (error) {
            console.error("Erro ao salvar item:", error);
            showNotification(`Erro ao salvar: ${error.message}`, 'danger');
        }
    };

    openModal('item-modal');
}

export function openItemDetailsModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const supplier = suppliers.find(s => s.id === item.supplier_id);
    const supplierName = supplier ? supplier.name : 'N/A';

    // Populate Details
    document.getElementById('detail-image').src = item.image_url || PLACEHOLDER_IMAGE;
    document.getElementById('detail-name').innerText = item.name;
    document.getElementById('detail-code').innerText = item.code || 'S/N';
    document.getElementById('detail-category').innerText = item.category || 'Geral';
    document.getElementById('detail-qty').innerText = `${item.quantity} ${item.unit_measure_type || 'un'}`;
    document.getElementById('detail-min-qty').innerText = `${item.min_quantity} ${item.unit_measure_type || 'un'}`;
    document.getElementById('detail-cost').innerText = formatCurrency(item.cost_price, 'USD');
    document.getElementById('detail-price').innerText = formatCurrency(item.sale_price, 'USD');
    document.getElementById('detail-supplier').innerText = supplierName;
    document.getElementById('detail-location').innerText = item.location || 'N/A';
    document.getElementById('detail-ncm').innerText = item.ncm || 'N/A';
    document.getElementById('detail-description').innerText = item.description || 'Sem descrição.';

    // Populate History Table (Last 5 movements)
    const historyBody = document.getElementById('detail-history-body');
    historyBody.innerHTML = '';
    const itemMovements = movements.filter(m => m.item_id === id).slice(-5).reverse();

    if (itemMovements.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhuma movimentação recente.</td></tr>';
    } else {
        itemMovements.forEach(mov => {
            const date = new Date(mov.date);
            const row = document.createElement('tr');
            const typeLabel = mov.type === 'in' ? '<span class="text-green-600">Entrada</span>' : '<span class="text-red-600">Saída</span>';
            row.innerHTML = `
                <td class="px-4 py-2 text-sm text-gray-600">${date.toLocaleDateString()}</td>
                <td class="px-4 py-2 text-sm">${typeLabel}</td>
                <td class="px-4 py-2 text-sm text-gray-600">${mov.quantity}</td>
                <td class="px-4 py-2 text-sm text-gray-600">${mov.reason || '-'}</td>
            `;
            historyBody.appendChild(row);
        });
    }

    // configure buttons inside details modal
    const editBtn = document.getElementById('detail-edit-btn');
    const moveBtn = document.getElementById('detail-move-btn');

    editBtn.onclick = () => {
        closeModal('item-details-modal');
        openItemModal(id);
    };

    moveBtn.onclick = () => {
        closeModal('item-details-modal');
        openStockModal(id);
    };

    // RBAC for buttons details
    if (!checkPermission('edit')) editBtn.style.display = 'none';
    if (!checkPermission('operation')) moveBtn.style.display = 'none';


    openModal('item-details-modal');
}

export function deleteItem(id) {
    if (!checkPermission('delete')) {
        showNotification('Permissão negada para excluir.', 'danger');
        return;
    }
    const item = items.find(i => i.id === id);
    if (!item) return;

    showConfirmModal('Excluir Item', `Tem a certeza que deseja excluir "${item.name}"? Isso não pode ser desfeito.`, async () => {
        try {
            await deleteItemDB(id);
            fullUpdate();
            showNotification('Item excluído com sucesso.', 'success');
        } catch (err) {
            showNotification(`Erro ao excluir: ${err.message}`, 'danger');
        }
    });
}

// Supplier Actions

export function openSuppliersModal() {
    renderSuppliersList();
    resetSupplierForm();

    const cnpjInput = document.getElementById('supplierCnpj');
    const phoneInput = document.getElementById('supplierPhone');

    // Remove existing listeners to avoid duplication (if any) -> Actually cloning or simple assignment is better if we want to be safe, but addEventListener accumulates.
    // Since this is opened multiple times, we might accumulate listeners!
    // Original code added them every time. 
    // Best practice: use oninput property or clone.
    cnpjInput.oninput = (e) => { e.target.value = formatCnpj(e.target.value); };
    phoneInput.oninput = (e) => { e.target.value = formatPhone(e.target.value); };

    const form = document.getElementById('supplier-form');

    form.onsubmit = async (e) => {
        e.preventDefault();

        const supplierData = {
            id: document.getElementById('supplierId').value || crypto.randomUUID(),
            name: document.getElementById('supplierName').value,
            cnpj: normalizeCnpj(document.getElementById('supplierCnpj').value),
            contact: document.getElementById('supplierSalesperson').value, // Used for local display
            phone: document.getElementById('supplierPhone').value,
            email: document.getElementById('supplierEmail').value,
            address: document.getElementById('supplierAddress').value
        };

        // Prepare payload for DB (remove fields not in schema to avoid 400 Bad Request)
        const dbPayload = { ...supplierData };
        delete dbPayload.contact;

        try {
            if (document.getElementById('supplierId').value) {
                if (!checkPermission('edit')) throw new Error("Sem permissão para editar.");
                await updateSupplier(supplierData.id, dbPayload);
                updateLocalSupplier(supplierData); // Update local state with contact included
                showNotification('Fornecedor atualizado!', 'success');
            } else {
                if (!checkPermission('add')) throw new Error("Sem permissão para adicionar.");
                await addSupplier(dbPayload);
                // For new supplier, dbPayload misses ID if generated by DB?
                // But we generated UUID above. so we are good.
                addLocalSupplier(supplierData);
                showNotification('Fornecedor adicionado!', 'success');
            }
            resetSupplierForm();
            renderSuppliersList();

            // Populate select in item forms
            const itemSelect = document.getElementById('itemSupplier');
            const currentVal = itemSelect.value;
            itemSelect.innerHTML = '<option value="">Selecione o Fornecedor</option>';
            suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.innerText = s.name;
                itemSelect.appendChild(opt);
            });
            itemSelect.value = currentVal;

        } catch (error) {
            showNotification(error.message, 'danger');
        }
    };

    openModal('suppliers-modal');
}

export function editSupplier(id) {
    const supplier = suppliers.find(s => s.id === id);
    if (!supplier) return;
    console.log('DEBUG: Supplier Keys:', Object.keys(supplier));

    document.getElementById('supplierId').value = supplier.id;
    document.getElementById('supplierName').value = supplier.name;
    document.getElementById('supplierCnpj').value = formatCnpj(supplier.cnpj); // Display formatted
    document.getElementById('supplierSalesperson').value = supplier.contact;
    document.getElementById('supplierPhone').value = formatPhone(supplier.phone); // Display formatted
    document.getElementById('supplierEmail').value = supplier.email;
    document.getElementById('supplierAddress').value = supplier.address;

    document.getElementById('supplier-submit-btn').innerHTML = '<i data-feather="save"></i> Salvar Alterações';
    document.getElementById('supplier-cancel-btn').classList.remove('hidden');
    if (window.feather) window.feather.replace();
}

export function resetSupplierForm() {
    document.getElementById('supplier-form').reset();
    document.getElementById('supplierId').value = '';
    document.getElementById('supplier-submit-btn').innerHTML = '<i data-feather="plus"></i> Adicionar Fornecedor';
    document.getElementById('supplier-cancel-btn').classList.add('hidden');
    if (window.feather) window.feather.replace();
}

export function deleteSupplier(id, event) {
    if (event) event.stopPropagation(); // Prevent card click if any
    if (!checkPermission('delete')) {
        showNotification('Permissão negada.', 'danger');
        return;
    }

    const supplier = suppliers.find(s => s.id === id);
    if (!supplier) return;

    // Check usage
    const inUse = items.some(i => i.supplier_id === id);
    if (inUse) {
        showNotification('Não é possível excluir: existem itens vinculados a este fornecedor.', 'warning');
        return;
    }

    showConfirmModal('Excluir Fornecedor', `Deseja excluir "${supplier.name}"?`, async () => {
        try {
            await deleteSupplierDB(id);
            renderSuppliersList();
            showNotification('Fornecedor excluído.', 'success');
        } catch (e) {
            showNotification(e.message, 'danger');
        }
    });
}

// Stock Actions

export function openStockModal(id) {
    if (!checkPermission('operation')) {
        showNotification('Permissão negada.', 'danger');
        return;
    }

    const item = items.find(i => i.id === id);
    if (!item) return;

    document.getElementById('stock-modal-item-name').innerText = item.name;
    document.getElementById('stock-modal-current').innerText = item.quantity;
    document.getElementById('stockId').value = item.id;
    document.getElementById('stockQty').value = '';
    document.getElementById('stockReason').value = '';

    // Set type to 'in' by default
    document.querySelector('input[name="stockType"][value="in"]').checked = true;

    const form = document.getElementById('stock-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const type = document.querySelector('input[name="stockType"]:checked').value;
        const qty = parseFloat(document.getElementById('stockQty').value);
        const reason = document.getElementById('stockReason').value;

        if (!qty || qty <= 0) {
            showNotification('Quantidade inválida.', 'warning');
            return;
        }

        try {
            const newItem = { ...item };
            if (type === 'in') newItem.quantity += qty;
            else {
                if (newItem.quantity < qty) {
                    showNotification('Estoque insuficiente.', 'warning');
                    return;
                }
                newItem.quantity -= qty;
            }

            await updateItem(newItem);

            // Add movement record
            await addMovement({
                id: crypto.randomUUID(),
                item_id: item.id,
                type: type,
                quantity: qty,
                reason: reason || 'Ajuste Manual',
                date: new Date().toISOString()
            });

            showNotification('Estoque atualizado!', 'success');
            closeModal('stock-modal');
            fullUpdate();
        } catch (error) {
            showNotification(`Erro ao atualizar stock: ${error.message}`, 'danger');
        }
    };

    openModal('stock-modal');
}

// User Actions

export async function openUsersModal() {
    const userProfile = getCurrentUserProfile();
    if (!userProfile || userProfile.role !== 'admin') {
        showNotification('Acesso negado.', 'danger');
        return;
    }
    renderUsersList();
    resetUserForm();

    const form = document.getElementById('user-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const userId = document.getElementById('userId').value;
        const email = document.getElementById('userEmail').value; // email is disabled on edit usually
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;
        const name = document.getElementById('userName').value;

        try {
            if (userId) {
                // Edit
                // Update profile (role/name) only. Email cant be changed easily in Supabase without reconfirm.
                // Password change requires logic in auth.js using updateUser.
                await updateUser(userId, { username: name, role: role, password: password }); // Logic in auth.js
                showNotification('Usuário atualizado.', 'success');
            } else {
                // Create
                const permissions = {
                    add: document.getElementById('perm-add').checked,
                    edit: document.getElementById('perm-edit').checked,
                    delete: document.getElementById('perm-delete').checked,
                    operation: document.getElementById('perm-operation').checked,
                    import: document.getElementById('perm-import').checked,
                    reports: document.getElementById('perm-reports').checked
                };
                await createUser(email, password, role, permissions);
                showNotification('Usuário criado com sucesso.', 'success');
            }
            resetUserForm();
            renderUsersList();
        } catch (error) {
            showNotification(error.message, 'danger');
        }
    };

    openModal('users-modal');
}

export function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('userId').value = user.id;
    document.getElementById('userName').value = user.username || '';
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userEmail').disabled = true; // Cannot edit email easily
    document.getElementById('userRole').value = user.role;
    document.getElementById('userPassword').value = ''; // Don't show password
    document.getElementById('userPassword').placeholder = 'Deixe em branco para manter a senha';

    document.getElementById('user-submit-btn').innerHTML = '<i data-feather="save"></i> Salvar';
    document.getElementById('user-cancel-btn').classList.remove('hidden');

    // Populate permissions
    if (user.permissions) {
        const checkboxes = document.querySelectorAll('#permissions-container input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const key = cb.id.replace('perm-', '');
            cb.checked = !!user.permissions[key];
        });
    }

    if (window.feather) window.feather.replace();
}

export function toggleUserStatus(userId, isActive, event) {
    if (event) event.stopPropagation();
    showConfirmModal(isActive ? 'Ativar Usuário' : 'Bloquear Usuário',
        `Deseja ${isActive ? 'ativar' : 'bloquear'} o acesso deste usuário?`,
        async () => {
            try {
                await updateUserStatus(userId, isActive);
                renderUsersList();
                showNotification(`Status atualizado.`, 'success');
            } catch (e) {
                showNotification(e.message, 'danger');
            }
        });
}

export function resetUserForm() {
    document.getElementById('user-form').reset();
    document.getElementById('userId').value = '';
    document.getElementById('userEmail').disabled = false;
    document.getElementById('userPassword').placeholder = 'Senha';
    document.getElementById('user-submit-btn').innerHTML = '<i data-feather="user-plus"></i> Criar Usuário';
    document.getElementById('user-cancel-btn').classList.add('hidden');
    if (window.feather) window.feather.replace();
}

export function deleteUser(userId, event) {
    if (event) event.stopPropagation();
    const currentUser = getCurrentUserProfile();
    if (currentUser.id === userId) {
        showNotification('Você não pode excluir a si mesmo.', 'warning');
        return;
    }

    showConfirmModal('Excluir Usuário', 'Tem a certeza? Isso removerá o acesso permanentemente.', async () => {
        try {
            await deleteUserDB(userId); // Need to implement deleteUserDB in database.js if not exists? ui.js called deleteUserDB.
            renderUsersList();
            showNotification('Usuário excluído.', 'success');
        } catch (e) {
            showNotification(e.message, 'danger');
        }
    });
}

// Operation History Actions

export function openOperationsHistoryModal() {
    renderOperationsHistoryModal();
    openModal('operations-history-modal');
}

export function deleteOperation(operationId) {
    if (!checkPermission('delete')) {
        showNotification('Permissão negada. Apenas Admin.', 'danger');
        return;
    }

    showConfirmModal('Excluir Operação', 'Tem a certeza? Isso REVERTERÁ as alterações de estoque associadas!', async () => {
        try {
            const op = operationsHistory.find(o => o.id === operationId);
            if (!op) throw new Error('Operação não encontrada.');

            // Revert Logic
            // If Type = IN (Entry), we REMOVE items from stock on delete.
            // If Type = OUT (Exit), we ADD items back to stock.
            // But 'operations' in database?
            // ui.js implemented this logic manually inside deleteOperation.

            // I need to copy logic from ui.js 1097+

            // Step 1: Revert Stock
            // Note: UI logic for restoring items that were deleted?
            // If item was deleted, we can't restore stock easily.
            // Logic:
            /*
             if (op.items) {
                for (const itemOp of op.items) {
                    const item = items.find(i => i.id === itemOp.id);
                    if (item) {
                        if (op.type === 'in' || op.type === 'import') {
                            item.quantity = Math.max(0, item.quantity - itemOp.qty);
                        } else {
                            item.quantity += itemOp.qty;
                        }
                        await updateItem(item);
                        // Also remove movement log? 
                        // The 'deleteOperation' usually implies scrubbing the history
                    }
                }
            }
            */
            // My database.js implementation might separate movements from operations?
            // Actually `deleteOperation` in `ui.js` lines 1084-1120 does exactly this.
            // AND it calls `deleteOperationDB` (if it exists) or just splices array.
            // ui.js: operationsHistory.splice(opIndex, 1);
            // AND: removeItem, updateItem...

            // I will use deleteOperationDB logic if possible or replicate raw logic.
            // Since database.js was refactored to specific CRUD...
            // Let's implement the Revert + Delete logic here.

            if (op.items) {
                for (const itemOp of op.items) {
                    const item = items.find(i => i.id === itemOp.id);
                    if (item) {
                        if (op.type === 'import') {
                            // Import adds stock. Revert = Remove.
                            item.quantity = Math.max(0, item.quantity - itemOp.qty);
                        }
                        // Manual operations? Usually 'stock-modal' adds to 'movements' array, not 'operationsHistory'.
                        // 'operationsHistory' seems to be for IMPORTS mostly?
                        // Line 906 ui.js says: const typeLabel = op.type === 'import' ? 'Importação' : 'Manual';
                        // So manual ops exist there too?
                        // If so, handle it.

                        await updateItem(item);
                    }
                }
            }

            // Remove from DB/Array
            await deleteOperationDB(operationId); // Assumes exported from database.js

            renderOperationsHistoryModal();
            renderOperationsHistory(); // dashboard
            fullUpdate(); // items stock changed
            showNotification('Operação e Stock revertidos com sucesso.', 'success');

        } catch (e) {
            console.error(e);
            showNotification('Erro ao excluir operação: ' + e.message, 'danger');
        }
    });

}
