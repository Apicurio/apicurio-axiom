# Apicurio Axiom - Docker Deployment

This directory contains all resources for building and deploying Apicurio Axiom as a Docker container.

## Two-Phase Approach

Apicurio Axiom uses a **two-phase deployment model** that separates image building from deployment:

### Phase 1: Build (Developer/CI Responsibility)
**Directory**: `build/`

Build and publish official Docker images to a registry.

**Audience**: Apicurio developers, CI/CD pipelines

```bash
cd build
./build.sh 1.0.0      # Build image
```

**Learn more**: See `build/README.md`

---

### Phase 2: Install (User/Deployer Responsibility)
**Directory**: `install/`

Deploy pre-built images to production servers using an interactive installer.

**Audience**: System administrators, DevOps teams, end users

```bash
cd install
sudo ./install.sh     # Interactive installation
```

**Learn more**: See `install/README.md`

---

## Quick Start (End Users)

Most users should use the **installer** to deploy pre-built images:

```bash
cd install
sudo ./install.sh
```

The installer will:
- ✅ Pull official Docker image from registry
- ✅ Create directory structure
- ✅ Configure environment variables
- ✅ Set up systemd service
- ✅ Start the application

## Quick Start (Developers)

Developers building images should use the **build tools**:

```bash
cd build
./build.sh 1.0.0      # Build locally
```

## Directory Structure

```
docker/
├── build/                      # Phase 1: Image building
│   ├── Dockerfile              # Image definition
│   ├── .dockerignore           # Build exclusions
│   ├── build.sh                # Build script
│   └── README.md               # Build documentation
│
├── install/                    # Phase 2: Deployment
│   ├── install.sh              # Interactive installer
│   ├── config.template.yaml    # Config template
│   ├── env.template            # Environment template
│   ├── systemd/                # Systemd integration
│   │   └── axiom.service       # Service definition
│   └── README.md               # Install documentation
│
└── README.md                   # This file
```

## Docker Image

### Official Images

Pre-built images are available from Docker Hub:

- **Latest stable**: `apicurio/apicurio-axiom:latest`
- **Specific version**: `apicurio/apicurio-axiom:1.0.0`
- **Release candidate**: `apicurio/apicurio-axiom:1.0.0-rc1`

### Pull Image

```bash
docker pull apicurio/apicurio-axiom:latest
```

### Image Details

- **Base**: Alpine Linux (minimal)
- **Size**: ~300-400 MB
- **User**: Non-root (UID 1001)
- **Init**: Tini for signal handling
- **Health**: Built-in health check
- **Arch**: amd64, arm64 (multi-arch)

## Deployment Methods

### 1. Systemd Service (Recommended)

Use the installer for production deployments:

```bash
cd install
sudo ./install.sh
```

**Benefits:**
- ✅ Automatic startup on boot
- ✅ Systemd integration
- ✅ Easy service management
- ✅ Centralized logging

**Management:**
```bash
sudo systemctl start axiom    # Start
sudo systemctl stop axiom     # Stop
sudo systemctl status axiom   # Status
sudo journalctl -u axiom -f   # Logs
```

### 2. Direct Docker Run (Manual)

For testing or custom deployments:

```bash
docker run -d \
  --name apicurio-axiom \
  --user 1001:1001 \
  --env-file .env \
  --volume $(pwd)/config.yaml:/app/config.yaml:ro \
  --volume $(pwd)/data:/app/data \
  --volume $(pwd)/gcloud:/gcloud:ro \
  apicurio/apicurio-axiom:latest
```

## Why This Two-Phase Approach?

### Separation of Concerns
- **Developers** focus on building quality images
- **Deployers** focus on configuration and operations
- Clear responsibilities and workflows

### Enterprise-Friendly
- Official, tested, versioned images
- No need to build locally
- Faster deployment (just pull)
- Works with air-gapped environments

### Simplified Operations
- `./install.sh` does everything
- No Docker expertise required
- Production-ready defaults
- Easy to audit and secure

### CI/CD Ready
- Automated image builds
- Registry-based distribution
- Version management
- Multi-architecture support

## Configuration

### Environment Variables

Required:
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `ANTHROPIC_VERTEX_PROJECT_ID` - Google Cloud project ID (for AI features)

Optional:
- `DATA_DIRECTORY` - Base data directory (default: `/data`)
- `LOG_LEVEL` - Log level (default: `info`)

### Volume Mounts

**IMPORTANT**: The container **requires** `config.yaml` to be mounted and will fail to start without it.

**Required volumes:**
- `/app/config.yaml` - Application configuration (**REQUIRED** - container fails without this)
- `/app/data` - All persistent data (state, logs, events, work directories)

The `/app/data` volume contains:
- `/app/data/state` - SQLite database
- `/app/data/logs` - Action execution logs
- `/app/data/events` - Event JSON logs
- `/app/data/work` - Git repository clones

**Optional volumes:**
- `/app/prompts` - Custom AI agent prompts (overrides built-in prompts)
- `/app/actions` - Custom JavaScript actions
- `/gcloud` - Google Cloud credentials (for Vertex AI)

## Documentation

- **build/README.md** - Building Docker images (for developers)
- **install/README.md** - Installing and deploying (for users)
- **../README.md** - Main project documentation
- **../docs/** - Event mappings, actions, and guides

## Support

- **Issues**: https://github.com/Apicurio/apicurio-axiom/issues
- **Documentation**: https://github.com/Apicurio/apicurio-axiom
- **Docker Hub**: https://hub.docker.com/r/apicurio/apicurio-axiom

---

## For End Users → `install/`
## For Developers → `build/`
