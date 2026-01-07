-- Script para limpar todos os dados de negócio do banco de dados
-- Mantém apenas os usuários (tabela profiles) e a estrutura das tabelas.
-- Execute este script no Editor SQL do Supabase.

TRUNCATE TABLE movements, items, purchase_orders, operations, suppliers CASCADE;

-- O CASCADE irá limpar automaticamente quaisquer tabelas dependentes ligadas por Foreign Keys.
