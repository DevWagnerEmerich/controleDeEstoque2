-- SCRIPT DE AUDITORIA DE SEGURANÇA
-- Cria uma tabela de logs e triggers para monitorar DELETEs e UPDATEs críticos.
-- Isso ajuda a monitorar o uso das permissões "liberadas".

-- 1. Tabela de Logs (se não existir)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- 'DELETE', 'UPDATE', 'INSERT'
    record_id TEXT, -- ID do registro afetado
    old_data JSONB, -- Dados antes da alteração (para recuperar se necessário)
    new_data JSONB, -- Dados novos
    performed_by UUID DEFAULT auth.uid(), -- Quem fez a ação
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS na tabela de logs para que apenas Admin possa ver (ou ninguém, só via banco direto)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Ninguém vê logs via API por padrão (Segurança), apenas insere.
-- Se quiser ver, crie uma policy para admin ver.
CREATE POLICY "Logs insertable by everyone" ON public.audit_logs FOR INSERT WITH CHECK (true);
-- (Opcional) DROP POLICY IF EXISTS "Logs viewable by admin" ON public.audit_logs;
-- (Opcional) CREATE POLICY "Logs viewable by admin" ON public.audit_logs FOR SELECT USING ( is_admin() );

-- 2. Função de Trigger Genérica
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (table_name, operation, record_id, old_data, new_data, performed_by)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        OLD.id::text, -- Assume que todas as tabelas têm 'id'
        to_jsonb(OLD),
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        auth.uid()
    );
    RETURN NULL; -- Trigger AFTER, retorno irrelevante
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Aplicar Triggers nas Tabelas Críticas (Items, Suppliers, Operations, Movements)

-- Items (Monitorar DELETE e UPDATE)
DROP TRIGGER IF EXISTS items_audit_trigger ON public.items;
CREATE TRIGGER items_audit_trigger
AFTER UPDATE OR DELETE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Suppliers
DROP TRIGGER IF EXISTS suppliers_audit_trigger ON public.suppliers;
CREATE TRIGGER suppliers_audit_trigger
AFTER UPDATE OR DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Operations (Monitorar DELETE principalmente)
DROP TRIGGER IF EXISTS operations_audit_trigger ON public.operations;
CREATE TRIGGER operations_audit_trigger
AFTER DELETE ON public.operations
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Movements
DROP TRIGGER IF EXISTS movements_audit_trigger ON public.movements;
CREATE TRIGGER movements_audit_trigger
AFTER DELETE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Profiles (Monitorar DELETE de usuários)
DROP TRIGGER IF EXISTS profiles_audit_trigger ON public.profiles;
CREATE TRIGGER profiles_audit_trigger
AFTER DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Purchase Orders
DROP TRIGGER IF EXISTS purchase_orders_audit_trigger ON public.purchase_orders;
CREATE TRIGGER purchase_orders_audit_trigger
AFTER DELETE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
