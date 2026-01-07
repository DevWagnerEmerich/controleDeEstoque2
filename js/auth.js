// js/auth.js
import { supabaseClient } from './supabase.js';

let currentUserProfile = null; // Armazenará o usuário da auth + perfil da tabela 'profiles'

/**
 * Busca o perfil de um usuário na tabela 'profiles'.
 * @param {object} user - O objeto do usuário da Supabase (auth.users).
 * @returns {Promise<object|null>} - O perfil completo do usuário com a role, ou null se não encontrado.
 */
async function fetchUserProfile(user) {
    if (!user) return null;

    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('role, is_active')
            .eq('id', user.id);

        if (error) {
            throw error; // Let the catch block handle it
        }

        if (!data || data.length === 0) {
            console.error('Nenhum perfil encontrado para o usuário ID:', user.id);
            return null; // No profile found for this user
        }

        // Combina o usuário da autenticação com os dados do perfil
        return { ...user, role: data[0].role };

    } catch (error) {
        console.error('Erro ao buscar perfil do usuário:', error.message);
        return null;
    }
}

/**
 * Define o perfil do usuário atual no módulo de autenticação.
 * @param {object} profile - O perfil completo do usuário (auth + profile).
 */
function setCurrentUserProfile(profile) {
    currentUserProfile = profile;
}

/**
 * Retorna o perfil do usuário atualmente logado.
 * @returns {object|null} - O objeto do perfil do usuário ou null.
 */
function getCurrentUserProfile() {
    return currentUserProfile;
}

/**
 * Lida com o login do usuário usando Supabase Auth.
 * @param {string} email - O email do usuário.
 * @param {string} password - A senha do usuário.
 * @returns {Promise<{user: object, error: object}>} - O usuário logado ou um erro.
 */
async function handleLogin(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        console.error('Erro no login:', error.message);
        document.getElementById('login-error').textContent = 'Email ou palavra-passe inválidos.';
        return { user: null, error };
    }

    // Check if user is active/approved
    const profile = await fetchUserProfile(data.user);

    if (profile && profile.is_active === false) {
        console.warn('Login blocked: User is not active.');
        await supabaseClient.auth.signOut();
        return { user: null, error: { message: 'Sua conta ainda não foi aprovada pelo administrador.' } };
    }

    // O perfil completo será buscado pelo onAuthStateChange (que chama initializeApp -> fetchUserProfile novamente)
    // Mas para garantir que não haja race condition na UI de erro, retornamos ok aqui.
    return { user: data.user, error: null };
}

/**
 * Lida com o logout do usuário.
 */
async function handleLogout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Erro no logout:', error);
    }
    window.location.hash = '';
    window.location.reload();
}

/**
 * Registra um novo usuário.
 * @param {string} email - O email do novo usuário.
 * @param {string} password - A senha do novo usuário.
 * @returns {Promise<{user: object, error: object}>} - O novo usuário ou um erro.
 */
async function handleSignUp(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        console.error('Erro no registro:', error.message);
        return { user: null, error };
    }
    // O trigger no DB criará o perfil automaticamente.
    return { user: data.user, error: null };
}

/**
 * Verifica as permissões do usuário com base na sua role.
 * @param {string} permissionKey - A chave da permissão a ser verificada (atualmente não utilizada).
 * @returns {boolean} - True se o usuário tiver permissão, senão false.
 */
function checkPermission(permissionKey) {
    const profile = getCurrentUserProfile();
    if (!profile) {
        console.warn("checkPermission chamado sem perfil de usuário.");
        return false;
    }

    // 1. Admin tem acesso total
    if (profile.role === 'admin') return true;

    // 2. Se o perfil tiver permissões granulares explícitas (JSONB), use-as
    if (profile.permissions && typeof profile.permissions === 'object') {
        if (profile.permissions[permissionKey] === true) return true;
        if (profile.permissions[permissionKey] === false) return false;
    }

    // 3. Regras padrão para 'user' (se não houver overrides)
    if (profile.role === 'user') {
        // Usuários comuns podem apenas visualizar relatórios e simular operações (exemplo)
        const allowedForUser = ['reports', 'operation', 'simulate'];
        return allowedForUser.includes(permissionKey);
    }

    return false; // Bloqueia tudo por padrão se não for admin nem user conhecido
}

/**
 * Envia um email de redefinição de senha.
 * @param {string} email - O email do usuário.
 * @returns {Promise<{data: object, error: object}>}
 */
async function sendPasswordReset(email) {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/index.html#reset-password',
    });
    return { data, error };
}

/**
 * Cria um novo usuário chamando a Edge Function 'create-user'.
 * @param {string} email 
 * @param {string} password 
 * @param {string} role 
 * @param {object} permissions
 */
async function createUser(email, password, role, permissions) {
    const { data, error } = await supabaseClient.functions.invoke('create-user', {
        body: { email, password, role, permissions }
    });

    if (error) {
        console.error("Erro na Edge Function:", error);

        // Tenta extrair a mensagem de erro real do corpo da resposta (se houver context)
        if (error.context && typeof error.context.json === 'function') {
            try {
                const errorBody = await error.context.json();
                if (errorBody && errorBody.error) {
                    return { error: { message: errorBody.error } };
                }
            } catch (e) {
                console.warn("Não foi possível ler o corpo do erro da função:", e);
            }
        }

        // Fallback friendly message if function is missing 
        if (error.message && error.message.includes('FunctionsFetchError')) {
            return { error: { message: "A função de criação de usuários (Edge Function) não está implantada." } };
        }
        return { error };
    }
    return { data, error: null };
}

/**
 * Atualiza um usuário existente via Edge Function.
 * @param {string} userId
 * @param {object} updates { role, permissions, password? }
 */
async function updateUser(userId, updates) {
    const payload = { userId, ...updates };

    // Call update-user function
    const { data, error } = await supabaseClient.functions.invoke('update-user', {
        body: payload
    });

    if (error) {
        console.error("Erro na Edge Function update-user:", error);
        if (error.context && typeof error.context.json === 'function') {
            try {
                const errorBody = await error.context.json();
                if (errorBody && errorBody.error) {
                    return { error: { message: errorBody.error } };
                }
            } catch (e) { }
        }
        return { error };
    }
    return { data, error: null };
}

export {
    handleLogin,
    handleLogout,
    handleSignUp,
    fetchUserProfile,
    setCurrentUserProfile,
    getCurrentUserProfile,
    checkPermission,
    sendPasswordReset,
    createUser,
    updateUser,
    supabaseClient
};

