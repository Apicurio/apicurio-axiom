#!/bin/bash
#
# Apicurio Axiom - Interactive Installer
#
# This script installs and configures Apicurio Axiom using a pre-built Docker image.
# It creates the necessary directory structure, generates configuration files,
# sets up systemd integration, and starts the service.
#
# Usage:
#   sudo ./install.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
}

prompt() {
    echo -e "${CYAN}[?]${NC} $1"
}

# Banner
clear
echo -e "${CYAN}"
cat << 'EOF'
╔═════════════════════════════════════════════════════╗
║                                                     ║
║             Apicurio Axiom Installer                ║
║            GitHub Automation Platform               ║
║                                                     ║
╚═════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo ""

# Check for root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first:"
    echo "  https://docs.docker.com/engine/install/"
    exit 1
fi

success "Docker is installed"
echo ""

# ============================================================
# Configuration
# ============================================================

info "Starting interactive configuration..."
echo ""

# Installation directory
prompt "Installation directory [/opt/apicurio-axiom]: "
read -r INSTALL_DIR
INSTALL_DIR="${INSTALL_DIR:-/opt/apicurio-axiom}"

# Docker image
prompt "Docker image name [apicurio/apicurio-axiom:latest]: "
read -r DOCKER_IMAGE
DOCKER_IMAGE="${DOCKER_IMAGE:-apicurio/apicurio-axiom:latest}"

# GitHub token
prompt "GitHub Personal Access Token: "
read -rs GITHUB_TOKEN
echo ""

# Vertex AI project (optional)
prompt "Google Cloud Vertex AI Project ID (optional, press Enter to skip): "
read -r VERTEX_PROJECT_ID

echo ""
info "Configuration summary:"
echo "  Install directory: ${INSTALL_DIR}"
echo "  Docker image: ${DOCKER_IMAGE}"
echo "  GitHub token: ${GITHUB_TOKEN:0:5}..."
echo "  Vertex AI project: ${VERTEX_PROJECT_ID:-<not set>}"
echo ""

prompt "Proceed with installation? (y/N): "
read -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    warn "Installation cancelled"
    exit 0
fi

echo ""

# ============================================================
# Pull Docker image
# ============================================================

info "Pulling Docker image: ${DOCKER_IMAGE}..."
if docker pull "${DOCKER_IMAGE}"; then
    success "Image pulled successfully"
else
    error "Failed to pull image. Check the image name and network connectivity."
    exit 1
fi

echo ""

# ============================================================
# Create directory structure
# ============================================================

info "Creating directory structure at ${INSTALL_DIR}..."

mkdir -p "${INSTALL_DIR}"/{data/{state,logs,events,work},gcloud,prompts,actions}

success "Directories created"
echo ""

DATA_DIR="${INSTALL_DIR}/data"

# ============================================================
# Create environment file
# ============================================================

info "Creating environment file..."

cat > "${INSTALL_DIR}/.env" <<EOF
# Apicurio Axiom Environment Variables

# GitHub Configuration
GITHUB_TOKEN=${GITHUB_TOKEN}

# Google Cloud Vertex AI (optional)
ANTHROPIC_VERTEX_PROJECT_ID=${VERTEX_PROJECT_ID}

# Logging
LOG_LEVEL=info

# Data directory
DATA_DIR="${DATA_DIR}"

# App directory
APP_DIR="${INSTALL_DIR}"

# Node.js Configuration
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=3072
EOF

chmod 600 "${INSTALL_DIR}/.env"

success "Environment file created"
echo ""

# ============================================================
# Create configuration file
# ============================================================

info "Creating application configuration..."

# Check if template exists
if [ -f "config.template.yaml" ]; then
    cp config.template.yaml "${INSTALL_DIR}/config.yaml"
    success "Configuration file created from template"
else
    warn "Could not install application config: config.template.yaml not found"
    exit 0
fi

echo ""

# ============================================================
# Google Cloud credentials (optional)
# ============================================================

if [ -n "${VERTEX_PROJECT_ID}" ]; then
    info "Setting up Google Cloud credentials..."

    # Check if user has gcloud config in their home directory
    if [ -d "$HOME/.config/gcloud" ]; then
        prompt "Copy gcloud config from $HOME/.config/gcloud? (Y/n): "
        read -n 1 -r
        echo ""

        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            info "Copying gcloud configuration..."
            cp -r "$HOME/.config/gcloud/"* "${INSTALL_DIR}/gcloud/"
            success "Google Cloud credentials configured from $HOME/.config/gcloud"
        else
            warn "Skipped copying gcloud config. You can:"
            echo "  1. Copy manually: cp -r ~/.config/gcloud/* ${INSTALL_DIR}/gcloud/"
            echo "  2. Provide credentials.json: cp credentials.json ${INSTALL_DIR}/gcloud/"
        fi
    else
      warn "Could not configure Google Cloud credentials, $HOME/.config/gcloud not found."
    fi

    echo ""
fi

# ============================================================
# Set permissions
# ============================================================

info "Setting file permissions..."

chown -R 1001:1001 "${INSTALL_DIR}/data"
chown -R 1001:1001 "${INSTALL_DIR}/gcloud"
chmod -R 700 "${INSTALL_DIR}/data"/{state,logs,events,work}
chmod -R 664 "${INSTALL_DIR}"/{prompts,actions}

success "Permissions set"
echo ""

# ============================================================
# Create systemd service
# ============================================================

info "Setting up systemd service..."

# Create service file from template
SERVICE_FILE="/etc/systemd/system/apicurio-axiom.service"

if [ -f "systemd/apicurio-axiom.service" ]; then
    sed -e "s|INSTALL_DIR|${INSTALL_DIR}|g" \
        -e "s|IMAGE_NAME|${DOCKER_IMAGE}|g" \
        systemd/apicurio-axiom.service > "${SERVICE_FILE}"
else
    warn "Could not install apicurio-axiom.service in systemd (missing install file)."
    exit 0
fi

systemctl daemon-reload

success "Systemd service created"
echo ""

# ============================================================
# Start service
# ============================================================

prompt "Start Apicurio Axiom now? (Y/n): "
read -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    info "Starting service..."
    systemctl enable apicurio-axiom
    systemctl start apicurio-axiom

    sleep 3

    if systemctl is-active --quiet apicurio-axiom; then
        success "Apicurio Axiom is running!"
    else
        warn "Service started but may have issues. Check logs:"
        echo "  sudo journalctl -u apicurio-axiom -f"
    fi
else
    info "Service not started. Start later with:"
    echo "  sudo systemctl start apicurio-axiom"
fi

echo ""

# ============================================================
# Installation complete
# ============================================================

echo -e "${GREEN}"
cat << 'EOF'
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              INSTALLATION COMPLETE! ✓                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo ""

info "Installation summary:"
echo "  Installation directory: ${INSTALL_DIR}"
echo "  Docker image: ${DOCKER_IMAGE}"
echo "  Systemd service: apicurio-axiom.service"
echo ""

info "Useful commands:"
echo "  sudo systemctl status apicurio-axiom       # Check service status"
echo "  sudo systemctl stop apicurio-axiom         # Stop service"
echo "  sudo systemctl start apicurio-axiom        # Start service"
echo "  sudo systemctl restart apicurio-axiom      # Restart service"
echo "  sudo journalctl -u apicurio-axiom -f       # View logs (live)"
echo "  sudo journalctl -u apicurio-axiom -n 100   # View last 100 log lines"
echo ""

info "Configuration files:"
echo "  ${INSTALL_DIR}/.env           # Environment variables"
echo "  ${INSTALL_DIR}/config.yaml    # Application configuration"
echo "  ${INSTALL_DIR}/prompts/       # AI agent prompts"
echo "  ${INSTALL_DIR}/actions/       # Custom actions"
echo ""

info "Next steps:"
echo "  1. Edit ${INSTALL_DIR}/config.yaml to configure repositories and actions"
echo "  2. Add prompts to ${INSTALL_DIR}/prompts/ (optional)"
echo "  3. Add custom actions to ${INSTALL_DIR}/actions/ (optional)"
echo "  4. Restart service: sudo systemctl restart apicurio-axiom"
echo ""

exit 0
