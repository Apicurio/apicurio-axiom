#!/usr/bin/env bash
#
# Builds the Apicurio Axiom application with the React UI bundled in.
# The UI is compiled with Vite and packaged into the Quarkus JAR so that
# a single artifact serves both the API and the frontend.
#
# Prerequisites:
#   - Java 25+
#   - Maven 3.9+
#   - Node.js 22+ and npm (installed automatically by frontend-maven-plugin
#     if not present, but having them locally speeds up the build)
#
# Usage:
#   ./build-release.sh
#
# The resulting application can be started with:
#   java -jar app/target/quarkus-app/quarkus-run.jar
#

set -euo pipefail

echo "============================================"
echo "  Apicurio Axiom — Release Build (with UI)"
echo "============================================"
echo ""

# Check prerequisites
if ! command -v java &>/dev/null; then
    echo "ERROR: java not found on PATH"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+).*/\1/')
if [[ "$JAVA_VERSION" -lt 25 ]]; then
    echo "ERROR: Java 25+ required, found Java $JAVA_VERSION"
    exit 1
fi

if ! command -v mvn &>/dev/null; then
    echo "ERROR: mvn not found on PATH"
    exit 1
fi

echo "Java:   $(java -version 2>&1 | head -1)"
echo "Maven:  $(mvn --version 2>&1 | head -1)"
echo ""

mvn clean package -Pui,prod "$@"