import { users, saveUsers } from './database.js';

let currentUser = null;

async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
    return Math.random().toString(36).substring(2, 15);
}

async function initializeDefaultAdmin() {
    const storedUsers = localStorage.getItem('stockUsers_v2');
    if (!storedUsers || JSON.parse(storedUsers).length === 0) {
        const salt = generateSalt();
        const hashedPassword = await hashPassword('admin123', salt);
        const adminUser = {
            id: `user_${Date.now()}`,
            username: 'admin',
            password: hashedPassword,
            salt: salt,
            role: 'admin',
            permissions: {
                add: true, edit: true, delete: true,
                import: true, operation: true, reports: true
            }
        };
        users.push(adminUser);
        saveUsers();
    } else {
        users.length = 0;
        users.push(...JSON.parse(storedUsers));
    }
}

async function login(username, password) {
    const errorEl = document.getElementById('login-error');
    const storedUsers = JSON.parse(localStorage.getItem('stockUsers_v2')) || [];
    const foundUser = storedUsers.find(u => u.username === username);

    if (foundUser) {
        const hashedPassword = await hashPassword(password, foundUser.salt);
        if (hashedPassword === foundUser.password) {
            errorEl.textContent = '';
            currentUser = foundUser;
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            window.location.reload();
        } else {
            errorEl.textContent = 'Utilizador ou palavra-passe inválidos.';
        }
    } else {
        errorEl.textContent = 'Utilizador ou palavra-passe inválidos.';
    }
}

function initializeAuth() {
    const loggedInUser = sessionStorage.getItem('currentUser');
    if (loggedInUser) {
        currentUser = JSON.parse(loggedInUser);
        return true;
    } else {
        initializeDefaultAdmin();
        return false;
    }
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    login(username, password);
});

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    window.location.reload();
}

function checkPermission(permissionKey) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.permissions && currentUser.permissions[permissionKey];
}

export { initializeAuth, handleLogout, checkPermission, currentUser, hashPassword, generateSalt };
