// Importa a função createClient da biblioteca Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

// As suas credenciais do Supabase
const supabaseUrl = 'https://mbbzhubasbmagdsrlsic.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYnpodWJhc2JtYWdkc3Jsc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMzc0NTAsImV4cCI6MjA3ODkxMzQ1MH0.90M9cQz0Ervjf2xAMimc4WRH7_b9rJ-GFDwKOZQWK3o';

// Cria e exporta o cliente Supabase para ser usado em outros arquivos
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
