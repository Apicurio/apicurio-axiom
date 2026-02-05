# Apicurio Axiom - Installation

This directory contains resources for **installing and deploying** Apicurio Axiom using pre-built Docker images.

**Audience**: System administrators, DevOps teams, end users

**For developers**: See `../build/` for building Docker images.

## Quick Start

```bash
# Run the interactive installer
sudo ./install.sh
```

The installer will guide you through:
- Pulling the official Docker image
- Creating directory structure
- Configuring environment variables
- Copying Google Cloud credentials (if available)
- Setting up the application
- Creating systemd service
- Starting the service

## Prerequisites

- Linux server with systemd
- Docker installed and running
- Root/sudo access
- GitHub Personal Access Token
- (Optional) Google Cloud credentials for AI features

## Installation Process

### 1. Download Installer

```bash
# Clone repository or download just the install directory
git clone https://github.com/Apicurio/apicurio-axiom.git
cd apicurio-axiom/docker/install
```

Or download just the installer:

```bash
# Download install script
curl -O https://raw.githubusercontent.com/Apicurio/apicurio-axiom/main/docker/install/install.sh
chmod +x install.sh

# Download templates
curl -O https://raw.githubusercontent.com/Apicurio/apicurio-axiom/main/docker/install/config.template.yaml

# Download systemd service
mkdir -p systemd
curl -o systemd/apicurio-axiom.service https://raw.githubusercontent.com/Apicurio/apicurio-axiom/main/docker/install/systemd/axiom.service
```

### 2. Run Installer

```bash
sudo ./install.sh
```

**Interactive prompts:**
- Installation directory (default: `/opt/apicurio-axiom`)
- Docker image name (default: `apicurio/apicurio-axiom:latest`)
- GitHub Personal Access Token
- Google Cloud Vertex AI Project ID (optional)
- Copy gcloud config from `~/.config/gcloud` (if available)
- Start service now?

### 3. Verify Installation

```bash
# Check service status
sudo systemctl status axiom

# View logs
sudo journalctl -u axiom -f

# Check container
docker ps | grep apicurio-axiom
```

## What Gets Installed

### Directory Structure

```
/opt/apicurio-axiom/          # Default installation directory
├── config.yaml               # Application configuration
├── .env                      # Environment variables (secrets)
├── data/                     # Persistent data
│   ├── state/                # SQLite database
│   ├── logs/                 # Action execution logs
│   ├── events/               # Event JSON logs
│   └── work/                 # Git repository clones
├── gcloud/                   # Google Cloud credentials
│   └── credentials.json
├── prompts/                  # AI agent prompts (optional)
└── actions/                  # Custom actions (optional)
```

### Systemd Service

- **Service file**: `/etc/systemd/system/apicurio-axiom.service`
- **Service name**: `apicurio-axiom`
- **Auto-start**: Enabled (starts on boot)
- **Restart policy**: Always restart on failure

### Docker Container

- **Image**: `apicurio/apicurio-axiom:latest` (or specified version)
- **Container name**: `apicurio-axiom`
- **User**: UID 1001 (non-root)
- **Restart**: Managed by systemd
- **Volumes**: All data persisted on host

## Service Management

### Start/Stop Service

```bash
# Start
sudo systemctl start axiom

# Stop
sudo systemctl stop axiom

# Restart
sudo systemctl restart axiom

# Status
sudo systemctl status axiom

# Enable (start on boot)
sudo systemctl enable axiom

# Disable (don't start on boot)
sudo systemctl disable axiom
```

### View Logs

```bash
# Follow logs in real-time
sudo journalctl -u axiom -f

# View last 100 lines
sudo journalctl -u axiom -n 100

# View logs since specific time
sudo journalctl -u axiom --since "2026-02-04 14:00:00"

# View logs for specific date
sudo journalctl -u axiom --since today
```

### Container Management

```bash
# View container status
docker ps | grep apicurio-axiom

# View container logs (alternative to journalctl)
docker logs -f apicurio-axiom

# Access container shell (bash is available in the image)
docker exec -it apicurio-axiom bash

# View container resource usage
docker stats apicurio-axiom
```

## Configuration

### Update Configuration

```bash
# Edit application config
sudo nano /opt/apicurio-axiom/config.yaml

# Restart to apply changes
sudo systemctl restart axiom
```

### Update Environment Variables

```bash
# Edit environment file
sudo nano /opt/apicurio-axiom/.env

# Restart to apply changes
sudo systemctl restart axiom
```

### Add Custom Prompts

```bash
# Copy prompts to prompts directory
sudo cp my-prompt.hbs /opt/apicurio-axiom/prompts/

# No restart needed - prompts are loaded dynamically
```

### Add Custom Actions

```bash
# Copy actions to actions directory
sudo cp my-action.js /opt/apicurio-axiom/actions/

# Update config.yaml to reference the action
# Then restart
sudo systemctl restart axiom
```

## Updating to New Version

### Update to Latest

```bash
# Edit systemd service to pull latest
sudo nano /etc/systemd/system/apicurio-axiom.service

# Uncomment this line:
# ExecStartPre=/usr/bin/docker pull apicurio/apicurio-axiom:latest

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart axiom
```

### Update to Specific Version

```bash
# Edit systemd service
sudo nano /etc/systemd/system/apicurio-axiom.service

# Change IMAGE_NAME to specific version:
# apicurio/apicurio-axiom:1.0.0

# Or run directly:
sudo sed -i 's|apicurio/apicurio-axiom:latest|apicurio/apicurio-axiom:1.0.0|g' \
  /etc/systemd/system/apicurio-axiom.service

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart axiom
```

## Backup and Restore

### Backup

```bash
#!/bin/bash
BACKUP_DIR="/backup/axiom-$(date +%Y%m%d-%H%M%S)"
INSTALL_DIR="/opt/apicurio-axiom"

mkdir -p "$BACKUP_DIR"

# Backup database
docker exec apicurio-axiom sqlite3 /data/state/events.db ".backup '/tmp/backup.db'" || true
docker cp apicurio-axiom:/tmp/backup.db "$BACKUP_DIR/events.db" || \
  cp "$INSTALL_DIR/data/state/events.db" "$BACKUP_DIR/events.db"

# Backup configuration
cp "$INSTALL_DIR/config.yaml" "$BACKUP_DIR/"
cp "$INSTALL_DIR/.env" "$BACKUP_DIR/"

# Optional: Backup logs (may be large)
# tar -czf "$BACKUP_DIR/logs.tar.gz" "$INSTALL_DIR/data/logs/"

echo "Backup created: $BACKUP_DIR"
```

### Restore

```bash
#!/bin/bash
BACKUP_DIR="/backup/axiom-20260204-120000"
INSTALL_DIR="/opt/apicurio-axiom"

# Stop service
sudo systemctl stop axiom

# Restore database
cp "$BACKUP_DIR/events.db" "$INSTALL_DIR/data/state/"
chown 1001:1001 "$INSTALL_DIR/data/state/events.db"

# Restore configuration
cp "$BACKUP_DIR/config.yaml" "$INSTALL_DIR/"
cp "$BACKUP_DIR/.env" "$INSTALL_DIR/"

# Start service
sudo systemctl start axiom

echo "Restore complete"
```

## Uninstallation

### Complete Removal

```bash
#!/bin/bash
INSTALL_DIR="/opt/apicurio-axiom"

# Stop and disable service
sudo systemctl stop axiom
sudo systemctl disable axiom

# Remove systemd service
sudo rm /etc/systemd/system/apicurio-axiom.service
sudo systemctl daemon-reload

# Stop and remove container
docker stop apicurio-axiom || true
docker rm apicurio-axiom || true

# Remove image (optional)
docker rmi apicurio/apicurio-axiom:latest || true

# Remove installation directory
sudo rm -rf "$INSTALL_DIR"

echo "Apicurio Axiom uninstalled"
```

### Partial Removal (Keep Data)

```bash
# Stop and disable service
sudo systemctl stop axiom
sudo systemctl disable axiom

# Remove service file
sudo rm /etc/systemd/system/apicurio-axiom.service
sudo systemctl daemon-reload

# Data remains in /opt/apicurio-axiom/data/
```

## Troubleshooting

### Service Won't Start

```bash
# Check service status
sudo systemctl status axiom

# Check logs
sudo journalctl -u axiom -n 100

# Check Docker
docker ps -a | grep apicurio-axiom
docker logs apicurio-axiom
```

### Permission Issues

```bash
# Fix data directory permissions
sudo chown -R 1001:1001 /opt/apicurio-axiom/data/
```

### High Disk Usage

```bash
# Check data directory size
du -sh /opt/apicurio-axiom/data/

# Clean old logs
find /opt/apicurio-axiom/data/logs -mtime +30 -delete
find /opt/apicurio-axiom/data/events -mtime +30 -delete

# Clean work directories
rm -rf /opt/apicurio-axiom/data/work/*/
```

### Update Image

```bash
# Pull latest image
docker pull apicurio/apicurio-axiom:latest

# Restart service
sudo systemctl restart axiom
```

## Advanced Configuration

### Custom Installation Directory

The installer prompts for the installation directory. To use a non-standard location:

```bash
# When prompted, enter your custom path:
# Installation directory [/opt/apicurio-axiom]: /home/user/axiom
```

### Multiple Instances

To run multiple instances (different repos, different configs):

```bash
# First instance (default)
sudo ./install.sh
# Install to: /opt/apicurio-axiom
# Service: axiom

# Second instance
sudo ./install.sh
# Install to: /opt/apicurio-axiom-2
# Service: manually rename to axiom-2
sudo mv /etc/systemd/system/apicurio-axiom.service /etc/systemd/system/axiom-2.service
sudo systemctl daemon-reload
```

### Air-Gapped Installation

For environments without internet access:

```bash
# On internet-connected machine:
# 1. Pull image
docker pull apicurio/apicurio-axiom:latest

# 2. Save to tar
docker save -o axiom.tar apicurio/apicurio-axiom:latest

# 3. Transfer axiom.tar to air-gapped server

# On air-gapped server:
# 4. Load image
docker load -i axiom.tar

# 5. Run installer
sudo ./install.sh
```

## Support

- **Documentation**: See `../../README.md`
- **Build Info**: See `../build/README.md`
- **Issues**: https://github.com/Apicurio/apicurio-axiom/issues

---

**For building images**: See `../build/` for developer documentation
