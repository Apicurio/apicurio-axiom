#!/bin/bash
#
# Publish script for Apicurio Axiom Docker image
#
# This script pushes built images to a container registry.
# Intended for Apicurio developers and CI/CD pipelines.
#
# Usage:
#   ./publish.sh [version] [registry]
#
# Examples:
#   ./publish.sh 1.0.0                    # Push to Docker Hub
#   ./publish.sh 1.0.0 ghcr.io            # Push to GitHub Container Registry
#   ./publish.sh 1.0.0 my-registry.com    # Push to private registry

set -e

# Detect script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Configuration
VERSION="${1:-latest}"
REGISTRY="${2:-docker.io}"
IMAGE_NAME="apicurio/apicurio-axiom"

# Full image reference
if [ "$REGISTRY" = "docker.io" ]; then
    FULL_IMAGE="${IMAGE_NAME}"
else
    FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}"
fi

echo "=========================================="
echo "Apicurio Axiom - Publish Docker Image"
echo "=========================================="
echo "Registry: ${REGISTRY}"
echo "Image: ${FULL_IMAGE}"
echo "Version: ${VERSION}"
echo "=========================================="
echo ""

# Check if image exists locally
if ! docker image inspect "${IMAGE_NAME}:${VERSION}" &> /dev/null; then
    echo "ERROR: Image ${IMAGE_NAME}:${VERSION} not found locally."
    echo "Build it first with: ${SCRIPT_DIR}/build.sh ${VERSION}"
    exit 1
fi

# Tag for registry if needed
if [ "$REGISTRY" != "docker.io" ]; then
    echo "Tagging image for ${REGISTRY}..."
    docker tag "${IMAGE_NAME}:${VERSION}" "${FULL_IMAGE}:${VERSION}"
    docker tag "${IMAGE_NAME}:latest" "${FULL_IMAGE}:latest"
fi

# Push version tag
echo ""
echo "Pushing ${FULL_IMAGE}:${VERSION}..."
docker push "${FULL_IMAGE}:${VERSION}"

# Push latest tag
echo ""
echo "Pushing ${FULL_IMAGE}:latest..."
docker push "${FULL_IMAGE}:latest"

echo ""
echo "=========================================="
echo "Publish complete!"
echo "=========================================="
echo ""
echo "Published images:"
echo "  - ${FULL_IMAGE}:${VERSION}"
echo "  - ${FULL_IMAGE}:latest"
echo ""
echo "Users can now pull with:"
echo "  docker pull ${FULL_IMAGE}:${VERSION}"
echo ""
