# Docker Deployment Restructure - Summary

The Docker deployment has been completely restructured to use a **two-phase approach** that separates image building from deployment.

## What Changed

### Old Structure (Removed)
```
docker/
├── Dockerfile
├── docker-compose.yml         # ❌ Removed
├── docker-build.sh            # ❌ Removed
├── docker-setup.sh            # ❌ Removed
├── DOCKER.md                  # ❌ Removed
├── DOCKER-QUICKSTART.md       # ❌ Removed
├── config.docker.yaml
└── .env.example
```

### New Structure (Current)
```
docker/
├── build/                     # ✅ Phase 1: Image building
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── build.sh
│   └── README.md
│
├── install/                   # ✅ Phase 2: Deployment
│   ├── install.sh
│   ├── config.template.yaml
│   ├── env.template
│   ├── systemd/
│   │   └── axiom.service
│   └── README.md
│
└── README.md                  # ✅ Overview of both phases
```

## Two-Phase Architecture

### Phase 1: Build (Developer/CI)
**Directory**: `docker/build/`
**Purpose**: Build and publish official Docker images
**Audience**: Apicurio developers, CI/CD pipelines

**Process**:
```bash
cd docker/build
./build.sh 1.0.0      # Build image locally
```

**Output**: `apicurio/apicurio-axiom:1.0.0` on Docker Hub

---

### Phase 2: Install (User/Deployer)
**Directory**: `docker/install/`
**Purpose**: Deploy pre-built images to servers
**Audience**: System administrators, end users

**Process**:
```bash
cd docker/install
sudo ./install.sh     # Interactive installer
```

**Output**:
- Installed at `/opt/apicurio-axiom/`
- Systemd service: `axiom.service`
- Running container from official image

## Key Benefits

### 1. Separation of Concerns
- **Developers**: Build quality images
- **Deployers**: Install and configure
- No mixing of responsibilities

### 2. Enterprise-Friendly
- Official, tested images
- No local building required
- Registry-based distribution
- Works air-gapped

### 3. Simplified Operations
- Single command installation: `./install.sh`
- Interactive configuration
- Systemd integration
- Production-ready defaults

### 4. Clearer Workflows
- **Dev workflow**: build → test → publish
- **Ops workflow**: pull → install → configure → start

## Docker Image

### Official Image Name
```
apicurio/apicurio-axiom
```

### Available Tags
- `latest` - Latest stable release
- `1.0.0` - Specific version
- `1.0.0-rc1` - Release candidate
- `dev` - Development builds (optional)

### Registry Locations
- **Primary**: Docker Hub (`docker.io/apicurio/apicurio-axiom`)
- **Optional**: GitHub CR (`ghcr.io/apicurio/apicurio-axiom`)

## Installation

### For End Users

1. **Download installer**:
   ```bash
   git clone https://github.com/Apicurio/apicurio-axiom.git
   cd apicurio-axiom/docker/install
   ```

2. **Run installer**:
   ```bash
   sudo ./install.sh
   ```

3. **Follow prompts**:
   - Installation directory
   - Docker image version
   - GitHub token
   - Vertex AI project
   - SSH key generation

4. **Service starts automatically**:
   ```bash
   sudo systemctl status axiom
   ```

### For Developers

1. **Build image**:
   ```bash
   cd docker/build
   ./build.sh 1.0.0
   ```

2. **Test image**:
   ```bash
   docker run --rm apicurio/apicurio-axiom:1.0.0 node --version
   ```

## Files Reference

### Phase 1: Build Files

| File | Purpose |
|------|---------|
| `build/Dockerfile` | Multi-stage Docker image definition |
| `build/.dockerignore` | Build exclusions |
| `build/build.sh` | Build image locally |
| `build/README.md` | Build documentation |

### Phase 2: Install Files

| File | Purpose |
|------|---------|
| `install/install.sh` | Interactive installer script |
| `install/config.template.yaml` | Application config template |
| `install/env.template` | Environment variables template |
| `install/systemd/axiom.service` | Systemd service definition |
| `install/README.md` | Installation documentation |

## Removed Dependencies

### Docker Compose Removed
The docker-compose approach has been removed in favor of:
- **Systemd** for service management (production)
- **Direct docker run** for testing/development

**Rationale**:
- Simpler for single-container deployment
- Systemd is standard on Linux servers
- Easier integration with system tools
- Clearer service management

### Legacy Scripts Removed
- `docker-compose.yml` - Replaced by systemd service
- `docker-build.sh` - Replaced by `build/build.sh`
- `docker-setup.sh` - Replaced by `install/install.sh`
- `DOCKER.md` - Split into `build/README.md` and `install/README.md`
- `DOCKER-QUICKSTART.md` - Integrated into respective READMEs

## Migration Guide

### If You Were Using Docker Compose

**Old approach**:
```bash
cd docker
docker-compose up -d
```

**New approach**:
```bash
cd docker/install
sudo ./install.sh
```

The installer creates a systemd service that manages the Docker container.

### If You Were Building Locally

**Old approach**:
```bash
./docker-build.sh
```

**New approach (developers)**:
```bash
cd docker/build
./build.sh 1.0.0
```

**New approach (end users)**:
```bash
# Don't build - just pull official image
cd docker/install
sudo ./install.sh
# Enter: apicurio/apicurio-axiom:latest
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Publish

on:
  push:
    tags: ['v*']

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
```

## Documentation

- **docker/README.md** - Overview of two-phase approach
- **docker/build/README.md** - Building images (for developers)
- **docker/install/README.md** - Installing (for users)
- **README.md** - Updated to reference new structure

## Support

For questions or issues:
- See `docker/install/README.md` for installation help
- See `docker/build/README.md` for build help
- GitHub Issues: https://github.com/Apicurio/apicurio-axiom/issues

---

**Ready to deploy?** → `cd docker/install && sudo ./install.sh`
