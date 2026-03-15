#!/bin/bash

# Destroy script for Readafull infrastructure
# Usage: ./destroy.sh [environment]
# Example: ./destroy.sh development

set -e

# Get environment argument or default to development
ENVIRONMENT=${1:-development}

echo "========================================"
echo "Destroying Readafull Infrastructure"
echo "Environment: $ENVIRONMENT"
echo "========================================"

# Warning message
echo ""
echo "WARNING: This will destroy all resources in the $ENVIRONMENT environment!"
echo "This action cannot be undone."
echo ""

# Ask for confirmation
read -p "Are you absolutely sure you want to continue? Type 'destroy-$ENVIRONMENT' to confirm: " CONFIRM

if [ "$CONFIRM" != "destroy-$ENVIRONMENT" ]; then
    echo "Destruction cancelled."
    exit 0
fi

# Destroy all stacks
echo ""
echo "Destroying all stacks..."
npm run cdk:destroy -- --all --context environment=$ENVIRONMENT --force

echo ""
echo "========================================"
echo "Destruction completed!"
echo "========================================"
