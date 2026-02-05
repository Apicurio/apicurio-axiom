#!/bin/bash
#
# Build script for Apicurio Axiom Docker image
#
# This script is intended for Apicurio developers and CI/CD pipelines.
# End users should use pre-built images from the registry.
#
# Usage:
#   ./build.sh [version]
#
# Examples:
#   ./build.sh              # Build as 'latest'
#   ./build.sh 1.0.0        # Build as version '1.0.0'
#   ./build.sh 1.0.0-dev    # Build as version '1.0.0-dev'

set -e

# Detect script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "${SCRIPT_DIR}/../.." && pwd )"
DOCKERFILE="${SCRIPT_DIR}/Dockerfile"

# Configuration
VERSION="${1:-latest}"
IMAGE_NAME="apicurio/apicurio-axiom"
BUILD_CONTEXT="${PROJECT_ROOT}"

echo "=========================================="
echo "Apicurio Axiom - Docker Image Build"
echo "=========================================="
echo "Image: ${IMAGE_NAME}"
echo "Version: ${VERSION}"
echo "Script directory: ${SCRIPT_DIR}"
echo "Build context: ${BUILD_CONTEXT}"
echo "Dockerfile: ${DOCKERFILE}"
echo "=========================================="
echo ""

# Verify Dockerfile exists
if [ ! -f "${DOCKERFILE}" ]; then
    echo "ERROR: Dockerfile not found at ${DOCKERFILE}"
    exit 1
fi

# Build the image
echo "Building image..."
docker build \
    --tag "${IMAGE_NAME}:${VERSION}" \
    --tag "${IMAGE_NAME}:latest" \
    --tag quay.io/"${IMAGE_NAME}:${VERSION}" \
    --tag quay.io/"${IMAGE_NAME}:latest" \
    --file "${DOCKERFILE}" \
    --label "org.opencontainers.image.version=${VERSION}" \
    --label "org.opencontainers.image.created=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    "${BUILD_CONTEXT}"

echo ""
echo "=========================================="
echo "Build complete!"
echo "=========================================="
echo ""
echo "Image tags created:"
echo "  - ${IMAGE_NAME}:${VERSION}"
echo "  - ${IMAGE_NAME}:latest"
echo "  - quay.io/${IMAGE_NAME}:${VERSION}"
echo "  - quay.io/${IMAGE_NAME}:latest"
echo ""
echo "Test the image:"
echo "  docker run --rm ${IMAGE_NAME}:${VERSION} node dist/index.js --help"
echo ""
echo "Publish the image:"
echo "  ${SCRIPT_DIR}/publish.sh ${VERSION}"
echo ""
