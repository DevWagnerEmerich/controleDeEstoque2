
// js/ui/permissions.js
import { checkPermission, getCurrentUserProfile } from '../auth.js';

export function applyPermissionsToUI(userProfile) {
    if (!userProfile) return;

    // Helper para mostrar/esconder ou desabilitar elementos
    const setElementState = (id, hasPermission) => {
        const el = document.getElementById(id);
        if (el) {
            if (!hasPermission) {
                el.classList.add('hidden'); // Ou el.disabled = true para inputs
                // Para links de navegação, melhor esconder
            } else {
                el.classList.remove('hidden');
            }
        }
    };

    // Navegação Principal (Desktop e Mobile)
    setElementState('nav-dashboard', true); // Todos acessam
    setElementState('nav-operations', checkPermission('operation'));
    setElementState('nav-reports', checkPermission('reports'));
    setElementState('nav-menu', true); // Menu acessível, itens internos filtrados

    setElementState('desktop-nav-dashboard', true);
    setElementState('desktop-nav-operations', checkPermission('operation'));
    setElementState('desktop-nav-reports', checkPermission('reports'));

    // Menu Itens (Dentro da View Menu)
    setElementState('menu-suppliers', checkPermission('contacts')); // Ou permissão específica
    setElementState('menu-users', userProfile.role === 'admin');
    setElementState('menu-packlist', checkPermission('reports')); // Packing list é tipo relatório?
    setElementState('menu-invoice', checkPermission('reports'));

    // Botões de Ação Global
    setElementState('add-item-btn-header', checkPermission('add'));

    // Hub de Operações (Botões)
    setElementState('hub-import-op-btn', checkPermission('import'));
    setElementState('hub-add-op-btn', checkPermission('operation')); // Nova operação manual
    setElementState('hub-simulate-op-btn', checkPermission('simulate'));
    setElementState('hub-history-op-btn', checkPermission('reports') || checkPermission('operation'));

    // ... Outros elementos específicos podem ser controlados aqui
}
