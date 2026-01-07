// js/supabase.js

// Importa a função para criar um cliente do SDK do Supabase
const { createClient } = supabase;

// --- Configuração do Supabase ---
// Substitua com os seus próprios dados do painel do Supabase!
const SUPABASE_URL = 'https://edaednirrvsuvilnopbt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkYWVkbmlycnZzdXZpbG5vcGJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NzkwOTUsImV4cCI6MjA3OTA1NTA5NX0.ureEiq2Pzfj13vooKon9nAx9NHisAkE-ri6pTjDlIZY';

// Cria e exporta o cliente Supabase para ser usado em outros módulos
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);