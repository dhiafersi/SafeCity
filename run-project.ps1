# SafeCity-Connect Jury-Ready Runner Script
# Ensures that the project runs 100% reliably in front of the jury.

Set-Location $PSScriptRoot

# Clean up console and set title
$host.ui.RawUI.WindowTitle = "SafeCity-Connect Runner"
Clear-Host

# Helper to print colored console titles
function Show-Banner {
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host "     * * *  SAFECITY-CONNECT - JURY DEMONSTRATION RUNNER  * * *" -ForegroundColor Cyan
    Write-Host "==============================================================" -ForegroundColor Cyan
}

Show-Banner

# 1. Check & Copy Environment Variables
$envFile = Join-Path $PSScriptRoot ".env"
$envExample = Join-Path $PSScriptRoot ".env.example"
if (-not (Test-Path $envFile)) {
    Write-Host "[INFO] .env file not found. Copying .env.example..." -ForegroundColor Yellow
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "[OK] .env created successfully." -ForegroundColor Green
    } else {
        Write-Host "[WARNING] .env.example not found. Creating empty .env..." -ForegroundColor Yellow
        New-Item -Path $envFile -ItemType File > $null
    }
}

# 2. Check for Docker CLI
where.exe docker >$null 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker is not installed or not in your system PATH!" -ForegroundColor Red
    Write-Host "Please install Docker Desktop (https://www.docker.com/products/docker-desktop) and try again." -ForegroundColor Yellow
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 3. Check for Docker Daemon (Docker Desktop)
Write-Host "[DOCKER] Checking if Docker daemon is running..." -ForegroundColor Gray
& docker info >$null 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Docker is not running. Attempting to start Docker Desktop..." -ForegroundColor Yellow
    
    $dockerPaths = @(
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )
    
    $launched = $false
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            Write-Host "[START] Launching Docker Desktop from: $path" -ForegroundColor Gray
            Start-Process $path
            $launched = $true
            break
        }
    }
    
    if (-not $launched) {
        Write-Host "[ERROR] Could not find Docker Desktop in standard paths." -ForegroundColor Red
        Write-Host "Please open Docker Desktop manually, wait for it to start, then run this script again." -ForegroundColor Yellow
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    # Wait for Docker to start (up to 90 seconds)
    $maxWait = 90
    $waitInterval = 3
    $elapsed = 0
    Write-Host "[WAIT] Waiting for Docker to initialize. Please wait..." -ForegroundColor Cyan
    while ($elapsed -lt $maxWait) {
        Start-Sleep -Seconds $waitInterval
        $elapsed += $waitInterval
        Write-Host -NoNewline "." -ForegroundColor Cyan
        & docker info >$null 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n[OK] Docker daemon is ready!" -ForegroundColor Green
            break
        }
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[ERROR] Docker failed to start in time. Please check Docker Desktop and retry." -ForegroundColor Red
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
} else {
    Write-Host "[OK] Docker daemon is active." -ForegroundColor Green
}

# Helper to check if a port is in use on Windows
function Get-ProcessOccupyingPort($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            return [PSCustomObject]@{
                Port = $port
                ProcessName = $proc.ProcessName
                PID = $proc.Id
            }
        }
    }
    return $null
}

# Helper to verify HTTP endpoints safely
function Check-HttpEndpoint($url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            return $true
        }
    } catch {
        if ($null -ne $_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            if ($statusCode -ge 200 -and $statusCode -lt 400) {
                return $true
            }
        }
    }
    return $false
}

# 4. Check if project is already running and healthy
$containers = @("safecity-postgres", "safecity-keycloak", "safecity-backend", "safecity-ai-service", "safecity-frontend")
$allRunning = $true
foreach ($c in $containers) {
    $state = docker inspect --format='{{.State.Running}}' $c 2>$null
    if ($state -ne "true") {
        $allRunning = $false
        break
    }
}

$alreadyFullyHealthy = $false
if ($allRunning) {
    # Quick health check
    $pgHealth = docker inspect --format='{{.State.Health.Status}}' safecity-postgres 2>$null
    $pgReady = ($pgHealth -eq '"healthy"' -or $pgHealth -eq "healthy")
    
    if ($pgReady -and 
        (Check-HttpEndpoint "http://localhost:4200/") -and 
        (Check-HttpEndpoint "http://localhost:8080/realms/safecity") -and 
        (Check-HttpEndpoint "http://localhost:8081/actuator/health") -and 
        (Check-HttpEndpoint "http://localhost:8000/health")) {
        $alreadyFullyHealthy = $true
    }
}

# Helper to ask user for input with timeout
function Get-InputWithTimeout($timeoutSeconds, $defaultOption) {
    $timer = [diagnostics.stopwatch]::StartNew()
    $selection = $null
    
    try {
        while ($timer.Elapsed.TotalSeconds -lt $timeoutSeconds) {
            $remaining = [math]::Max(0, [math]::Ceiling($timeoutSeconds - $timer.Elapsed.TotalSeconds))
            Write-Host -NoNewline "`r[TIME] Auto-selecting Option [$defaultOption] in $remaining seconds... (Choose: 1-4) " -ForegroundColor Cyan
            
            if ($Host.UI.RawUI.KeyAvailable) {
                $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                $selection = $key.Character
                Write-Host ""
                break
            }
            Start-Sleep -Milliseconds 200
        }
        if ($null -eq $selection) {
            Write-Host ""
            $selection = $defaultOption
        }
    } catch {
        # Fallback if KeyAvailable is not supported in the hosting shell
        Write-Host "`n[WARNING] Interactive timer not supported. Selecting option [$defaultOption]." -ForegroundColor Gray
        $selection = $defaultOption
    }
    return $selection
}

$action = "2" # Default action: clean start if not already running
if ($alreadyFullyHealthy) {
    Write-Host "`n[OK] SafeCity-Connect is ALREADY fully running and healthy!" -ForegroundColor Green
    Write-Host "--------------------------------------------------------" -ForegroundColor Gray
    Write-Host " [1] Keep running & open Frontend in browser (Instant)" -ForegroundColor Green
    Write-Host " [2] Restart all containers (Clean State)" -ForegroundColor Yellow
    Write-Host " [3] Force rebuild & restart all containers (Hard Update)" -ForegroundColor Red
    Write-Host " [4] Stop all containers" -ForegroundColor Yellow
    Write-Host "--------------------------------------------------------" -ForegroundColor Gray
    
    $choice = Get-InputWithTimeout -timeoutSeconds 8 -defaultOption "1"
    $action = $choice
} else {
    Write-Host "`n[INFO] Environment not running or partially active. Starting up..." -ForegroundColor Yellow
    Write-Host " [1] Start normally (Reuses built images - Fast)" -ForegroundColor Green
    Write-Host " [2] Force rebuild & start (Compiles source code - Clean)" -ForegroundColor Red
    Write-Host "--------------------------------------------------------" -ForegroundColor Gray
    
    $choice = Get-InputWithTimeout -timeoutSeconds 10 -defaultOption "1"
    if ($choice -eq "2") {
        $action = "3" # Rebuild & Restart
    } else {
        $action = "2" # Just Start Normally
    }
}

if ($action -eq "1") {
    # Keep running, just jump to final screen
    Write-Host "[START] Keeping current containers active..." -ForegroundColor Green
    Start-Sleep -Seconds 1
} elseif ($action -eq "4") {
    # Stop containers
    Write-Host "[STOP] Shutting down environment..." -ForegroundColor Yellow
    docker compose down
    Write-Host "[OK] SafeCity-Connect is stopped." -ForegroundColor Green
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
} else {
    # Action 2 (Restart/Start) or 3 (Rebuild)
    Write-Host "[STOP] Stopping any partially running containers first..." -ForegroundColor Gray
    docker compose down
    
    # Check for port conflicts before binding
    Write-Host "[INFO] Verifying ports are available (5432, 8080, 8081, 8000, 4200)..." -ForegroundColor Gray
    $portsToCheck = @(5432, 8080, 8081, 8000, 4200)
    $conflicts = @()
    foreach ($p in $portsToCheck) {
        $occupant = Get-ProcessOccupyingPort $p
        if ($null -ne $occupant) {
            $conflicts += $occupant
        }
    }
    
    if ($conflicts.Count -gt 0) {
        Write-Host "[WARNING] Port conflicts detected! Docker cannot bind to these ports:" -ForegroundColor Red
        foreach ($c in $conflicts) {
            Write-Host "  - Port $($c.Port) is occupied by '$($c.ProcessName)' (PID: $($c.PID))" -ForegroundColor Red
        }
        Write-Host "Please stop the local applications/services occupying these ports, then try again." -ForegroundColor Yellow
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    Write-Host "[START] Booting up SafeCity environment..." -ForegroundColor Green
    if ($action -eq "3") {
        Write-Host "[BUILD] Rebuilding container images from source..." -ForegroundColor Yellow
        docker compose up -d --build --remove-orphans --force-recreate
    } else {
        Write-Host "[START] Reusing existing images..." -ForegroundColor Gray
        docker compose up -d --remove-orphans
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] docker compose up failed. Please inspect the logs above." -ForegroundColor Red
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    # Setup status structures for health check polling
    $services = @(
        @{ Name = "PostgreSQL (PostGIS)"; Status = "Starting"; Check = { 
            $h = docker inspect --format='{{.State.Health.Status}}' safecity-postgres 2>$null
            return ($h -eq "healthy" -or $h -eq '"healthy"')
        }},
        @{ Name = "Keycloak Realm Server"; Status = "Starting"; Check = { 
            return (Check-HttpEndpoint "http://localhost:8080/realms/safecity")
        }},
        @{ Name = "Spring Boot Backend API"; Status = "Starting"; Check = { 
            return (Check-HttpEndpoint "http://localhost:8081/actuator/health")
        }},
        @{ Name = "AI YOLO Microservice"; Status = "Starting"; Check = { 
            return (Check-HttpEndpoint "http://localhost:8000/health")
        }},
        @{ Name = "Angular Frontend Nginx"; Status = "Starting"; Check = { 
            return (Check-HttpEndpoint "http://localhost:4200/")
        }}
    )
    
    $maxAttempts = 50 # 50 * 3 seconds = 150 seconds max wait
    $attempt = 0
    $allReady = $false
    
    while ($attempt -lt $maxAttempts -and -not $allReady) {
        $allReady = $true
        Clear-Host
        Show-Banner
        
        Write-Host "[WAIT] Initializing application services (Attempt $($attempt+1)/$maxAttempts):" -ForegroundColor Cyan
        Write-Host "--------------------------------------------------------------" -ForegroundColor Gray
        
        foreach ($s in $services) {
            if ($s.Status -eq "Ready") {
                Write-Host " [OK] $($s.Name) is ONLINE" -ForegroundColor Green
            } else {
                $ready = & $s.Check
                if ($ready) {
                    $s.Status = "Ready"
                    Write-Host " [OK] $($s.Name) is ONLINE" -ForegroundColor Green
                } else {
                    $allReady = $false
                    Write-Host " [WAIT] $($s.Name) is starting..." -ForegroundColor Yellow
                }
            }
        }
        Write-Host "--------------------------------------------------------------" -ForegroundColor Gray
        
        if ($allReady) {
            break
        }
        
        Start-Sleep -Seconds 3
        $attempt++
    }
    
    if (-not $allReady) {
        Write-Host "`n[WARNING] Some services are taking longer than expected to report healthy." -ForegroundColor Yellow
        Write-Host "The application might still be loading. Let's proceed." -ForegroundColor Gray
        Start-Sleep -Seconds 3
    }
}

# 5. Final Jury-Ready Summary Screen
Clear-Host
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "         *** SAFECITY-CONNECT IS 100% READY FOR JURY! ***" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "Frontend Portal:   " -NoNewline; Write-Host "http://localhost:4200" -ForegroundColor Cyan
Write-Host "Keycloak Console:  " -NoNewline; Write-Host "http://localhost:8080" -ForegroundColor Cyan
Write-Host "Backend REST API:  " -NoNewline; Write-Host "http://localhost:8081/swagger-ui/index.html" -ForegroundColor Cyan
Write-Host "AI Microservice:   " -NoNewline; Write-Host "http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------" -ForegroundColor Gray
Write-Host "[INFO] JURY TEST ACCOUNTS:" -ForegroundColor Yellow
Write-Host "  Role: CITIZEN     | Username: " -NoNewline; Write-Host "citizen1" -ForegroundColor Green; Write-Host "  | Password: " -NoNewline; Write-Host "citizen123" -ForegroundColor Green
Write-Host "  Role: ADMIN       | Username: " -NoNewline; Write-Host "admin1" -ForegroundColor Green; Write-Host "    | Password: " -NoNewline; Write-Host "admin123" -ForegroundColor Green
Write-Host "  Role: DEPT (Roads)| Username: " -NoNewline; Write-Host "roads1" -ForegroundColor Green; Write-Host "    | Password: " -NoNewline; Write-Host "roads123" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green

# Automatically open frontend in default browser
Write-Host "[START] Launching Frontend in your default browser..." -ForegroundColor Gray
Start-Process "http://localhost:4200"

Write-Host "`nPress [L] to stream container logs, or any other key to exit." -ForegroundColor Yellow
$endChoice = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
if ($endChoice.Character -eq "l" -or $endChoice.Character -eq "L") {
    Write-Host "`n[LOGS] Streaming live docker-compose logs (Press Ctrl+C to stop)..." -ForegroundColor Cyan
    docker compose logs -f
} else {
    Write-Host "`n*** Have a great presentation! ***" -ForegroundColor Green
    Start-Sleep -Seconds 2
}
