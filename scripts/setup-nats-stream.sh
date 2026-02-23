#!/bin/bash
#
# Setup NATS JetStream stream for Axiom events
#
# This script creates the AXIOM_EVENTS stream with the proper configuration.
# It should be run after NATS server is up and running.

set -e

NATS_URL=${NATS_URL:-"nats://localhost:4222"}

echo "Connecting to NATS at $NATS_URL..."

# Check if nats CLI is installed
if ! command -v nats &> /dev/null; then
    echo "Error: nats CLI is not installed"
    echo "Install it with: go install github.com/nats-io/natscli/nats@latest"
    echo "Or download from: https://github.com/nats-io/natscli/releases"
    exit 1
fi

# Wait for NATS to be ready
echo "Waiting for NATS to be ready..."
until nats --server="$NATS_URL" account info &> /dev/null; do
    echo "Waiting for NATS..."
    sleep 2
done
echo "NATS is ready!"

# Create or update the AXIOM_EVENTS stream
echo "Creating/updating AXIOM_EVENTS stream..."

nats stream add AXIOM_EVENTS \
    --server="$NATS_URL" \
    --subjects="events.>" \
    --retention=workqueue \
    --max-age=7d \
    --max-msgs-per-subject=1000 \
    --storage=file \
    --replicas=1 \
    --discard=old \
    --max-msg-size=1MB \
    --defaults

echo "Stream created successfully!"

# Show stream info
echo ""
echo "Stream configuration:"
nats stream info AXIOM_EVENTS --server="$NATS_URL"

# Create durable consumer for event handler
echo ""
echo "Creating durable consumer for event handler..."

nats consumer add AXIOM_EVENTS axiom-event-handler \
    --server="$NATS_URL" \
    --filter="" \
    --ack=explicit \
    --pull \
    --deliver=all \
    --max-deliver=3 \
    --wait=5m \
    --defaults

echo "Consumer created successfully!"

# Show consumer info
echo ""
echo "Consumer configuration:"
nats consumer info AXIOM_EVENTS axiom-event-handler --server="$NATS_URL"

echo ""
echo "NATS setup complete!"
echo ""
echo "Subject naming pattern:"
echo "  events.{source}.{owner}.{repo}.{eventType}"
echo ""
echo "Examples:"
echo "  events.github.apicurio.apicurio-registry.issue.opened"
echo "  events.github.apicurio.apicurio-registry.pull_request.opened"
echo "  events.jira.APICURIO.PROJECT-123.issue.updated"
