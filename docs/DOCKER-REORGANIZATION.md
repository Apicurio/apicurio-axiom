# Docker Files Reorganization

All Docker-related files have been moved to the `docker/` directory to keep the project root clean and organized.

## Changes Made

### Files Moved to `docker/` Directory

1. **Dockerfile** → `docker/Dockerfile`
2. **.dockerignore** → `docker/.dockerignore`
3. **docker-compose.yml** → `docker/docker-compose.yml`
4. **docker-build.sh** → `docker/docker-build.sh`
5. **docker-setup.sh** → `docker/docker-setup.sh`
6. **config.docker.yaml** → `docker/config.docker.yaml`
7. **.env.example** → `docker/.env.example`
8. **DOCKER.md** → `docker/DOCKER.md`
9. **DOCKER-QUICKSTART.md** → `docker/DOCKER-QUICKSTART.md`

### Files Moved to `docs/` Directory

- **PHASE1-SUMMARY.md** → `docs/PHASE1-SUMMARY.md`

### New Files Created

- **docker/README.md** - Overview of Docker deployment
- **docker/.gitignore** - Ignore .env files in docker directory
- **DOCKER-DEPLOYMENT.md** - Root-level pointer to docker directory
- **.gitignore** - Updated to handle new structure

### Files Updated

All scripts and configurations have been updated with corrected paths:

1. **docker/docker-compose.yml**
   - Build context changed from `.` to `..` (parent directory)
   - Dockerfile path changed to `docker/Dockerfile`
   - All volume mounts prefixed with `../` to reference parent directory

2. **docker/docker-build.sh**
   - Builds from parent directory
   - References `docker/Dockerfile`
   - Updated instructions

3. **docker/docker-setup.sh**
   - Creates directories in parent directory (`../data`, `../ssh`, etc.)
   - Creates config in parent directory (`../config.yaml`)
   - Creates `.env` in docker directory
   - Updated all path references

## New Directory Structure

```
apicurio-axiom/
├── docker/                      # All Docker files here
│   ├── README.md                # Docker overview
│   ├── DOCKER-QUICKSTART.md     # Quick start
│   ├── DOCKER.md                # Comprehensive guide
│   ├── Dockerfile               # Image definition
│   ├── .dockerignore            # Build exclusions
│   ├── docker-compose.yml       # Orchestration
│   ├── docker-build.sh          # Build script
│   ├── docker-setup.sh          # Setup wizard
│   ├── config.docker.yaml       # Config template
│   ├── .env.example             # Environment template
│   └── .gitignore               # Ignore .env
├── docs/                        # Documentation
│   ├── PHASE1-SUMMARY.md        # Implementation summary
│   └── ...
├── src/                         # Source code
├── prompts/                     # AI prompts
├── actions/                     # Custom actions
├── DOCKER-DEPLOYMENT.md         # Pointer to docker/
├── README.md                    # Main documentation
└── .gitignore                   # Updated for new structure
```

## Runtime Directory Structure

When you run `docker/docker-setup.sh`, it creates:

```
apicurio-axiom/
├── docker/
│   └── .env                     # Your secrets (created here)
├── config.yaml                  # Application config (created here)
├── data/                        # Persistent data (created here)
│   ├── state/
│   ├── logs/
│   ├── events/
│   └── work/
├── ssh/                         # SSH keys (created here)
└── gcloud/                      # GCP credentials (created here)
```

## How to Use

### Quick Start

```bash
# Change to docker directory
cd docker

# Run setup wizard
./docker-setup.sh

# Build image
./docker-build.sh

# Start service
docker-compose up -d
```

### All Docker Commands from docker/ Directory

```bash
cd docker

# Setup and build
./docker-setup.sh
./docker-build.sh

# Service management
docker-compose up -d
docker-compose down
docker-compose restart
docker-compose logs -f
docker-compose ps
```

### Configuration Files

- **docker/.env** - Environment variables (secrets, in docker directory)
- **config.yaml** - Application config (in root directory)
- **prompts/** - AI agent prompts (in root directory)
- **actions/** - Custom actions (in root directory)

## Benefits of This Structure

1. **Clean Root Directory**
   - No Docker clutter in project root
   - Easy to find application code
   - Clear separation of concerns

2. **Organized Deployment**
   - All Docker files in one place
   - Easy to navigate
   - Clear documentation hierarchy

3. **Flexible Deployment**
   - Room for other deployment methods (systemd, k8s, etc.)
   - Each deployment in its own directory
   - No conflicts between deployment types

4. **Better Git Management**
   - `.env` files in docker directory (ignored)
   - Config templates clearly separated
   - Easy to track deployment changes

## Migration from Old Structure

If you were using the old structure (Docker files in root):

```bash
# No migration needed if you haven't started yet!
# Just use the new structure.

# If you had .env in root:
mv .env docker/.env

# If you had config.yaml from old template:
# Just use your existing config.yaml
# The new template is at docker/config.docker.yaml
```

## References

- **Docker README**: `docker/README.md` - Start here for Docker deployment
- **Quick Start**: `docker/DOCKER-QUICKSTART.md` - 5-minute setup guide
- **Comprehensive Guide**: `docker/DOCKER.md` - Full documentation
- **Root Pointer**: `DOCKER-DEPLOYMENT.md` - Points to docker directory

## Notes

- All Docker commands should be run from the `docker/` directory
- The build context is the parent directory (project root)
- Volume mounts reference parent directory (`../`)
- Environment variables are in `docker/.env`
- Application config is in root `config.yaml`

---

**Ready to deploy?** → `cd docker && ./docker-setup.sh`
