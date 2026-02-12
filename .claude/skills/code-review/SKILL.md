---
name: code-review
description: Reviews code in this project following security, performance, readability, and testability guidelines. Use when user requests code review, PR review, or asks to check/review code changes. Responds in Japanese when prompted in Japanese, otherwise responds in English.
---

# Code Review

## Instructions

**Language**: Respond in Japanese if the user prompts in Japanese, otherwise respond in English.

Review code with the following perspectives in mind.

### 1. Security

Check for security risks:

- SQL injection, XSS, CSRF vulnerabilities
- Credential leaks and authentication/authorization issues
- Hard-coded secrets (API keys, passwords, tokens)
- AWS-specific security issues:
  - IAM role/policy misconfigurations
  - S3 bucket public access
  - Exposed environment variables
  - Insecure API Gateway configurations

### 2. Performance

Identify performance issues:

- N+1 query problems
- Unnecessary loops or redundant operations
- Memory leaks
- Inefficient data structures
- Unoptimized database queries
- Large bundle sizes in frontend code
- Excessive API calls

### 3. Readability

Verify code readability:

- Clear, descriptive variable and function names
- Simple logic broken down into smaller functions
- Comments explaining "why", not "what"
- Named constants instead of magic numbers
- Consistent code formatting
- Appropriate abstractions

### 4. Testability

Assess testability:

- Test coverage for edge cases and error scenarios
- Dependency injection for easier mocking
- Loose coupling to external services
- Functions with single responsibility
- Explicit and testable side effects

### 5. Error Handling & Logging

Evaluate error handling:

- Proper error handling for all failure scenarios
- Meaningful error messages
- Appropriate logging for debugging
- No sensitive information in logs
- Proper async error handling

### 6. Project-Specific Guidelines

Verify compliance with project guidelines:

- Patterns defined in [CLAUDE.md](../../../CLAUDE.md)
- Architecture described in [.kiro/steering/structure.md](../../../.kiro/steering/structure.md)
- Technology stack usage (AWS, React Native, TypeScript)
- Git Workflow (branch naming, commit messages)
- Project requirements in [.kiro/specs/readafull-mvp](../../../.kiro/specs/readafull-mvp)

## Output Format

Structure the review as follows:

**Critical Issues** (if any)
- Security vulnerabilities or breaking bugs that must be fixed before merging

**Good Points**
- Highlight well-written code and good practices

**Needs Improvement**
- Points that should be improved for better quality
- Include specific suggestions for how to improve

**Questions**
- Items that need clarification or confirmation
- Architecture decisions that may need discussion

### Example Output

**Good Points**
- Clear error handling with specific error types
- Well-structured component separation

**Needs Improvement**
- Line 45: API key should be moved to environment variables instead of being hard-coded
- Lines 78-92: Consider extracting this logic into a separate utility function for better testability

**Questions**
- Should this API call include retry logic for network failures?