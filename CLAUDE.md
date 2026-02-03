# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Readafull is a cloud-native mobile application designed to improve English speaking skills for Japanese learners through AI-powered reading practice and pronunciation support.

The project details are written as documentation in [.kiro/specs/readafull-mvp](.kiro/specs/readafull-mvp) and [.kiro/steering](.kiro/steering).
Especially for product's overview, refer to [.kiro/steering/product.md](.kiro/steering/product.md).
For the technology stack, refer to [.kiro/steering/tech.md](.kiro/steering/tech.md).
Those are based on [.kiro/specs/readafull-mvp/requirements.md](.kiro/specs/readafull-mvp/requirements.md).

It is necessary to read these documents to understand this project before supporting the development.

## Architecture Overview

Refer to [.kiro/steering/structure.md](.kiro/steering/structure.md).

For the details of the product design, refer to [.kiro/specs/readafull-mvp/design_aws.md](.kiro/specs/readafull-mvp/design_aws.md).

## Development Notes

On the development process, we follow the steps written in [.kiro/specs/readafull-mvp/tasks.md](.kiro/specs/readafull-mvp/tasks.md).

## Working with Claude Code

When assisting with this project:

1. **Always read the relevant documentation first** - Use the Read tool to review the files mentioned above before making changes
2. **Use the Explore agent for codebase understanding** - When you need to understand the project structure or find specific implementations, use the Task tool with subagent_type=Explore
3. **Plan before implementing** - For non-trivial features, use EnterPlanMode to design the approach and get user approval
4. **Track your work** - Use TodoWrite to manage tasks and keep the user informed of progress
5. **Follow the existing patterns** - Review similar implementations in the codebase before adding new features
6. **Test your changes** - Run relevant tests after making modifications
7. **Keep commits focused** - When creating commits, ensure they are atomic and well-described
