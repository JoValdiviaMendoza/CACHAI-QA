@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
rem Trabajar siempre desde la carpeta del .bat (donde estan package.json y node_modules)
cd /d "%~dp0"
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
echo   [1] Scan RAPIDO
echo   [2] Scan COMPLETO
echo   [3] Scan PERSONALIZADO  (elegir tipo de elementos)
echo.
echo  PRUEBAS
echo   [4] Generar / Ejecutar Tests
echo.
echo  UTILIDADES
echo   [5] Panel Web / Dashboard
echo   [6] Pagina Demostración
echo   [7] Configurar .env
echo   [8] Verificar / Instalar Dependencias (Node / Playwright / Cucumber)
echo   [0] Salir
echo.
set "OPCION="
set /p OPCION="Selecciona opcion [0-8]: "

if "%OPCION%"=="1" goto SCAN_FAST
if "%OPCION%"=="2" goto SCAN_FULL
if "%OPCION%"=="3" goto SCAN_CUSTOM
if "%OPCION%"=="4" goto TESTGEN
if "%OPCION%"=="5" goto DASHBOARD
if "%OPCION%"=="6" goto DEMO
if "%OPCION%"=="7" goto CONFIG
if "%OPCION%"=="8" goto SETUP_MENU
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
echo Escaneo rapido finalizado. JSON guardado en scan-report\
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
echo Escaneo completo finalizado. JSON guardado en scan-report\
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
echo  Puedes elegir VARIOS separados por coma. Ejemplos: 1    1,2    2,3,4
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
set "PW_BROWSERS=chromium,firefox,chrome"
set "PW_WORKERS=5"
set "CUCUMBER_PARALLEL=5"
if not exist "node_modules\.bin\ts-node.cmd" (
    echo [!] No se encontro node_modules\.bin\ts-node.cmd
    echo      Instala las dependencias con la opcion [8] - Node.js
    echo.
    pause
    goto MENU
)
if not exist "scan-report" (
    echo [!] Todavia no hay escaneos guardados en scan-report\.
    echo      Ejecuta primero una opcion [1], [2] o [3].
    echo.
    pause
    goto MENU
)

echo Selecciona uno de los ultimos escaneos realizados:
echo.
echo ------------------------------------------------------------
echo  ID  -  Archivo de Escaneo JSON
echo ------------------------------------------------------------

set "count=0"
for /f "delims=" %%f in ('dir /b /o:-d "scan-report\*.json" 2^>nul') do (
    set /a count+=1
    set "file!count!=%%f"
    echo  [!count!]  %%f
    if !count!==5 goto PROMPT_SELECT
)

if %count%==0 (
    echo [!] No se encontraron archivos JSON en scan-report\.
    pause
    goto MENU
)

:PROMPT_SELECT
echo ------------------------------------------------------------
echo.
set "SELECTION="
set /p SELECTION="Elige el numero [1-%count%] (Enter = usar el mas reciente [1]): "

if "%SELECTION%"=="" set "SELECTION=1"

set "TARGET_JSON="
if "%SELECTION%"=="1" set "TARGET_JSON=!file1!"
if "%SELECTION%"=="2" set "TARGET_JSON=!file2!"
if "%SELECTION%"=="3" set "TARGET_JSON=!file3!"
if "%SELECTION%"=="4" set "TARGET_JSON=!file4!"
if "%SELECTION%"=="5" set "TARGET_JSON=!file5!"

if "!TARGET_JSON!"=="" (
    echo [!] Seleccion invalida o archivo no encontrado.
    timeout /t 2 >nul
    goto TESTGEN
)

if not exist "scan-report\!TARGET_JSON!" (
    echo [!] El archivo scan-report\!TARGET_JSON! no existe fisicamente.
    pause
    goto TESTGEN
)

call :ASK_ENGINE
if "%ENGINE%"=="" goto MENU

call :ASK_PROVIDER

echo.
echo Procesando escaneo: !TARGET_JSON!
echo Motor seleccionado: %ENGINE%
echo Entorno: %PROVIDER%
echo Navegadores Playwright: %PW_BROWSERS%
echo Workers Playwright: %PW_WORKERS% ^| Workers Cucumber: %CUCUMBER_PARALLEL%
if "%PROVIDER%"=="browserstack" (
    echo.
    echo [i] BrowserStack ejecutara Playwright en la nube.
    echo [i] Cucumber se ejecutara local. Se usara tunel automatico si la URL es local.
)
echo.

set "BSFLAG="
if "%PROVIDER%"=="browserstack" set "BSFLAG=--browserstack"

if "%ENGINE%"=="cucumber" (
    call "node_modules\.bin\ts-node.cmd" cli\from-scan.ts --scan="scan-report\!TARGET_JSON!" --verbose --no-prompt --no-open
    if errorlevel 1 goto TESTGEN_FAILED
    if not exist "reports\cucumber" mkdir "reports\cucumber"
    echo.
    echo Ejecutando pruebas BDD con Cucumber...
    echo.
    call "node_modules\.bin\cucumber-js.cmd" --config cucumber.js --parallel %CUCUMBER_PARALLEL%
    set "BDD_EXIT=!ERRORLEVEL!"
    call node cli\report-cucumber.js
    call node cli\report-defects.js cucumber --scan="scan-report\!TARGET_JSON!"
    if errorlevel 1 echo [AVISO] No se genero el reporte de defectos: revisa el scan seleccionado.
    if not "!BDD_EXIT!"=="0" echo [AVISO] Algunos escenarios BDD fallaron. Revisa el reporte.
)

if "%ENGINE%"=="playwright" (
    call "node_modules\.bin\ts-node.cmd" cli\from-scan.ts --scan="scan-report\!TARGET_JSON!" --run --verbose --no-prompt --no-open --browsers=%PW_BROWSERS% --workers=%PW_WORKERS% %BSFLAG%
    call node cli\report-defects.js playwright --scan="scan-report\!TARGET_JSON!"
    if errorlevel 1 echo [AVISO] No se genero el reporte de defectos: revisa el scan seleccionado.
)

if "%ENGINE%"=="both" (
    call "node_modules\.bin\ts-node.cmd" cli\from-scan.ts --scan="scan-report\!TARGET_JSON!" --run --verbose --no-prompt --no-open --browsers=%PW_BROWSERS% --workers=%PW_WORKERS% %BSFLAG%
    if not exist "reports\cucumber" mkdir "reports\cucumber"
    echo.
    echo Esperando 5 s antes de Cucumber para no saturar el sitio...
    timeout /t 5 /nobreak >nul
    echo Ejecutando pruebas BDD con Cucumber en %CUCUMBER_PARALLEL% workers...
    echo.
    call "node_modules\.bin\cucumber-js.cmd" --config cucumber.js --parallel %CUCUMBER_PARALLEL%
    set "BDD_EXIT=!ERRORLEVEL!"
    call node cli\report-cucumber.js
    if not "!BDD_EXIT!"=="0" echo [AVISO] Algunos escenarios BDD fallaron. Revisa el reporte.
    call node cli\report-defects.js both --scan="scan-report\!TARGET_JSON!"
    if errorlevel 1 echo [AVISO] No se genero el reporte consolidado: revisa el scan seleccionado.
)

echo.
if exist "reports\bdd-metrics.json" (
    echo === METRICAS BDD ===
    type "reports\bdd-metrics.json"
    echo.
)
echo Proceso finalizado. Reportes guardados en la carpeta reports\
echo   - Playwright: reports\playwright-report-^<fecha^>\index.html
echo   - Cucumber:   reports\cucumber\cucumber-report.html
echo   - Defectos:   reports\defectos-^<host^>-^<fecha^>.md
echo.
set "OPENPANEL="
set /p OPENPANEL="¿Abrir el panel web para ver los resultados? [S/N]: "
if /i "!OPENPANEL!"=="S" (
    start "CACHAI-QA - Panel Web" cmd /k node dashboard\server.js
    echo Panel iniciado en una ventana nueva.
)
echo.
pause
goto MENU

:TESTGEN_FAILED
echo.
echo [AVISO] No se pudieron generar las pruebas a partir del escaneo.
echo     Revisa el mensaje anterior y vuelve a intentarlo.
echo.
pause
goto MENU

:ASK_ENGINE
echo Motores disponibles:
echo    [1] Cucumber (lenguaje natural / BDD) - Usa src\cucumber.js
echo    [2] Playwright (.ts)
echo    [3] Ambos
set "ENGINE="
set "ENGINEOPT="
set /p ENGINEOPT="Elige motor [1-3] (Enter = 1): "
if "%ENGINEOPT%"=="" set "ENGINE=cucumber"
if "%ENGINEOPT%"=="1" set "ENGINE=cucumber"
if "%ENGINEOPT%"=="2" set "ENGINE=playwright"
if "%ENGINEOPT%"=="3" set "ENGINE=both"
exit /b

:ASK_PROVIDER
set "PROVIDER=local"
rem BrowserStack solo aplica a Playwright en este flujo.
if /i "%ENGINE%"=="cucumber" exit /b
set "BS_USER="
set "BS_KEY="
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if /i "%%A"=="BROWSERSTACK_USERNAME" set "BS_USER=%%B"
        if /i "%%A"=="BROWSERSTACK_ACCESS_KEY" set "BS_KEY=%%B"
    )
)
if "%BS_USER%"=="" exit /b
if "%BS_KEY%"=="" exit /b
if /i "%BS_USER%"=="tu_usuario_browserstack" exit /b
if /i "%BS_KEY%"=="tu_access_key_browserstack" exit /b
echo.
echo Entorno de ejecucion:
echo    [1] Local
echo    [2] BrowserStack (nube)
set "BSOPT="
set /p BSOPT="Elige entorno [1-2] (Enter = 1): "
if "%BSOPT%"=="2" set "PROVIDER=browserstack"
if "%PROVIDER%"=="browserstack" set "PW_BROWSERS=chromium,firefox,webkit"
exit /b

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

:SETUP_MENU
cls
echo === VERIFICAR / INSTALAR DEPENDENCIAS ===
echo.
echo    [1] Node.js y dependencias base - npm install
echo    [2] Playwright - Navegadores Chromium / Firefox
echo    [3] Cucumber - Dependencias BDD
echo    [0] Volver al menu principal
echo.
set "SUBO="
set /p SUBO="Elige opcion [1-3, 0]: "
if "%SUBO%"=="1" goto SETUP_NODE
if "%SUBO%"=="2" goto SETUP_PW
if "%SUBO%"=="3" goto SETUP_CUCUMBER
if "%SUBO%"=="0" goto MENU
goto SETUP_MENU

:SETUP_NODE
cls
echo === VERIFICAR / INSTALAR NODE.JS Y DEPENDENCIAS ===
echo.
where node >nul 2>nul
if errorlevel 1 goto SETUP_NONODE
echo [OK] Node.js detectado:
node -v
echo.
echo Verificando dependencias del proyecto - node_modules...
if not exist "node_modules" (
    echo [!] No se encontro node_modules. Instalando con npm install...
    cmd /c npm install
) else (
    echo [OK] node_modules encontrado.
)
echo.
echo Node.js y dependencias del proyecto listos.
echo.
pause
goto SETUP_MENU

:SETUP_PW
cls
echo === VERIFICAR / INSTALAR PLAYWRIGHT NAVEGADORES ===
echo.
where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js no esta instalado. Primero instalalo en la opcion 1 del menu de dependencias.
    timeout /t 3 >nul
    goto SETUP_MENU
)
if not exist "node_modules" (
    echo [!] No se encontro node_modules. Instala primero Node.js y dependencias - opcion 1.
    pause
    goto SETUP_MENU
)
echo [OK] Node.js detectado.
echo Instalando navegadores de Playwright - chromium y firefox...
echo.
cmd /c npx playwright install chromium firefox
echo.
echo Playwright listo.
echo.
pause
goto SETUP_MENU

:SETUP_CUCUMBER
cls
echo === VERIFICAR / INSTALAR CUCUMBER BDD ===
echo.
where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js no esta instalado. Primero instalalo en la opcion 1 del menu de dependencias.
    timeout /t 3 >nul
    goto SETUP_MENU
)
if not exist "node_modules" (
    echo [!] No se encontro node_modules. Instala primero Node.js y dependencias - opcion 1.
    pause
    goto SETUP_MENU
)
echo Verificando modulos de Cucumber...
if not exist "node_modules\@cucumber" (
    echo [!] No se encontro Cucumber instalado. Instalando con npm...
    cmd /c npm install --save-dev @cucumber/cucumber ts-node
) else (
    echo [OK] Modulos de Cucumber encontrados y listos.
)
echo.
pause
goto SETUP_MENU

:NODE_MISSING
cls
echo ============================================================
echo    [AVISO] Node.js no esta instalado en este equipo
echo ============================================================
echo.
echo CACHAI-QA necesita Node.js para funcionar.
echo.
timeout /t 2 >nul
goto SETUP_NONODE

:SETUP_NONODE
cls
echo === INSTALAR DEPENDENCIAS BASE - Node.js ===
echo.
echo Node.js no esta instalado.
echo.
echo    [W] Instalar automaticamente con winget - recomendado
echo    [M] Abrir la pagina de descarga manual de Node.js
echo    [0] Volver al menu
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
    echo      Se abrira la pagina de descarga manual.
    timeout /t 3 >nul
    goto SETUP_MANUAL
)
echo Instalando Node.js LTS con winget...
echo Windows puede solicitar permisos de administrador.
echo.
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
echo.
echo ------------------------------------------------------------
echo Si la instalacion fue exitosa:
echo   1) CIERRA esta ventana
echo   2) Vuelve a ejecutar cachai-qa.bat para actualizar el PATH
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
if not exist "node_modules\.bin\ts-node.cmd" (
    echo.
    echo [!] No se encontro node_modules\.bin\ts-node.cmd
    echo      Instala las dependencias con la opcion 8 - Node.js
    exit /b
)
call "node_modules\.bin\ts-node.cmd" crawler.ts %*
exit /b

:ENSURE_ENV
if exist ".env" exit /b
if not exist ".env.example" exit /b
copy /y ".env.example" ".env" >nul
echo.
echo [i] Se creo el archivo .env a partir de .env.example
exit /b

:ADD_TIPO
if "%~1"=="1" set "TIPOSEL=%TIPOSEL%links,"
if "%~1"=="2" set "TIPOSEL=%TIPOSEL%images,"
if "%~1"=="3" set "TIPOSEL=%TIPOSEL%forms,"
if "%~1"=="4" set "TIPOSEL=%TIPOSEL%buttons,"
if "%~1"=="5" set "TIPOSEL=all,"
if "%~1"=="6" set "TIPOSEL=custom,"
exit /b