-- ==============================================================================
-- SCRIPT COMPLETO DE RESTAURAÇÃO DO BANCO DE DADOS - STOCKCONTROL PRO
-- ==============================================================================
-- Este script recria toda a estrutura do banco de dados do zero.
-- ATENÇÃO: EXECUTE APENAS SE QUISER RESETAR TUDO OU EM UM NOVO PROJETO.
-- ELE APAGA AS TABELAS EXISTENTES!
-- ==============================================================================

-- 1. LIMPEZA (DROP TABLES)
-- ==============================================================================
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.movements CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.operations CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. EXTENSÕES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. TABELAS
-- ==============================================================================

-- Tabela: PROFILES (Perfis de Usuário)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT, -- Geralmente o email
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user', -- 'admin', 'user'
    permissions JSONB, -- Ex: {"add": true, "delete": false}
    is_active BOOLEAN DEFAULT FALSE, -- Fluxo de aprovação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: SUPPLIERS (Fornecedores)
CREATE TABLE public.suppliers (
    id TEXT PRIMARY KEY, -- Ex: "sup_123..." (gerados no front) ou UUID
    name TEXT NOT NULL,
    cnpj TEXT,
    contact TEXT,
    phone TEXT,
    email TEXT,
    fda TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela: ITEMS (Produtos/Estoque)
CREATE TABLE public.items (
    id TEXT PRIMARY KEY, -- Ex: "item_123..."
    code TEXT,
    name TEXT NOT NULL,
    name_en TEXT, -- English name
    description TEXT,
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    sale_price NUMERIC DEFAULT 0,
    package_type TEXT, -- 'caixa', 'fardo', etc.
    units_per_package INTEGER DEFAULT 1,
    unit_measure_type TEXT, -- 'kg', 'g', 'l', 'ml'
    unit_measure_value NUMERIC DEFAULT 0,
    unit_weight NUMERIC DEFAULT 0,
    ncm TEXT,
    supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela: OPERATIONS (Histórico de Operações/Notas)
CREATE TABLE public.operations (
    id TEXT PRIMARY KEY, -- Ex: "OP-123..."
    type TEXT NOT NULL, -- 'in', 'out', 'import', 'simulation'
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    invoice_number TEXT,
    total NUMERIC DEFAULT 0,
    items JSONB, -- Armazena snapshot dos itens na operação
    -- Campos de Invoice/Exportação
    exporter_info TEXT,
    importer_info TEXT,
    booking TEXT,
    payment_term TEXT,
    port_of_departure TEXT,
    destination_port TEXT,
    incoterm TEXT,
    footer_info TEXT,
    ptax_rate NUMERIC,
    costs JSONB, -- Array de custos extras
    manual_net_weight NUMERIC,
    manual_gross_weight NUMERIC,
    nfe_data JSONB, -- Dados brutos da NF-e importada
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela: MOVEMENTS (Movimentação Individual de Estoque)
CREATE TABLE public.movements (
    id TEXT PRIMARY KEY, -- Ex: "mov_123..."
    item_id TEXT REFERENCES public.items(id) ON DELETE CASCADE,
    operation_id TEXT REFERENCES public.operations(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'in', 'out'
    quantity INTEGER NOT NULL,
    price NUMERIC DEFAULT 0,
    reason TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela: PURCHASE_ORDERS (Ordens de Compra)
CREATE TABLE public.purchase_orders (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    items JSONB, -- Lista de itens solicitados
    supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
    xml_attached BOOLEAN DEFAULT FALSE,
    comments TEXT
);

-- Tabela: AUDIT_LOGS (Auditoria de Segurança)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- 'UPDATE', 'DELETE'
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID, -- Referencia auth.users, mas pode ser NULL se sistema
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. FUNÇÕES DE BANCO DE DADOS E TRIGGERS
-- ==============================================================================

-- Função: Gerenciar criação de usuário (Auth -> Profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, is_active)
  VALUES (new.id, new.email, 'user', FALSE); -- Default FALSE: requer aprovação
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Aciona handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Funções Auxiliares de Segurança (Security Definer)
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
DECLARE active_status BOOLEAN;
BEGIN
  SELECT is_active INTO active_status FROM public.profiles WHERE id = auth.uid();
  RETURN active_status IS TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_user_permission(perm_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE user_role TEXT; user_perms JSONB;
BEGIN
  SELECT role, permissions INTO user_role, user_perms FROM public.profiles WHERE id = auth.uid();
  IF user_role = 'admin' THEN RETURN TRUE; END IF;
  IF user_perms IS NOT NULL AND (user_perms->perm_key)::boolean IS TRUE THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. POLÍTICAS DE SEGURANÇA (RLS)
-- ==============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ITEMS
CREATE POLICY "Items viewable by active users" ON public.items FOR SELECT USING ( is_active_user() );
CREATE POLICY "Items insertable by permission" ON public.items FOR INSERT WITH CHECK ( check_user_permission('add') );
CREATE POLICY "Items updatable by permission" ON public.items FOR UPDATE USING ( check_user_permission('edit') );
CREATE POLICY "Items deletable by permission" ON public.items FOR DELETE USING ( check_user_permission('delete') );

-- SUPPLIERS
CREATE POLICY "Suppliers viewable by active users" ON public.suppliers FOR SELECT USING ( is_active_user() );
CREATE POLICY "Suppliers manage by permission" ON public.suppliers FOR ALL USING ( check_user_permission('add') );

-- OPERATIONS
CREATE POLICY "Operations viewable by active users" ON public.operations FOR SELECT USING ( is_active_user() );
CREATE POLICY "Operations insertable by permission" ON public.operations FOR INSERT WITH CHECK ( check_user_permission('operation') );
CREATE POLICY "Operations deletable by permission" ON public.operations FOR DELETE USING ( check_user_permission('delete') );

-- MOVEMENTS
CREATE POLICY "Movements viewable by active users" ON public.movements FOR SELECT USING ( is_active_user() );
CREATE POLICY "Movements insertable by active users" ON public.movements FOR INSERT WITH CHECK ( is_active_user() );
CREATE POLICY "Movements deletable by admin" ON public.movements FOR DELETE USING ( is_admin() );

-- PURCHASE ORDERS
CREATE POLICY "PO viewable by active users" ON public.purchase_orders FOR SELECT USING ( is_active_user() );
CREATE POLICY "PO manage by permission" ON public.purchase_orders FOR ALL USING ( check_user_permission('import') );

-- PROFILES
CREATE POLICY "Profiles viewable by owner or admin" ON public.profiles FOR SELECT USING ( auth.uid() = id OR is_admin() );
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ( auth.uid() = id OR is_admin() );
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ( auth.uid() = id OR is_admin() ); -- Necessário para o trigger funcionar em alguns casos de client-side

-- AUDIT LOGS (Apenas Admin vê)
CREATE POLICY "Audit logs viewable by admin" ON public.audit_logs FOR SELECT USING ( is_admin() );

-- 6. AUDITORIA (LOGS)
-- ==============================================================================

-- Função de Trigger de Auditoria
CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, operation, record_id, old_data, changed_by)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id::TEXT, row_to_json(OLD), auth.uid());
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, operation, record_id, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id::TEXT, row_to_json(OLD), row_to_json(NEW), auth.uid());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar Triggers
CREATE TRIGGER audit_items_changes AFTER UPDATE OR DELETE ON public.items FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();
CREATE TRIGGER audit_suppliers_changes AFTER UPDATE OR DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();
CREATE TRIGGER audit_operations_changes AFTER UPDATE OR DELETE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();
CREATE TRIGGER audit_movements_changes AFTER UPDATE OR DELETE ON public.movements FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();
CREATE TRIGGER audit_profiles_changes AFTER UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

-- FIM DO SCRIPT
