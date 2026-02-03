---
name: code-review
description: Reviews code in this project following security, performance, readability, and testability guidelines. Responds in Japanese when prompted in Japanese.
---

## Perspectives for review

Follow these perspectives in review.

### 1. Security

Prevent security risks such as:

- SQL injection, XSS, CSRF
- Credential leaks and authentication/authorization issues
- Hard-coding of secrets (API keys, passwords, tokens)
- AWS-specific security issues:
  - IAM role/policy misconfigurations
  - S3 bucket public access
  - Exposed environment variables
  - Insecure API Gateway configurations

### 2. Performance

Avoid performance issues such as:

- N+1 query problems
- Unnecessary loops or redundant operations
- Memory leaks
- Inefficient data structures
- Unoptimized database queries
- Large bundle sizes in frontend code
- Excessive API calls

### 3. Readability

- Use clear, descriptive variable and function names
- Avoid overly complex logic; break down into smaller functions
- Add comments only when explaining "why", not "what"
- Avoid magic numbers; use named constants
- Follow consistent code formatting
- Use appropriate abstractions

### 4. Testability

- Keep test coverage for edge cases and error scenarios
- Design with dependency injection for easier mocking
- Avoid tight coupling to external services
- Ensure functions have single responsibility
- Make side effects explicit and testable

### 5. Error Handling & Logging

- Implement proper error handling for all failure scenarios
- Provide meaningful error messages
- Log appropriate information for debugging
- Avoid exposing sensitive information in logs
- Handle async errors properly

### 6. Project-Specific Guidelines

Check compliance with project guidelines:

- Follow patterns defined in [CLAUDE.md](../../../CLAUDE.md)
- Adhere to architecture described in [.kiro/steering/structure.md](../../../.kiro/steering/structure.md)
- Use technology stack appropriately (AWS, React Native, TypeScript)
- Follow Git Workflow (branch naming, commit messages)
- Ensure compatibility with project requirements in [.kiro/specs/readafull-mvp](../../../.kiro/specs/readafull-mvp)

## Output format

**Critical Issues** (if any)
- Security vulnerabilities or breaking bugs
- Must be fixed before merging

**Good Points**
- Highlight well-written code and good practices
- Use bullet points

**Needs Improvement**
- Points that should be improved for better quality
- Include specific suggestions for how to improve
- Use bullet points

**Questions**
- Items that need clarification or confirmation
- Architecture decisions that may need discussion