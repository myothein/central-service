$ErrorActionPreference = "Stop"

$Root = 'apps/central-service/src'

Write-Host "📁 Creating central-service folder structure..."

function mkd([string]$path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
    }
}

function mkf([string]$path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType File -Path $path | Out-Null
    }
}

# ROOT FILES
mkd $Root
mkf "$Root/index.ts"
mkf "$Root/server.ts"

# CONFIG
mkd "$Root/config"
mkf "$Root/config/load-config.ts"
mkf "$Root/config/env.schema.ts"

# INFRASTRUCTURE
mkd "$Root/infrastructure/db"
mkf "$Root/infrastructure/db/prisma.ts"
mkf "$Root/infrastructure/db/index.ts"

mkd "$Root/infrastructure/messaging"
mkf "$Root/infrastructure/messaging/outbox.ts"
mkf "$Root/infrastructure/messaging/index.ts"

mkd "$Root/infrastructure/scheduler"
mkf "$Root/infrastructure/scheduler/heartbeat-check.ts"
mkf "$Root/infrastructure/scheduler/index.ts"

# SHARED
mkd "$Root/shared/http"
mkf "$Root/shared/http/api-response.ts"
mkf "$Root/shared/http/error-handler.ts"
mkf "$Root/shared/http/http-errors.ts"
mkf "$Root/shared/http/index.ts"

mkd "$Root/shared/middleware"
mkf "$Root/shared/middleware/request-id.ts"
mkf "$Root/shared/middleware/auth.middleware.ts"
mkf "$Root/shared/middleware/tenant-context.ts"
mkf "$Root/shared/middleware/index.ts"

mkd "$Root/shared/types"
mkf "$Root/shared/types/express.d.ts"
mkf "$Root/shared/types/tenant-request.ts"
mkf "$Root/shared/types/pagination.ts"
mkf "$Root/shared/types/index.ts"

mkd "$Root/shared/utils"
mkf "$Root/shared/utils/logger.ts"
mkf "$Root/shared/utils/time.ts"
mkf "$Root/shared/utils/retry.ts"
mkf "$Root/shared/utils/index.ts"

# API v1
mkd "$Root/api/v1"
mkf "$Root/api/v1/index.ts"

mkd "$Root/api/v1/modules"
mkf "$Root/api/v1/modules/index.ts"

# MODULE CREATION FUNCTION
function Create-Module([string]$name) {
    $base = "$Root/api/v1/modules/$name"

    mkd "$base/controllers"
    mkd "$base/routes"
    mkd "$base/services"
    mkd "$base/validators"
    mkd "$base/mappers"

    mkf "$base/$name.constants.ts"
    mkf "$base/$name.types.ts"

    mkf "$base/controllers/$name.controller.ts"
    mkf "$base/controllers/index.ts"

    mkf "$base/routes/$name.routes.ts"
    mkf "$base/routes/index.ts"

    mkf "$base/services/$name.service.ts"
    mkf "$base/services/index.ts"

    mkf "$base/validators/$name.validator.ts"
    mkf "$base/validators/index.ts"

    mkf "$base/mappers/$name.mapper.ts"
    mkf "$base/mappers/index.ts"
}

# CREATE MODULES
Create-Module 'tenant'
Create-Module 'event'
Create-Module 'agent'
Create-Module 'projection'

# HEARTBEAT MODULE
$base = "$Root/api/v1/modules/heartbeat"
mkd "$base/controllers"
mkd "$base/routes"
mkd "$base/services"
mkd "$base/validators"
mkd "$base/mappers"

mkf "$base/heartbeat.types.ts"
mkf "$base/controllers/heartbeat.controller.ts"
mkf "$base/routes/heartbeat.routes.ts"
mkf "$base/services/heartbeat.service.ts"
mkf "$base/validators/heartbeat.validator.ts"
mkf "$base/mappers/heartbeat.mapper.ts"

mkf "$base/controllers/index.ts"
mkf "$base/routes/index.ts"
mkf "$base/services/index.ts"
mkf "$base/validators/index.ts"
mkf "$base/mappers/index.ts"

# AUTH MODULE
$base = "$Root/api/v1/modules/auth"
mkd "$base/controllers"
mkd "$base/routes"
mkd "$base/services"
mkd "$base/validators"
mkd "$base/mappers"

mkf "$base/auth.types.ts"
mkf "$base/controllers/auth.controller.ts"
mkf "$base/routes/auth.routes.ts"
mkf "$base/services/auth.service.ts"
mkf "$base/validators/auth.validator.ts"
mkf "$base/mappers/auth.mapper.ts"

mkf "$base/controllers/index.ts"
mkf "$base/routes/index.ts"
mkf "$base/services/index.ts"
mkf "$base/validators/index.ts"
mkf "$base/mappers/index.ts"

Write-Host "✅ central-service structure created successfully!"
