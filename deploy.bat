@echo off
echo --- Iniciando Deploy Automatico ---

echo 0. Corrigindo permissoes do Git...
git config --global --add safe.directory "*"
git config --global user.name "DevWagnerEmerich"
git config --global user.email "dev.wagneremerich@gmail.com"

echo 1. Adicionando todos os arquivos modificados...
git add .

echo 2. Criando commit...
git commit -m "Deploy: Fix invoice weight override and number formatting"

echo 3. Configurando repositorio remoto (GitHub)...
REM Remove o origin antigo caso exista para evitar conflito
git remote remove origin 2>NUL
git remote add origin https://github.com/DevWagnerEmerich/controleDeEstoque2.git

echo 4. Enviando para o GitHub...
git push -u origin main

echo.
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao enviar para o GitHub. Tente enviar para 'master' em vez de 'main'.
    git push -u origin master
)

echo.
echo --- Processo finalizado ---
echo Verifique se houve erros acima.
pause
