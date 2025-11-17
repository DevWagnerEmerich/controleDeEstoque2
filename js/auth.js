// Importa o cliente Supabase
import { supabase } from './supabase.js';

// Variável para armazenar os dados do utilizador logado
export let currentUserProfile = null;

/**
 * Tenta fazer login usando o email e a senha fornecidos.
 * @param {string} email - O email do utilizador.
 * @param {string} password - A senha do utilizador.
 */
export async function login(email, password) {
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = ''; // Limpa erros anteriores

    // Tenta fazer login com o Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        console.error('Erro no login:', error.message);
        errorEl.textContent = 'Email ou palavra-passe inválidos.';
        return;
    }

    if (data.user) {
        // Se o login for bem-sucedido, busca o perfil do utilizador na nossa tabela 'user_profiles'
        await fetchUserProfile(data.user.id);
        window.location.reload(); // Recarrega a página para aplicar o estado de login
    }
}

/**
 * Faz logout do utilizador atual.
 */
export async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Erro no logout:', error.message);
    } else {
        currentUserProfile = null;
        window.location.reload(); // Recarrega para ir para a tela de login
    }
}

/**
 * Busca o perfil do utilizador na tabela 'user_profiles' e armazena localmente.
 * @param {string} userId - O ID do utilizador do Supabase Auth.
 */
export async function fetchUserProfile(userId) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Erro ao buscar perfil do utilizador:', error.message);
        currentUserProfile = null;
    }
    else {
        currentUserProfile = data;
    }
}

/**
 * Verifica a sessão do utilizador ao carregar a aplicação.
 * @returns {Promise<boolean>} - Retorna true se houver um utilizador logado, senão false.
 */
export async function initializeAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session && session.user) {
        await fetchUserProfile(session.user.id);
        return true;
    } else {
        currentUserProfile = null;
        return false;
    }
}

/**
 * Verifica se o utilizador atual tem uma permissão específica.
 * @param {string} permissionKey - A chave da permissão a ser verificada (ex: 'add', 'delete').
 * @returns {boolean} - Retorna true se o utilizador tiver a permissão, senão false.
 */
export function checkPermission(permissionKey) {
    if (!currentUserProfile) return false;
    if (currentUserProfile.role === 'admin') return true;
    return currentUserProfile.permissions && currentUserProfile.permissions[permissionKey];
}

// Adiciona o listener ao formulário de login
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    // O campo de utilizador agora é tratado como email
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    login(email, password);
});