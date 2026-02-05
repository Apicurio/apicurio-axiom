#!/bin/bash
set -e

echo "================================================"
echo "   Starting GitHub Event Bot..."
echo "================================================"
echo ""

# Parse command line arguments
ARGS=""
LIST_TOOLS=""
for arg in "$@"; do
    if [ "$arg" = "--dryRun" ]; then
        ARGS="$ARGS --dryRun"
        echo "⚠️  DRY RUN MODE ENABLED"
        echo "   Actions will be logged but not executed"
        echo ""
    elif [ "$arg" = "--listTools" ]; then
        ARGS="$ARGS --listTools"
        LIST_TOOLS="true"
        echo "📋 LIST TOOLS MODE"
        echo "   Displaying available AI Agent tools"
        echo ""
    fi
done

echo "Checking lint rules..."
npm run lint

echo "Building TypeScript..."
npm run build

# Start the bot
node dist/index.js $ARGS
