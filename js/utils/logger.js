// js/utils/logger.js
// Sistema de logging condicional para desenvolvimento e produção

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

class Logger {
    constructor() {
        // Em produção, apenas erros e avisos
        // Em desenvolvimento, todos os níveis
        this.currentLevel = this.isProduction() ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
    }

    isProduction() {
        return window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1' &&
            !window.location.hostname.includes('192.168');
    }

    error(message, ...args) {
        if (this.currentLevel >= LOG_LEVELS.ERROR) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    }

    warn(message, ...args) {
        if (this.currentLevel >= LOG_LEVELS.WARN) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    }

    info(message, ...args) {
        if (this.currentLevel >= LOG_LEVELS.INFO) {
            console.info(`[INFO] ${message}`, ...args);
        }
    }

    debug(message, ...args) {
        if (this.currentLevel >= LOG_LEVELS.DEBUG) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }

    /**
     * Log de operações do usuário para auditoria
     */
    audit(action, details) {
        const auditLog = {
            timestamp: new Date().toISOString(),
            action,
            details,
            user: this.getCurrentUserEmail()
        };

        // Em produção, enviar para serviço de logging
        if (this.isProduction()) {
            // TODO: Enviar para serviço de logging (Sentry, LogRocket, etc)
            console.info('[AUDIT]', auditLog);
        } else {
            console.log('[AUDIT]', auditLog);
        }
    }

    getCurrentUserEmail() {
        try {
            // Tentar obter email do usuário atual
            const user = JSON.parse(localStorage.getItem('supabase.auth.token'))?.user;
            return user?.email || 'unknown';
        } catch {
            return 'unknown';
        }
    }
}

// Exportar instância única
export const logger = new Logger();
