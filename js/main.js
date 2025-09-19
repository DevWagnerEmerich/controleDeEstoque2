import { initializeAuth } from './auth.js';
import { loadDataAndRenderApp } from './database.js';
import { applyPermissionsToUI, fullUpdate } from './ui.js';
import { initializeEventListeners } from './events.js';

document.addEventListener('DOMContentLoaded', () => {
    if (initializeAuth()) {
        // User is logged in
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadDataAndRenderApp();
        applyPermissionsToUI();
        fullUpdate();
        initializeEventListeners();
    } else {
        // User is not logged in
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});