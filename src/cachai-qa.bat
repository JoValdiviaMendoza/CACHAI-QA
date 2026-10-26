@echo off
chcp 65001 >nul
title CACHAI-QA v2.0 - Framework de Automatizacion QA
cls

rem ===== Verificacion de dependencias base (Node.js) =====
where node >nul 2>nul
if errorlevel 1 goto NODE_MISSING

rem ===== Garantizar que exista el archivo .env =====
call :ENSURE_ENV

:MENU
cls
echo ============================================================
echo    CACHAI-QA v2.0 - Framework de Automatizacion QA
echo    Comprehensive Automated Checks ^& Headless Assertions
echo    DUOC Alameda - Capstone 2026
echo ============================================================
echo.
echo  ESCANEOS
echo   [1] Scan RAPIDO        (solo enlaces, pocas paginas)
echo   [2] Scan COMPLETO      (todos los elementos, sin limite)
echo   [3] Scan PERSONALIZADO (elegir tipo de elementos)
echo.
echo  PRUEBAS
echo   [4] Generar / Ejecutar Tests (a partir de un escaneo)
echo.
echo  UTILIDADES
echo   [5] Panel Web (Dashboard)
echo   [6] Pagina de ejemplo (demo)
echo   [7] Configurar .env
echo   [8] Verificar / Instalar Node.js
echo   [9] Verificar / Instalar Playwright (navegadores)
echo   [0] Salir
echo.
set "OPCION="
set /p OPCION="Selecciona opcion [0-9]: "

if "%OPCION%"=="1" goto SCAN_FAST
if "%OPCION%"=="2" goto SCAN_FULL
if "%OPCION%"=="3" goto SCAN_CUSTOM
if "%OPCION%"=="4" goto TESTGEN
if "%OPCION%"=="5" goto DASHBOARD
if "%OPCION%"=="6" goto DEMO
if "%OPCION%"=="7" goto CONFIG
if "%OPCION%"=="8" goto SETUP
if "%OPCION%"=="9" goto SETUP_PW
if "%OPCION%"=="0" exit /b

echo Opcion invalida. Intenta de nuevo.
timeout /t 2 >nul
goto MENU

:SCAN_FAST
cls
echo === SCAN RAPIDO (solo enlaces) ===
echo.
set /p URL="Ingresa URL a escanear (ej: localhost:8099): "
if "%URL%"=="" (
    echo URL vacia.
    timeout /t 2 >nul
    goto MENU
)
call :ENSURE_DEMO "%URL%"
echo.
echo Escaneando SOLO enlaces (1 nivel, hasta 50 paginas, 10 en paralelo)...
echo.
call :RUN_CRAWLER --url="%URL%" --type=links --depth=1 --max-pages=50 --concurrency=10 --verbose
echo.
echo Escaneo rapido finalizado. JSON guardado en scan-report\URL-fecha-hora.json
echo.
pause
goto MENU

:SCAN_FULL
cls
echo === SCAN COMPLETO (todos los elementos) ===
echo.
set /p URL="Ingresa URL a escanear (ej: localhost:8099): "
if "%URL%"=="" (
    echo URL vacia.
    timeout /t 2 >nul
    goto MENU
)
call :ENSURE_DEMO "%URL%"
echo.
echo Escaneando TODO (enlaces, imagenes, formularios, botones) sin limite...
echo Esto puede tardar en sitios grandes.
echo.
call :RUN_CRAWLER --url="%URL%" --type=all --depth=10 --max-pages=99999 --concurrency=10 --verbose
echo.
echo Escaneo completo finalizado. JSON guardado en scan-report\URL-fecha-hora.json
echo.
pause
goto MENU

:SCAN_CUSTOM
cls
echo === SCAN PERSONALIZADO ===
echo.
echo  Que elementos quieres buscar?
echo    [1] Enlaces
echo    [2] Imagenes
echo    [3] Formularios
echo    [4] Botones
echo    [5] Todo
echo    [6] Selector CSS personalizado
echo.
echo  Puedes elegir VARIOS separados por coma. Ejemplos: 1   1,2   2,3,4
echo  (la opcion 6 debe usarse sola)
echo.
set "TIPO="
set /p TIPO="Elige [1-6]: "
set "TYPEFLAG="
set "TIPOSEL="
if defined TIPO for %%a in (%TIPO%) do call :ADD_TIPO %%a
if defined TIPOSEL set "TYPEFLAG=%TIPOSEL:~0,-1%"
if not defined TYPEFLAG (
    echo Opcion invalida.
    timeout /t 2 >nul
    goto MENU
)
set "DEPTH="
set /p DEPTH="Profundidad [Enter = 2]: "
if "%DEPTH%"=="" set "DEPTH=2"
set "MAXP="
set /p MAXP="Maximo de paginas [Enter = 100]: "
if "%MAXP%"=="" set "MAXP=100"
echo.
set /p URL="Ingresa URL a escanear (ej: localhost:8099): "
if "%URL%"=="" (
    echo URL vacia.
    timeout /t 2 >nul
    goto MENU
)
call :ENSURE_DEMO "%URL%"
if "%TYPEFLAG%"=="custom" goto CUSTOM_SELECTOR
echo.
echo Escaneando tipo "%TYPEFLAG%" (depth %DEPTH%, max %MAXP%, 10 en paralelo)...
echo.
call :RUN_CRAWLER --url="%URL%" --type=%TYPEFLAG% --depth=%DEPTH% --max-pages=%MAXP% --concurrency=10 --verbose
echo.
echo Escaneo personalizado finalizado.
echo.
pause
goto MENU

:CUSTOM_SELECTOR
call :ENSURE_DEMO "%URL%"
echo.
set /p SEL="Selector CSS a buscar (ej: table td, .card, #menu a): "
echo.
echo Escaneando selector "%SEL%" (depth %DEPTH%, max %MAXP%)...
echo.
call :RUN_CRAWLER --url="%URL%" --type=custom --selector="%SEL%" --depth=%DEPTH% --max-pages=%MAXP% --concurrency=10 --verbose
echo.
echo Escaneo personalizado finalizado.
echo.
pause
goto MENU

:TESTGEN
cls
echo === PRUEBAS - GENERAR / EJECUTAR (a partir de un escaneo) ===
echo.
call :ENSURE_ENV
if not exist "node_modules\.bin\ts-node.cmd" (
    echo [!] No se encontro node_modules\.bin\ts-node.cmd
    echo     Instala las dependencias con la opcion [8] y vuelve a intentarlo.
    echo.
    pause
    goto MENU
)
if not exist "scan-report" (
    echo [!] Todavia no hay escaneos guardados.
    echo     Ejecuta primero una opcion [1], [2] o [3].
    echo.
    pause
    goto MENU
)
echo Elige el escaneo y luego indica si quieres ejecutar las pruebas.
echo Al final podras abrir el Panel Web con los resultados.
echo Si el escaneo es de localhost:8099, inicia el demo con la opcion [6].
echo.
call :RUN_FROM_SCAN
echo.
pause
goto MENU

:DASHBOARD
cls
echo === PANEL WEB CACHAI-QA ===
echo.
echo Iniciando el panel en http://localhost:4321 ...
echo Se abrira el navegador. Cierra esta ventana para detener el panel.
echo.
node dashboard\server.js
echo.
pause
goto MENU

:DEMO
cls
echo === PAGINA DE EJEMPLO (DEMO) ===
echo.
echo Iniciando servidor de ejemplo en http://localhost:8099 ...
echo Se abrira en una ventana nueva. Para escanearla usa la URL: localhost:8099
echo.
start "CACHAI-QA - Pagina de ejemplo" cmd /k node demo\serve.js
timeout /t 2 >nul
start "" http://localhost:8099/
echo.
pause
goto MENU

:CONFIG
cls
call :ENSURE_ENV
echo === CONFIGURAR .env ===
echo.
echo Se abrira el Bloc de notas con el archivo .env
echo Guarda los cambios (Ctrl+S) y CIERRA el Bloc de notas para volver al menu.
echo.
notepad .env
goto MENU

:ENSURE_DEMO
rem Si la URL apunta al demo local y el servidor no esta escuchando, iniciarlo.
echo "%~1" | findstr /i /c:"localhost:8099" /c:"127.0.0.1:8099" >nul
if errorlevel 1 exit /b
netstat -an | findstr /i "LISTENING" | findstr ":8099" >nul
if not errorlevel 1 exit /b
echo.
echo [i] El servidor de la pagina de ejemplo (localhost:8099) no estaba activo.
echo [i] Iniciandolo automaticamente en una ventana nueva...
start "CACHAI-QA - Pagina de ejemplo" cmd /k node demo\serve.js
timeout /t 3 >nul
exit /b

:SETUP
cls
echo === VERIFICAR / INSTALAR NODE.JS Y DEPENDENCIAS ===
echo.
where node >nul 2>nul
if errorlevel 1 goto SETUP_NONODE
echo [OK] Node.js detectado:
node -v
echo.
echo Verificando dependencias del proyecto (node_modules)...
if not exist "node_modules" (
    echo [!] No se encontro node_modules. Instalando con "npm install"...
    call npm install
) else (
    echo [OK] node_modules encontrado.
)
echo.
echo Node.js y dependencias del proyecto listos.
echo Sugerencia: usa la opcion [9] para instalar los navegadores de Playwright.
pause
goto MENU

:SETUP_PW
cls
echo === VERIFICAR / INSTALAR PLAYWRIGHT (NAVEGADORES) ===
echo.
where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js no esta instalado. Primero instala Node.js con la opcion [8].
    timeout /t 3 >nul
    goto SETUP_NONODE
)
if not exist "node_modules" (
    echo [!] No se encontro node_modules.
    echo     Instala primero las dependencias del proyecto con la opcion [8].
    pause
    goto MENU
)
echo [OK] Node.js detectado.
echo Instalando navegadores de Playwright (chromium y firefox)...
echo Puede tardar la primera vez: descarga los navegadores.
echo.
call npx playwright install chromium firefox
echo.
echo Playwright listo. Los escaneos y tests ya pueden ejecutarse.
pause
goto MENU

:NODE_MISSING
cls
echo ============================================================
echo    [AVISO] Node.js no esta instalado en este equipo
echo ============================================================
echo.
echo CACHAI-QA necesita Node.js (incluye npm) para funcionar.
echo.
timeout /t 2 >nul
goto SETUP_NONODE

:SETUP_NONODE
cls
echo === INSTALAR DEPENDENCIAS BASE (Node.js) ===
echo.
echo Node.js no esta instalado.
echo.
echo   [W] Instalar automaticamente con winget (recomendado)
echo   [M] Abrir la pagina de descarga manual de Node.js
echo   [0] Volver al menu
echo.
set "SETUPOPT="
set /p SETUPOPT="Elige opcion [W/M/0]: "
if /i "%SETUPOPT%"=="W" goto SETUP_WINGET
if /i "%SETUPOPT%"=="M" goto SETUP_MANUAL
goto MENU

:SETUP_WINGET
cls
where winget >nul 2>nul
if errorlevel 1 (
    echo [!] winget no esta disponible en este equipo.
    echo     Se abrira la pagina de descarga manual.
    timeout /t 3 >nul
    goto SETUP_MANUAL
)
echo Instalando Node.js LTS con winget...
echo (Windows puede solicitar permisos de administrador)
echo.
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
echo.
echo ------------------------------------------------------------
echo Si la instalacion fue exitosa:
echo   1) CIERRA esta ventana
echo   2) Vuelve a ejecutar cachai-qa.bat (para actualizar el PATH)
echo   3) Usa las opciones [8] (Node/npm) y [9] (Playwright)
echo ------------------------------------------------------------
pause
goto MENU

:SETUP_MANUAL
echo.
echo Abriendo la pagina de descarga de Node.js...
start "" https://nodejs.org/en/download
echo.
echo Instala la version LTS y luego vuelve a ejecutar cachai-qa.bat.
pause
goto MENU

:RUN_CRAWLER
rem Ejecuta el crawler con el ts-node LOCAL del proyecto.
rem (Se usa la ruta local para que "npx" no descargue una copia suelta y rota.)
if not exist "node_modules\.bin\ts-node.cmd" (
    echo.
    echo [!] No se encontro node_modules\.bin\ts-node.cmd
    echo     Instala las dependencias con la opcion [8] y vuelve a intentarlo.
    exit /b
)
call "node_modules\.bin\ts-node.cmd" crawler.ts %*
exit /b

:RUN_FROM_SCAN
rem Genera (y opcionalmente ejecuta) las pruebas a partir del JSON de un escaneo.
call "node_modules\.bin\ts-node.cmd" cli\from-scan.ts %*
exit /b

:ENSURE_ENV
rem Garantiza que exista el archivo .env (se crea desde .env.example la primera vez)
if exist ".env" exit /b
if not exist ".env.example" exit /b
copy /y ".env.example" ".env" >nul
echo.
echo [i] Se creo el archivo .env a partir de .env.example
exit /b

:ADD_TIPO
rem Acumula los tipos elegidos en la opcion [3] (soporta varios separados por coma).
rem 1=links 2=images 3=forms 4=buttons 5=todo 6=selector CSS
if "%~1"=="1" set "TIPOSEL=%TIPOSEL%links,"
if "%~1"=="2" set "TIPOSEL=%TIPOSEL%images,"
if "%~1"=="3" set "TIPOSEL=%TIPOSEL%forms,"
if "%~1"=="4" set "TIPOSEL=%TIPOSEL%buttons,"
if "%~1"=="5" set "TIPOSEL=all,"
if "%~1"=="6" set "TIPOSEL=custom,"
exit /b
