@echo off
setlocal

set "APP_DIR=%~dp0Site\my-mongodb-app"

if not exist "%APP_DIR%\package.json" (
  echo Nao encontrei o projeto em:
  echo %APP_DIR%
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/NPM nao encontrado.
  echo Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

cd /d "%APP_DIR%"

if not exist "node_modules" (
  echo Instalando dependencias do projeto...
  call npm install
  if errorlevel 1 (
    echo Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

start "" "http://127.0.0.1:3000/"
echo Iniciando o projeto em http://127.0.0.1:3000/
echo.
echo Para encerrar, feche esta janela ou pressione Ctrl+C.
echo.

call npm run dev

pause
