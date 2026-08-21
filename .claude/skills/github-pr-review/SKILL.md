---
name: github-pr-review
description: Review GitHub pull requests for common issues and add professional line-by-line comments directly on code using GitHub MCP. Use when Claude needs to review a GitHub pull request and provide detailed, actionable feedback with inline comments on specific code lines. Focuses on critical bugs, security issues, error handling, type safety, memory leaks, and code quality improvements.
---

# GitHub PR Review

Review pull requests systematically and add professional line-by-line comments directly on code using GitHub MCP tools.

## Review Process

1. **Get PR details** - Use `mcp_github_get_pull_request(owner, repo, pull_number)` to retrieve the PR and understand the changes
2. **Get changed files** - Use `mcp_github_get_pull_request_files(owner, repo, pull_number)` to see all modified files
3. **Read file contents** - Use `mcp_github_get_file_contents(owner, repo, path, branch)` to read the actual code for each changed file
4. **Analyze code** - Review each file for issues following the guidelines below
5. **Add inline comments** - Use `mcp_github_create_pull_request_review` with `comments` array to add line-by-line comments

## Review Guidelines

### Project-Specific Checklist Overlay (Required)

- Always read `references/review-patterns.md` (bundled with this skill) first.
- If the repository has its own engineering rules/checklists, treat them as **required** and layer them on top of these generic patterns. Common places to look:
  - `packages/docs/rules/` or `docs/rules/`
  - `.claude/**/review-patterns.md` or `review-patterns.md`
  - `.cursor/rules/*.mdc`
- Apply only the sections relevant to the changed files (e.g., React patterns only when React code changed; backend patterns only when backend code changed).

### Comment Placement

- **Add comments directly on specific code lines** - Don't create summary comments, add inline comments on the actual code
- **Target specific lines** - Use `line` parameter in review comments to reference exact code locations
- **Be precise** - Each comment should reference a specific line or small code block
- **Never create general PR comments** - All feedback must be on specific code lines

### Professional Tone

- Use formal language and avoid casual terms
- Be constructive and educational
- Focus on the code, not the author
- Explain reasoning clearly

### Issue Prioritization

Focus on issues in this order:

1. **Critical issues** - Bugs, memory leaks, security vulnerabilities, data corruption risks
2. **Major issues** - Error handling gaps, type safety problems, performance issues
3. **Suggestions** - Code quality improvements, refactoring opportunities, best practices

### Common Issues to Check

#### Memory Leaks

- Event listener cleanup (memory leaks)
- Intervals/timeouts not cleared
- Subscriptions not unsubscribed
- DOM references not released
- Closures holding references

#### Error Handling

- Silent error handling (empty catch blocks)
- Missing error logging
- Unhandled promise rejections
- Missing validation

#### Type Safety

- Type safety issues
- Missing type annotations
- Unsafe type assertions
- Implicit any types
- Missing null checks

#### Race Conditions

- Async operations without proper sequencing
- Shared state mutations
- Missing locks/semaphores
- Concurrent access issues

#### Code Quality

- Code complexity that could be simplified
- Code duplication
- Inconsistent patterns
- Missing documentation
- Poor naming

### Comment Format

For each issue found, include:

1. **Clear title describing the issue** - Brief description (e.g., "Memory leak: Event listener not removed")
2. **Explanation of the problem** - What the issue is and why it matters
3. **Code example showing the issue** - Show the problematic code (if not obvious from context)
4. **Recommended fix with code example** - Provide concrete code example showing the solution
5. **Brief explanation of why the fix is important** - Explain the impact/risk

### Example Comment Structure

```markdown
**Memory leak: Event listener not removed**

This component adds an event listener in `useEffect` but never removes it. When the component unmounts, the listener remains attached, causing a memory leak.

**Current code:**
```typescript
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);
```

**Recommended fix:**
```typescript
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

**Impact:** Over time, this can cause memory leaks, especially if the component mounts/unmounts frequently. In production, this can lead to degraded performance and potential browser crashes.
```

## Using GitHub MCP Tools

### Getting PR Information

```python
# Get PR details
pr = mcp_github_get_pull_request(owner, repo, pull_number)

# Get changed files
files = mcp_github_get_pull_request_files(owner, repo, pull_number)

# Read file contents for review
file_content = mcp_github_get_file_contents(owner, repo, path, branch)
```

### Creating Review Comments

Use `mcp_github_create_pull_request_review` with structured comments:

```python
mcp_github_create_pull_request_review(
    owner=owner,
    repo=repo,
    pull_number=pull_number,
    body="Comprehensive code review with inline comments",
    event="COMMENT",  # or "REQUEST_CHANGES" for blocking issues
    comments=[
        {
            "path": "src/components/Button.tsx",
            "line": 42,
            "body": """**Memory leak: Event listener not removed**

This component adds an event listener in `useEffect` but never removes it. When the component unmounts, the listener remains attached, causing a memory leak.

**Current code:**
```typescript
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);
```

**Recommended fix:**
```typescript
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

**Impact:** Over time, this can cause memory leaks, especially if the component mounts/unmounts frequently. In production, this can lead to degraded performance and potential browser crashes."""
        }
    ]
)
```

### Review Event Types

- **COMMENT** - General feedback and suggestions (non-blocking)
- **REQUEST_CHANGES** - Use when critical or major issues are found that should block merge
- **APPROVE** - Use only when review is complete and no blocking issues remain

## Best Practices

1. **Review systematically** - Go through files in logical order
2. **Group related comments** - If multiple issues in same area, consider grouping
3. **Prioritize impact** - Focus on issues that affect functionality, security, or maintainability
4. **Be specific** - Vague comments like "this could be better" are not helpful
5. **Provide solutions** - Always suggest concrete fixes, not just problems
6. **Consider context** - Understand the PR's purpose before suggesting major refactors
7. **Use appropriate event type** - COMMENT for suggestions, REQUEST_CHANGES for blocking issues
8. **Reference specific lines** - Always use line numbers, never general comments

## Common Issue Patterns

See `references/review-patterns.md` for detailed patterns including:
- Language-specific review patterns (JavaScript/TypeScript, Python, Go)
- Framework-specific considerations (React, Node.js, etc.)
- Security review checklists
- Performance review guidelines
- Error handling patterns and anti-patterns
- Code quality patterns

## Example Workflow

```
[Reviewing PR #42 in owner/repo]

1. Get PR details:
   pr = mcp_github_get_pull_request("owner", "repo", 42)

2. Get changed files:
   files = mcp_github_get_pull_request_files("owner", "repo", 42)

3. Read and review each file:
   for file in files:
     content = mcp_github_get_file_contents("owner", "repo", file.path, pr.head.ref)
     # Analyze for issues following guidelines...

4. Create review with inline comments:
   mcp_github_create_pull_request_review(
     owner="owner",
     repo="repo",
     pull_number=42,
     body="Comprehensive code review with inline comments",
     event="COMMENT",
     comments=[
       {
         "path": "src/components/Button.tsx",
         "line": 42,
         "body": "[Formatted comment with title, explanation, code examples, and impact]"
       }
     ]
   )
```

## Red Flags

**Never:**
- Add general PR comments instead of inline line-by-line comments
- Create summary comments - all feedback must be on specific code lines
- Ignore Critical issues
- Proceed with unfixed Major issues
- Be vague or unhelpful in comments

**Always:**
- Add comments directly on specific code lines
- Provide concrete code examples for fixes
- Explain the impact/risk of issues
- Use professional, formal language
