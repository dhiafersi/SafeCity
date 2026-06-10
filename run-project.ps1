# SafeCity-Connect Jury-Ready Runner
# One-click deterministic startup for presentation day.

Set-Location $PSScriptRoot
$host.ui.RawUI.WindowTitle = "SafeCity-Connect Jury Runner"
$ErrorActionPreference = "Continue"

$ProjectPorts = @(5432, 8761, 8080, 8081, 8082, 8083, 8084, 8000, 4200)
$ProjectContainers = @(
    "safecity-backend",
    "safecity-postgres",
    "safecity-keycloak",
    "safecity-discovery-server",
    "safecity-api-gateway",
    "safecity-incident-service",
    "safecity-support-service",
    "safecity-notification-service",
    "safecity-ai-service",
    "safecity-frontend"
)

function Show-Banner {
    Clear-Host
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host "     * * *  SAFECITY-CONNECT -  RUNNER  * * *" -ForegroundColor Cyan
    Write-Host "==============================================================" -ForegroundColor Cyan
}

function Exit-WithPause($code) {
    Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 5
    }
    exit $code
}

function Invoke-CommandOrFail($description, $scriptBlock) {
    Write-Host $description -ForegroundColor Gray
    & $scriptBlock
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed: $description" -ForegroundColor Red
        Exit-WithPause 1
    }
}

function Ensure-EnvFile {
    $envFile = Join-Path $PSScriptRoot ".env"
    $envExample = Join-Path $PSScriptRoot ".env.example"
    if (-not (Test-Path $envFile)) {
        Write-Host "[INFO] .env file not found. Creating it..." -ForegroundColor Yellow
        if (Test-Path $envExample) {
            Copy-Item $envExample $envFile
        } else {
            New-Item -Path $envFile -ItemType File > $null
        }
        Write-Host "[OK] .env is ready." -ForegroundColor Green
    }
}

function Ensure-RequiredTools {
    where.exe docker >$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Docker is not installed or not in PATH." -ForegroundColor Red
        Write-Host "Install Docker Desktop, then run start-dev.bat again." -ForegroundColor Yellow
        Exit-WithPause 1
    }

    where.exe mvn >$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Maven is not installed or not in PATH." -ForegroundColor Red
        Write-Host "Install Maven, then run start-dev.bat again." -ForegroundColor Yellow
        Exit-WithPause 1
    }
}

function Ensure-DockerRunning {
    Write-Host "[DOCKER] Checking Docker Desktop..." -ForegroundColor Gray
    docker info >$null 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Docker daemon is active." -ForegroundColor Green
        return
    }

    Write-Host "[START] Docker is not running. Starting Docker Desktop..." -ForegroundColor Yellow
    $dockerPaths = @(
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )

    $launched = $false
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            Start-Process -FilePath $path
            $launched = $true
            break
        }
    }

    if (-not $launched) {
        Write-Host "[ERROR] Could not find Docker Desktop." -ForegroundColor Red
        Write-Host "Open Docker Desktop manually, wait for it to start, then run start-dev.bat again." -ForegroundColor Yellow
        Exit-WithPause 1
    }

    $maxWaitSeconds = 180
    $elapsed = 0
    while ($elapsed -lt $maxWaitSeconds) {
        Start-Sleep -Seconds 3
        $elapsed += 3
        docker info >$null 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Docker daemon is ready." -ForegroundColor Green
            return
        }
        Write-Host -NoNewline "." -ForegroundColor Cyan
    }

    Write-Host "`n[ERROR] Docker did not become ready in time." -ForegroundColor Red
    Exit-WithPause 1
}

function Get-ProcessOccupyingPort($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) {
        return $null
    }

    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if (-not $proc) {
        return $null
    }

    return [PSCustomObject]@{
        Port = $port
        ProcessName = $proc.ProcessName
        PID = $proc.Id
    }
}

function Stop-ProjectContainers {
    Write-Host "[CLEAN] Stopping/removing old SafeCity containers..." -ForegroundColor Gray
    docker compose down --remove-orphans >$null 2>$null

    foreach ($container in $ProjectContainers) {
        docker inspect $container >$null 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  - Removing $container" -ForegroundColor DarkGray
            docker rm -f $container >$null 2>$null
        }
    }
}

function Stop-ContainerPublishingPort($port) {
    $containers = docker ps --format "{{.ID}}|{{.Names}}|{{.Ports}}" 2>$null
    foreach ($line in $containers) {
        $parts = $line -split "\|", 3
        if ($parts.Count -lt 3) {
            continue
        }

        $id = $parts[0]
        $name = $parts[1]
        $ports = $parts[2]
        if ($ports -match "(:|0\.0\.0\.0:|\[::\]:)$port->") {
            Write-Host "  - Removing Docker container '$name' from port $port" -ForegroundColor Yellow
            docker rm -f $id >$null 2>$null
            return $true
        }
    }
    return $false
}

function Release-ProjectPorts {
    Write-Host "[PORTS] Freeing required ports: $($ProjectPorts -join ', ')" -ForegroundColor Gray
    $protectedProcessNames = @("System", "Idle", "com.docker.backend", "Docker Desktop", "dockerd", "vpnkit")

    foreach ($port in $ProjectPorts) {
        $containerStopped = Stop-ContainerPublishingPort $port
        if ($containerStopped) {
            Start-Sleep -Milliseconds 500
        }

        $occupant = Get-ProcessOccupyingPort $port
        if ($null -eq $occupant) {
            continue
        }

        if ($protectedProcessNames -contains $occupant.ProcessName) {
            Write-Host "  - Port $port is held by protected process '$($occupant.ProcessName)' (PID $($occupant.PID))." -ForegroundColor Red
            Write-Host "    Close it manually, then run start-dev.bat again." -ForegroundColor Yellow
            Exit-WithPause 1
        }

        try {
            Write-Host "  - Closing '$($occupant.ProcessName)' on port $port (PID $($occupant.PID))" -ForegroundColor Yellow
            Stop-Process -Id $occupant.PID -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 700
        } catch {
            Write-Host "[ERROR] Could not close PID $($occupant.PID) on port ${port}: $($_.Exception.Message)" -ForegroundColor Red
            Exit-WithPause 1
        }
    }
}

function Invoke-LocalMavenBuilds {
    Write-Host "[BUILD] Building Java jars locally using Maven cache..." -ForegroundColor Yellow
    $modules = @(
        @{ Name = "Incident/Support Backend"; Path = "backend" },
        @{ Name = "Eureka Discovery Server"; Path = "services\discovery-server" },
        @{ Name = "API Gateway"; Path = "services\api-gateway" },
        @{ Name = "Notification Service"; Path = "services\notification-service" }
    )

    foreach ($module in $modules) {
        $modulePath = Join-Path $PSScriptRoot $module.Path
        Write-Host "  - $($module.Name)" -ForegroundColor Gray
        Push-Location $modulePath
        mvn -q -DskipTests package
        $buildCode = $LASTEXITCODE
        Pop-Location

        if ($buildCode -ne 0) {
            Write-Host "[ERROR] Maven build failed for $($module.Name)." -ForegroundColor Red
            Exit-WithPause 1
        }
    }
    Write-Host "[OK] Java jars are ready." -ForegroundColor Green
}

function Start-ComposeStack {
    param(
        [bool]$Rebuild = $true
    )

    if ($Rebuild) {
        Write-Host "[START] Building lightweight Docker images and starting the stack..." -ForegroundColor Yellow
        docker compose up -d --build --remove-orphans --force-recreate
    } else {
        Write-Host "[START] Starting the stack using the last build..." -ForegroundColor Yellow
        docker compose up -d --remove-orphans
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] docker compose up failed." -ForegroundColor Red
        docker compose logs --tail=80
        Exit-WithPause 1
    }
}

function Select-StartupMode {
    Write-Host ""
    Write-Host "Choose startup mode:" -ForegroundColor Cyan
    Write-Host "  [F] Fast start (reuse last build)" -ForegroundColor Gray
    Write-Host "  [R] Rebuild (Maven + Docker build)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Press F or R..." -ForegroundColor Yellow

    try {
        $choice = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
    } catch {
        return "R"
    }

    if ($choice -eq "f" -or $choice -eq "F") { return "F" }
    return "R"
}

function Test-HttpEndpoint($url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
    } catch {
        return $false
    }
}

function Wait-ForStack {
    $checks = @(
        @{ Name = "PostgreSQL"; Url = ""; Check = { 
            $h = docker inspect --format='{{.State.Health.Status}}' safecity-postgres 2>$null
            return ($h -eq "healthy" -or $h -eq '"healthy"')
        }},
        @{ Name = "Keycloak Realm"; Url = "http://localhost:8080/realms/safecity"; Check = { Test-HttpEndpoint "http://localhost:8080/realms/safecity" }},
        @{ Name = "Eureka Discovery"; Url = "http://localhost:8761"; Check = { Test-HttpEndpoint "http://localhost:8761" }},
        @{ Name = "API Gateway"; Url = "http://localhost:8081/actuator/health"; Check = { Test-HttpEndpoint "http://localhost:8081/actuator/health" }},
        @{ Name = "Incident Service"; Url = "http://localhost:8082/actuator/health"; Check = { Test-HttpEndpoint "http://localhost:8082/actuator/health" }},
        @{ Name = "Support Service"; Url = "http://localhost:8083/actuator/health"; Check = { Test-HttpEndpoint "http://localhost:8083/actuator/health" }},
        @{ Name = "Notification Service"; Url = "http://localhost:8084/actuator/health"; Check = { Test-HttpEndpoint "http://localhost:8084/actuator/health" }},
        @{ Name = "AI Service"; Url = "http://localhost:8000/health"; Check = { Test-HttpEndpoint "http://localhost:8000/health" }},
        @{ Name = "Frontend"; Url = "http://localhost:4200/"; Check = { Test-HttpEndpoint "http://localhost:4200/" }},
        @{ Name = "Gateway Public API"; Url = "http://localhost:8081/api/public/incidents"; Check = { Test-HttpEndpoint "http://localhost:8081/api/public/incidents" }}
    )

    $maxAttempts = 70
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        Show-Banner
        Write-Host "[WAIT] Verifying stack health (Attempt $attempt/$maxAttempts)" -ForegroundColor Cyan
        Write-Host "--------------------------------------------------------------" -ForegroundColor Gray

        $allReady = $true
        foreach ($check in $checks) {
            $ready = & $check.Check
            if ($ready) {
                Write-Host " [OK] $($check.Name)" -ForegroundColor Green
            } else {
                $allReady = $false
                Write-Host " [WAIT] $($check.Name)" -ForegroundColor Yellow
            }
        }
        Write-Host "--------------------------------------------------------------" -ForegroundColor Gray

        if ($allReady) {
            return
        }

        Start-Sleep -Seconds 3
    }

    Write-Host "`n[ERROR] Stack did not become healthy in time." -ForegroundColor Red
    docker compose ps
    Write-Host "`n[INFO] Main service logs:" -ForegroundColor Yellow
    docker compose logs --tail=100 api-gateway incident-service support-service notification-service discovery-server keycloak
    Exit-WithPause 1
}

function Show-ReadyScreen {
    Clear-Host
    Write-Host "==============================================================" -ForegroundColor Green
    Write-Host "         *** SAFECITY-CONNECT IS 100% READY FOR JURY! ***" -ForegroundColor Green
    Write-Host "==============================================================" -ForegroundColor Green
    Write-Host "Frontend Portal:   " -NoNewline; Write-Host "http://localhost:4200" -ForegroundColor Cyan
    Write-Host "Keycloak Console:  " -NoNewline; Write-Host "http://localhost:8080" -ForegroundColor Cyan
    Write-Host "Eureka Dashboard:  " -NoNewline; Write-Host "http://localhost:8761" -ForegroundColor Cyan
    Write-Host "API Gateway:       " -NoNewline; Write-Host "http://localhost:8081/actuator/health" -ForegroundColor Cyan
    Write-Host "Public API Smoke:  " -NoNewline; Write-Host "http://localhost:8081/api/public/incidents" -ForegroundColor Cyan
    Write-Host "Incident Service:  " -NoNewline; Write-Host "http://localhost:8082/actuator/health" -ForegroundColor Cyan
    Write-Host "Support Service:   " -NoNewline; Write-Host "http://localhost:8083/actuator/health" -ForegroundColor Cyan
    Write-Host "Notification Svc:  " -NoNewline; Write-Host "http://localhost:8084/actuator/health" -ForegroundColor Cyan
    Write-Host "AI Microservice:   " -NoNewline; Write-Host "http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------------------" -ForegroundColor Gray
    Write-Host "[INFO] JURY TEST ACCOUNTS:" -ForegroundColor Yellow
    Write-Host "  Role: CITIZEN      | Username: " -NoNewline; Write-Host "citizen1" -ForegroundColor Green; Write-Host " | Password: " -NoNewline; Write-Host "citizen123" -ForegroundColor Green
    Write-Host "  Role: ADMIN        | Username: " -NoNewline; Write-Host "admin1" -ForegroundColor Green; Write-Host "   | Password: " -NoNewline; Write-Host "admin123" -ForegroundColor Green
    Write-Host "  Role: DEPT (Roads) | Username: " -NoNewline; Write-Host "roads1" -ForegroundColor Green; Write-Host "   | Password: " -NoNewline; Write-Host "roads123" -ForegroundColor Green
    Write-Host "==============================================================" -ForegroundColor Green
}

Show-Banner
Ensure-EnvFile
Ensure-RequiredTools
Ensure-DockerRunning

$startupMode = Select-StartupMode

if ($startupMode -eq "R") {
    Stop-ProjectContainers
    Release-ProjectPorts
    Invoke-LocalMavenBuilds
    Start-ComposeStack -Rebuild $true
} else {
    Start-ComposeStack -Rebuild $false
}

Wait-ForStack
Show-ReadyScreen

Write-Host "[START] Launching Frontend, Keycloak and Eureka in your default browser..." -ForegroundColor Gray
Start-Process "http://localhost:4200"
Start-Process "http://localhost:8080"
Start-Process "http://localhost:8761"

Write-Host "`nPress [L] to stream container logs, or any other key to exit." -ForegroundColor Yellow
try {
    $endChoice = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    if ($endChoice.Character -eq "l" -or $endChoice.Character -eq "L") {
        Write-Host "`n[LOGS] Streaming live docker-compose logs. Press Ctrl+C to stop." -ForegroundColor Cyan
        docker compose logs -f
    }
} catch {
    Start-Sleep -Seconds 5
}
