# Workflow Rule

On the development process, we follow the steps written in [.kiro/specs/readafull-mvp/tasks.md](../../.kiro/specs/readafull-mvp/tasks.md).

## Git Workflow

This project follows a branch-based workflow:

1. **Create a feature branch** - For each task, create a new branch from `main`
   - Branch naming convention: `feature/task-description` or `fix/bug-description`
   - Example: `feature/add-pronunciation-api`, `fix/auth-redirect-issue`

2. **Develop on the feature branch** - Make all changes in the feature branch
   - Keep commits atomic and well-described
   - Test your changes thoroughly

3. **Create a Pull Request** - When the task is complete
   - Provide a clear description of changes
   - Include test results and verification steps
   - Reference related issues or tasks

4. **Review and Test** - Ensure quality before merging
   - Code review by team members
   - Run all relevant tests
   - Verify functionality in the target environment

5. **Merge to main** - After approval
   - Merge the PR into `main` branch
   - Delete the feature branch after successful merge

## Working with Claude Code

When assisting with this project:

1. **Always read the relevant documentation first** - Use the Read tool to review the files mentioned above before making changes
2. **Use the Explore agent for codebase understanding** - When you need to understand the project structure or find specific implementations, use the Task tool with subagent_type=Explore
3. **Plan before implementing** - For non-trivial features, use EnterPlanMode to design the approach and get user approval
4. **Create a feature branch** - Before starting work on a task, create a new branch from `main` using the naming convention described in Git Workflow
5. **Track your work** - Use TodoWrite to manage tasks and keep the user informed of progress
6. **Follow the existing patterns** - Review similar implementations in the codebase before adding new features
7. **Test your changes** - Run relevant tests after making modifications
8. **Keep commits focused** - When creating commits, ensure they are atomic and well-described
9. **Create a Pull Request** - When the task is complete, create a PR with a clear description and test results for review