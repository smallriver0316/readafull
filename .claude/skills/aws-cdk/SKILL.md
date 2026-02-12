---
name: aws-cdk
description: Build AWS infrastructure using AWS CDK (Cloud Development Kit) with TypeScript. Use when implementing AWS infrastructure as code, creating CDK stacks, working with CDK constructs, applying CDK Nag security rules, or using AWS Solutions Constructs. Triggers include "create CDK stack", "CDK infrastructure", "AWS constructs", "CDK Nag", or requests to build AWS resources with CDK. ALWAYS use TypeScript for CDK code.
---

# AWS CDK Infrastructure Development

## Overview

This skill provides guidance for building AWS infrastructure using AWS CDK with access to:
- CDK general guidance and best practices
- AWS Solutions Constructs patterns
- CDK Nag security validation
- GenAI CDK constructs
- AWS documentation resources

**IMPORTANT: Always use TypeScript for CDK infrastructure code.** TypeScript provides the best type safety, IDE support, and has the largest CDK community and examples.

## When to Use AWS CDK

Use AWS CDK when:
- Building type-safe infrastructure with familiar programming languages
- Needing reusable infrastructure components and patterns
- Requiring complex logic or conditionals in infrastructure code
- Working on applications where infrastructure is tightly coupled with application code
- Team has strong software development background

Consider alternatives (CloudFormation, Terraform) when:
- Team prefers declarative configuration over imperative code
- Multi-cloud deployment is required (use Terraform)
- Simple static infrastructure without complex logic

## CDK Development Workflow

### 1. Getting Started

For CDK basics and getting started guidance, use:
```
mcp__aws-cdk__CDKGeneralGuidance
```

This provides prescriptive advice for CDK architecture and patterns.

### 2. Choose the Right Construct Level

**L1 Constructs (CFN Resources)**
- Direct CloudFormation resources (e.g., `CfnBucket`)
- Use when: Need fine-grained control or new service features not yet in L2

**L2 Constructs (Curated Resources)**
- Intent-based APIs with sensible defaults (e.g., `Bucket`)
- Use when: Building standard AWS resources with best practices
- **Prefer L2 over L1** when available

**L3 Constructs (Patterns)**
- Multi-resource patterns for common use cases
- Use AWS Solutions Constructs when available

### 3. Leverage AWS Solutions Constructs

Before building custom patterns, check if a Solutions Construct exists:
```
mcp__aws-cdk__GetAwsSolutionsConstructPattern
```

**Search by pattern name:**
- `pattern_name: "aws-lambda-dynamodb"`

**Search by services:**
- `services: ["lambda", "dynamodb"]`

Benefits:
- Vetted architecture patterns following Well-Architected Framework
- Built-in security, reliability, and performance best practices
- Reduced boilerplate code

### 4. Apply Security Best Practices with CDK Nag

**Always integrate CDK Nag** for production applications:

```typescript
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();
const stack = new MyStack(app, 'MyStack');

// Apply CDK Nag validation
AwsSolutionsChecks.check(app);
```

**Understanding CDK Nag rules:**
```
mcp__aws-cdk__ExplainCDKNagRule
```
- Pass `rule_id` (e.g., "AwsSolutions-IAM4") to get detailed explanation and remediation

**Important**: When CDK Nag flags issues, fix the underlying security problem rather than suppressing the rule. Only suppress when there's a valid architectural reason, and always document the justification.

### 5. Use GenAI CDK Constructs

For Bedrock and GenAI workloads, search specialized constructs:
```
mcp__aws-cdk__SearchGenAICDKConstructs
```

**Search examples:**
- `query: "bedrock agent", construct_type: "bedrock"`
- `query: "knowledgebase vector"`
- `query: "opensearch vector"`

## AWS Documentation Integration

### Search for CDK Documentation

Use aws-documentation MCP for comprehensive CDK information:

```
mcp__aws-documentation__search_documentation
```

**Topic selection:**
- `topics: ["cdk_docs"]` - CDK concepts, API references, CLI commands
- `topics: ["cdk_constructs"]` - CDK code examples and patterns
- `topics: ["reference_documentation"]` - API/SDK references
- `topics: ["current_awareness"]` - New CDK features and releases

**Always include "TypeScript"** in search queries:
- "CDK Lambda function TypeScript"
- "CDK DynamoDB table TypeScript"
- "CDK API Gateway TypeScript"

### Read CDK Documentation

For specific documentation pages:
```
mcp__aws-documentation__read_documentation
```

### Discover Related Content

Find related CDK documentation:
```
mcp__aws-documentation__recommend
```

## Common Patterns and Best Practices

See [references/patterns.md](references/patterns.md) for detailed CDK patterns and examples.

See [references/best-practices.md](references/best-practices.md) for CDK development best practices.

## Project Structure

Organize CDK projects following these conventions:

```
my-cdk-app/
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   ├── stacks/             # Stack definitions
│   │   ├── network-stack.ts
│   │   └── compute-stack.ts
│   └── constructs/         # Reusable constructs
│       └── my-construct.ts
├── test/                   # Unit and integration tests
├── cdk.json               # CDK configuration
└── package.json
```

## Common Commands

```bash
# Initialize new CDK project
cdk init app --language typescript

# List all stacks
cdk list

# Synthesize CloudFormation template
cdk synth

# Show differences from deployed stack
cdk diff

# Deploy stack
cdk deploy

# Deploy with approval for security changes
cdk deploy --require-approval broadening

# Destroy stack
cdk destroy
```

## TypeScript Requirements

**All CDK code must be written in TypeScript.**

Benefits of TypeScript for CDK:
- **Best IDE support** - IntelliSense, autocomplete, and inline documentation
- **Type safety** - Catch errors at compile time, not runtime
- **Largest community** - Most examples, patterns, and Stack Overflow answers
- **Fastest feature adoption** - New CDK features released first for TypeScript
- **Better refactoring** - Rename, move, and restructure with confidence

TypeScript configuration best practices:
- Enable strict mode in `tsconfig.json`
- Use explicit return types for public methods
- Leverage type inference for local variables
- Use interfaces for props and configuration objects

## Tool Selection Guide

| Task | Use This Tool |
|------|---------------|
| General CDK guidance | `mcp__aws-cdk__CDKGeneralGuidance` |
| Find architecture patterns | `mcp__aws-cdk__GetAwsSolutionsConstructPattern` |
| Understand CDK Nag rules | `mcp__aws-cdk__ExplainCDKNagRule` |
| GenAI/Bedrock constructs | `mcp__aws-cdk__SearchGenAICDKConstructs` |
| CDK documentation search | `mcp__aws-documentation__search_documentation` with `topics: ["cdk_docs", "cdk_constructs"]` |
| Read specific CDK docs | `mcp__aws-documentation__read_documentation` |
| Find related docs | `mcp__aws-documentation__recommend` |

## Testing Strategy

**Unit Tests**
- Test construct configuration and properties
- Use CDK assertions library

**Integration Tests**
- Deploy test stacks to AWS
- Validate actual resource behavior

**Snapshot Tests**
- Verify CloudFormation template changes
- Catch unintended infrastructure modifications

## Error Handling

When encountering CDK errors:

1. **Synthesis errors**: Check construct properties and TypeScript types
2. **Deployment errors**: Review CloudFormation error messages
3. **CDK Nag violations**: Use `ExplainCDKNagRule` to understand and fix
4. **Documentation needed**: Search with `search_documentation`

## Output Guidelines

**CRITICAL: All CDK code must be written in TypeScript.**

When generating CDK code:

1. **Use TypeScript** - All code examples and implementations must be in TypeScript
2. **Use L2 constructs** by default (not L1 CFN resources)
3. **Include imports** at the top of the file with explicit types
4. **Add type annotations** for props interfaces and method parameters
5. **Add comments** explaining architectural decisions
6. **Apply CDK Nag** for production code
7. **Use environment variables** for configuration (not hard-coded values)
8. **Follow naming conventions**: PascalCase for constructs/interfaces, kebab-case for resource IDs
9. **Include tags** for cost tracking and organization

Example structure:
```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface MyStackProps extends cdk.StackProps {
  environment: 'dev' | 'prod';
}

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MyStackProps) {
    super(scope, id, props);
    // Implementation...
  }
}
```
