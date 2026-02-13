#!/bin/bash

# Deployment script for Readafull infrastructure
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh development

set -e

# Get environment argument or default to development
ENVIRONMENT=${1:-development}

echo "========================================"
echo "Deploying Readafull Infrastructure"
echo "Environment: $ENVIRONMENT"
echo "========================================"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "Error: AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if CDK is bootstrapped
echo ""
echo "Checking CDK bootstrap status..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-east-1")

echo "Account: $ACCOUNT_ID"
echo "Region: $REGION"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "Installing dependencies..."
    npm install
fi

# Build TypeScript
echo ""
echo "Building TypeScript..."
npm run build

# Synthesize CloudFormation templates
echo ""
echo "Synthesizing CloudFormation templates..."
npm run cdk:synth -- --context environment=$ENVIRONMENT

# Show diff
echo ""
echo "Showing infrastructure changes..."
npm run cdk:diff -- --context environment=$ENVIRONMENT || true

# Ask for confirmation
echo ""
read -p "Do you want to proceed with deployment? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Deploy all stacks
echo ""
echo "Deploying all stacks..."
npm run cdk:deploy -- --all --context environment=$ENVIRONMENT --require-approval never

echo ""
echo "========================================"
echo "Deployment completed successfully!"
echo "========================================"
