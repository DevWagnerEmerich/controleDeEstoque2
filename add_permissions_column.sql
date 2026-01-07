-- Adiciona a coluna de permissões (JSONB) na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Garante que admins tenham todas as permissões (opcional, mas bom para consistência)
UPDATE public.profiles 
SET permissions = '{"add":true, "edit":true, "delete":true, "operation":true, "import":true, "reports":true}'::jsonb 
WHERE role = 'admin';
