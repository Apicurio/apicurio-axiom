#!/bin/sh
#
# Docker entrypoint script for Apicurio Axiom
#
# Validates required volume mounts before starting the application
#

set -e

echo "=========================================="
echo "Apicurio Axiom - Docker Container"
echo "=========================================="
echo ""

# Required volume mounts
CONFIG_FILE="/app/config.yaml"

# Validation function
validate_mount() {
    local path=$1
    local description=$2

    if [ ! -e "$path" ]; then
        echo "ERROR: Required volume mount missing: $description"
        echo "  Expected path: $path"
        return 1
    fi

    echo "✓ Found: $description at $path"
    return 0
}

echo "Validating required volume mounts..."
echo ""

# Track validation failures
VALIDATION_FAILED=0

# Validate config.yaml
if ! validate_mount "$CONFIG_FILE" "config.yaml"; then
    VALIDATION_FAILED=1
fi

echo ""

# If validation failed, show usage and exit
if [ $VALIDATION_FAILED -eq 1 ]; then
    echo "=========================================="
    echo "MISSING REQUIRED VOLUME MOUNTS"
    echo "=========================================="
    echo ""
    echo "Apicurio Axiom requires a config.yaml file to be mounted."
    echo ""
    echo "Example docker run command:"
    echo ""
    echo "  docker run -d \\"
    echo "    --name apicurio-axiom \\"
    echo "    --user 1001:1001 \\"
    echo "    --env-file .env \\"
    echo "    --volume \$(pwd)/config.yaml:/app/config.yaml:ro \\"
    echo "    --volume \$(pwd)/data:/app/data \\"
    echo "    apicurio/apicurio-axiom:latest"
    echo ""
    echo "For installation help, see: docker/install/README.md"
    echo ""
    exit 1
fi

echo "All required volume mounts validated successfully"
echo ""

echo "=========================================="
echo "Starting Apicurio Axiom..."
echo "=========================================="
echo ""

# Execute the command passed to the entrypoint
exec "$@"
