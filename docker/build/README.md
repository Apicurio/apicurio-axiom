# Apicurio Axiom - Docker Image Build

This directory contains resources for **building** the official Apicurio Axiom Docker image.

**Audience**: Apicurio developers, CI/CD pipelines

**End users**: Use pre-built images from the registry. See `../install/` for deployment.

## Quick Start (Developers)

```bash
# Build image locally
./build.sh 1.0.0

# Test image
docker run --rm apicurio/apicurio-axiom:1.0.0 node dist/index.js --help

# Publish to registry
./publish.sh 1.0.0
```

## Files

- **Dockerfile** - Multi-stage Docker image definition
- **docker-entrypoint.sh** - Container entrypoint with validation
- **build.sh** - Build Docker image locally
- **publish.sh** - Publish image to container registry
- **README.md** - This file

**Note**: `.dockerignore` is located at the project root (build context location)

## Build Process

### Local Build

Build the image locally for testing:

```bash
./build.sh [version]
```

**Examples:**
```bash
./build.sh              # Build as 'latest'
./build.sh 1.0.0        # Build as version '1.0.0'
./build.sh 1.0.0-rc1    # Build as version '1.0.0-rc1'
```

**Output:**
- `apicurio/apicurio-axiom:${VERSION}`
- `apicurio/apicurio-axiom:latest`

### Publish to Registry

Push built images to a container registry:

```bash
./publish.sh [version] [registry]
```

**Examples:**
```bash
./publish.sh 1.0.0                    # Push to Docker Hub (default)
./publish.sh 1.0.0 ghcr.io            # Push to GitHub Container Registry
./publish.sh 1.0.0 my-registry.com    # Push to private registry
```

**Registries:**
- **Docker Hub**: `docker.io/apicurio/apicurio-axiom` (default)
- **GitHub CR**: `ghcr.io/apicurio/apicurio-axiom`
- **Private**: `your-registry.com/apicurio/apicurio-axiom`

## Docker Image Details

### Multi-Stage Build

The Dockerfile uses a multi-stage build for optimal image size:

1. **Builder stage**: Compile TypeScript, install dependencies
2. **Runtime stage**: Minimal Alpine-based production image

### Image Characteristics

- **Base**: Alpine Linux (minimal)
- **Size**: ~300-400 MB
- **User**: Non-root (UID 1001)
- **Init**: Tini for proper signal handling
- **Health**: Built-in health check
- **Validation**: Startup validation ensures required mounts are present

### Required Volume Mounts

**IMPORTANT**: The Docker image requires `config.yaml` to be mounted at startup. The container will **fail to start** if this file is not provided.

**Required:**
- `/app/config.yaml` - Application configuration (mount as read-only)

**Recommended:**
- `/data/state` - SQLite database (persistent)
- `/data/logs` - Action execution logs
- `/data/events` - Event JSON logs
- `/data/work` - Git repository clones

**Example:**
```bash
docker run -d \
  --name apicurio-axiom \
  --user 1001:1001 \
  --env-file .env \
  --volume $(pwd)/config.yaml:/app/config.yaml:ro \
  --volume $(pwd)/data:/app/data \
  apicurio/apicurio-axiom:latest
```

The `/app/data` volume will contain:
- `/app/data/state` - SQLite database
- `/app/data/logs` - Action execution logs
- `/app/data/events` - Event JSON logs
- `/app/data/work` - Git repository clones

If the config file is missing, you'll see:
```
ERROR: Required volume mount missing: config.yaml
  Expected path: /app/config.yaml
```

### Labels

Images include OCI labels:
- `org.opencontainers.image.version`
- `org.opencontainers.image.created`
- `org.opencontainers.image.title`
- `org.opencontainers.image.description`
- `org.opencontainers.image.vendor`
- `org.opencontainers.image.source`
- `org.opencontainers.image.licenses`

## CI/CD Integration

### GitHub Actions

Example workflow for automated builds:

```yaml
name: Build and Publish Docker Image

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build image
        run: |
          cd docker/build
          ./build.sh ${{ steps.version.outputs.VERSION }}

      - name: Publish image
        run: |
          cd docker/build
          ./publish.sh ${{ steps.version.outputs.VERSION }}
```

### Multi-Architecture Builds

For multi-arch support (amd64, arm64):

```bash
# Set up buildx
docker buildx create --use

# Build and push multi-arch
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag apicurio/apicurio-axiom:1.0.0 \
  --tag apicurio/apicurio-axiom:latest \
  --file Dockerfile \
  --push \
  ../../
```

## Testing Images

### Basic Verification

```bash
# Check image exists
docker image inspect apicurio/apicurio-axiom:1.0.0

# Check image size
docker images apicurio/apicurio-axiom

# Check labels
docker inspect apicurio/apicurio-axiom:1.0.0 | jq '.[0].Config.Labels'
```

### Run Tests

```bash
# Test basic execution
docker run --rm apicurio/apicurio-axiom:1.0.0 node --version

# Test help output
docker run --rm apicurio/apicurio-axiom:1.0.0 node dist/index.js --help

# Test with dry-run mode (requires minimal config)
docker run --rm \
  -e GITHUB_TOKEN=test \
  -e ANTHROPIC_VERTEX_PROJECT_ID=test \
  apicurio/apicurio-axiom:1.0.0 \
  node dist/index.js --dryRun
```

### Security Scanning

```bash
# Scan with Trivy
trivy image apicurio/apicurio-axiom:1.0.0

# Scan with Grype
grype apicurio/apicurio-axiom:1.0.0
```

## Troubleshooting

### Build Fails

```bash
# Clean Docker build cache
docker builder prune

# Build without cache
docker build --no-cache \
  --tag apicurio/apicurio-axiom:latest \
  --file Dockerfile \
  ../../
```

### Large Image Size

Check what's consuming space:

```bash
# Dive into image layers
dive apicurio/apicurio-axiom:latest

# Check layer sizes
docker history apicurio/apicurio-axiom:latest
```

### Native Dependencies

If native dependencies (better-sqlite3, node-pty) fail to build:

- Verify build dependencies in Dockerfile
- Check Alpine package versions
- Test on different platforms

## Versioning Strategy

**Recommended approach:**

- **Latest**: `apicurio/apicurio-axiom:latest` - Latest stable release
- **Major.Minor.Patch**: `apicurio/apicurio-axiom:1.0.0` - Specific version
- **Major.Minor**: `apicurio/apicurio-axiom:1.0` - Latest patch in minor version
- **Major**: `apicurio/apicurio-axiom:1` - Latest minor in major version
- **Release Candidates**: `apicurio/apicurio-axiom:1.0.0-rc1` - Pre-release
- **Development**: `apicurio/apicurio-axiom:dev` - Development builds

## Best Practices

1. **Always tag with version** - Don't rely only on `latest`
2. **Test before publishing** - Verify image works correctly
3. **Sign images** - Use Docker Content Trust in production
4. **Scan for vulnerabilities** - Regular security scans
5. **Document changes** - Update CHANGELOG for each version
6. **Multi-arch support** - Build for multiple platforms
7. **Keep images small** - Regular cleanup and optimization

## Related Documentation

- **Deployment**: See `../install/README.md` for deploying pre-built images
- **Dockerfile**: See comments in `Dockerfile` for build details
- **Main Docs**: See `../../README.md` for project documentation

---

**For end users**: This directory is for **building** images. To **deploy** Apicurio Axiom, see `../install/`
