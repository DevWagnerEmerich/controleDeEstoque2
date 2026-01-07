-- ============================================
-- SCRIPT DE OTIMIZAÇÃO - ÍNDICES DO BANCO DE DADOS
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- para melhorar significativamente a performance das queries
-- ============================================

-- Índices para a tabela 'items'
-- ============================================
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_supplier_id ON public.items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_items_code ON public.items(code);
CREATE INDEX IF NOT EXISTS idx_items_ncm ON public.items(ncm);
CREATE INDEX IF NOT EXISTS idx_items_quantity ON public.items(quantity);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON public.items(created_at DESC);

-- Índice composto para busca por usuário e fornecedor
CREATE INDEX IF NOT EXISTS idx_items_user_supplier ON public.items(user_id, supplier_id);

-- Índice para busca de itens com estoque baixo
CREATE INDEX IF NOT EXISTS idx_items_low_stock ON public.items(user_id, quantity, min_quantity) 
WHERE quantity < min_quantity;

-- Índices para a tabela 'suppliers'
-- ============================================
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_cnpj ON public.suppliers(cnpj);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);

-- Índices para a tabela 'movements'
-- ============================================
CREATE INDEX IF NOT EXISTS idx_movements_user_id ON public.movements(user_id);
CREATE INDEX IF NOT EXISTS idx_movements_item_id ON public.movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_operation_id ON public.movements(operation_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON public.movements(type);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON public.movements(created_at DESC);

-- Índice composto para histórico de movimentações por item
CREATE INDEX IF NOT EXISTS idx_movements_item_date ON public.movements(item_id, created_at DESC);

-- Índice composto para movimentações por usuário e data
CREATE INDEX IF NOT EXISTS idx_movements_user_date ON public.movements(user_id, created_at DESC);

-- Índices para a tabela 'operations'
-- ============================================
CREATE INDEX IF NOT EXISTS idx_operations_user_id ON public.operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_type ON public.operations(type);
CREATE INDEX IF NOT EXISTS idx_operations_invoice_number ON public.operations(invoice_number);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON public.operations(created_at DESC);

-- Índice composto para operações por usuário e tipo
CREATE INDEX IF NOT EXISTS idx_operations_user_type ON public.operations(user_id, type);

-- Índices para a tabela 'profiles'
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Índices para a tabela 'purchase_orders' (se existir)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON public.purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders(created_at DESC);

-- ============================================
-- VERIFICAÇÃO DOS ÍNDICES CRIADOS
-- ============================================
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('items', 'suppliers', 'movements', 'operations', 'profiles', 'purchase_orders')
ORDER BY tablename, indexname;

-- ============================================
-- ANÁLISE DE PERFORMANCE
-- ============================================
-- Após criar os índices, execute ANALYZE para atualizar as estatísticas
ANALYZE public.items;
ANALYZE public.suppliers;
ANALYZE public.movements;
ANALYZE public.operations;
ANALYZE public.profiles;

-- ============================================
-- ESTATÍSTICAS DE TAMANHO
-- ============================================
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('items', 'suppliers', 'movements', 'operations', 'profiles', 'purchase_orders')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Os índices foram criados com sucesso!
-- Suas queries agora devem ser significativamente mais rápidas.
