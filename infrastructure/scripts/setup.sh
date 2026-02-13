#!/bin/bash

# Setup script for Readafull infrastructure development
# This script sets up the development environment for AWS CDK

set -e

echo "========================================"
echo "Setting up Readafull Infrastructure"
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18 or later."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js version must be 18 or later. Current version: $(node -v)"
    exit 1
fi

echo "✓ Node.js version: $(node -v)"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install AWS CLI."
    exit 1
fi

echo "✓ AWS CLI version: $(aws --version)"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "Error: AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-east-1")

echo "✓ AWS Account: $ACCOUNT_ID"
echo "✓ AWS Region: $REGION"

# Install npm dependencies
echo ""
echo "Installing npm dependencies..."
npm install

echo "✓ Dependencies installed"

# Build TypeScript
echo ""
echo "Building TypeScript..."
npm run build

echo "✓ TypeScript compiled"

# Bootstrap CDK (if not already bootstrapped)
echo ""
echo "Checking CDK bootstrap status..."

if aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION > /dev/null 2>&1; then
    echo "✓ CDK already bootstrapped in $REGION"
else
    echo "Bootstrapping CDK in $REGION..."
    npx cdk bootstrap aws://$ACCOUNT_ID/$REGION
    echo "✓ CDK bootstrapped"
fi

echo ""
echo "========================================"
echo "Setup completed successfully!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Deploy infrastructure: npm run cdk:deploy:dev"
echo "2. View infrastructure changes: npm run cdk:diff"
echo "3. Destroy infrastructure: npm run cdk:destroy"
