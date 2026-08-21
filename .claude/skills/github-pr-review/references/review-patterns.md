# Code Review Patterns

Reference guide for common code review patterns, language-specific considerations, and detailed checklists.

## How to Use This Document (Reduce Noise)

- Start with **Security**, **Performance**, **Error Handling**, and **Code Quality** sections.
- Then apply **only** the language/framework sections relevant to the files changed in the PR.

## Project Rules Overlay (Required)

If the repo contains its own rules/checklists (e.g. `packages/docs/rules/`, `.cursor/rules/*.mdc`, or a repo-local `review-patterns.md`), treat those as **required**.

When you find project rules:
- Convert each rule into a **concrete, checkable review item** (“Is X done?”).
- In review feedback, explicitly reference the violated rule and point to the exact file/line.

## Language-Specific Patterns

### JavaScript/TypeScript

#### React/Component Patterns

**Memory Leaks:**
- Event listeners in useEffect without cleanup
- Intervals/timeouts without clear
- Subscriptions (RxJS, WebSocket) without unsubscribe
- DOM references in refs not cleared

**Common Issues:**
```typescript
// ❌ Bad: Missing cleanup
useEffect(() => {
  const interval = setInterval(() => {
    // ...
  }, 1000);
}, []);

// ✅ Good: Proper cleanup
useEffect(() => {
  const interval = setInterval(() => {
    // ...
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

**State Management:**
- Unnecessary re-renders
- State updates based on previous state without functional updates
- Missing dependency arrays
- Stale closures

**Type Safety:**
- Missing type annotations
- Using `any` type
- Missing null/undefined checks
- Unsafe type assertions

#### Node.js Patterns

**Error Handling:**
- Unhandled promise rejections
- Missing try-catch in async functions
- Silent error swallowing
- Missing error logging

**Resource Management:**
- File handles not closed
- Database connections not released
- Streams not properly closed

### Python

**Common Issues:**
- Missing exception handling
- Resource leaks (file handles, database connections)
- Type hints missing
- Mutable default arguments
- Missing docstrings for public APIs

**Example:**
```python
# ❌ Bad: Mutable default argument
def process_items(items=[]):
    items.append("new")
    return items

# ✅ Good: Immutable default
def process_items(items=None):
    if items is None:
        items = []
    items.append("new")
    return items
```

### Go

**Common Issues:**
- Goroutine leaks
- Channel not closed
- Context not canceled
- Error not checked
- Missing error handling

**Example:**
```go
// ❌ Bad: Goroutine leak
go func() {
    for {
        // ...
    }
}()

// ✅ Good: Context cancellation
go func() {
    ctx, cancel := context.WithCancel(parentCtx)
    defer cancel()
    for {
        select {
        case <-ctx.Done():
            return
        default:
            // ...
        }
    }
}()
```

## Security Review Checklist

### Authentication & Authorization
- [ ] Credentials not hardcoded
- [ ] Proper authentication checks
- [ ] Authorization checks on all protected endpoints
- [ ] Session management secure
- [ ] Token expiration handled

### Input Validation
- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] Path traversal prevention
- [ ] CSRF protection

### Data Handling
- [ ] Sensitive data not logged
- [ ] PII handled according to regulations
- [ ] Encryption for data at rest/transit
- [ ] Secure password storage (hashing, not plaintext)

### Dependencies
- [ ] No known vulnerabilities in dependencies
- [ ] Dependencies kept up to date
- [ ] Only necessary dependencies included

## Performance Review Checklist

### Database
- [ ] Queries optimized (indexes used)
- [ ] N+1 query problems avoided
- [ ] Connection pooling configured
- [ ] Pagination for large datasets

### Caching
- [ ] Appropriate caching strategy
- [ ] Cache invalidation handled
- [ ] Cache keys properly scoped

### Resource Usage
- [ ] Memory leaks checked
- [ ] CPU-intensive operations optimized
- [ ] File I/O minimized
- [ ] Network requests batched when possible

### Frontend
- [ ] Unnecessary re-renders avoided
- [ ] Large bundles split
- [ ] Images optimized
- [ ] Lazy loading where appropriate

## Error Handling Patterns

### Good Error Handling

```typescript
// ✅ Good: Specific error handling with logging
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn('Validation failed', { error, context });
    throw new UserFacingError('Invalid input provided');
  } else if (error instanceof NetworkError) {
    logger.error('Network error', { error, context });
    throw new RetryableError('Service temporarily unavailable');
  } else {
    logger.error('Unexpected error', { error, context });
    throw new InternalError('An unexpected error occurred');
  }
}
```

### Anti-Patterns to Flag

```typescript
// ❌ Bad: Silent failure
try {
  await riskyOperation();
} catch (error) {
  // Empty catch block
}

// ❌ Bad: Generic error handling
try {
  await riskyOperation();
} catch (error) {
  console.log('Error');
}

// ❌ Bad: Swallowing errors
try {
  await riskyOperation();
} catch (error) {
  return null; // Hides the error
}
```

## Code Quality Patterns

### Complexity

**Cyclomatic Complexity:**
- Flag functions with complexity > 10
- Suggest breaking into smaller functions
- Extract complex conditionals into named functions

**Example:**
```typescript
// ❌ Bad: High complexity
function processOrder(order) {
  if (order.status === 'pending' && order.payment && order.payment.status === 'completed' && order.items.length > 0 && order.shippingAddress) {
    // ... complex logic
  }
}

// ✅ Good: Extracted conditions
function canProcessOrder(order) {
  return order.status === 'pending' 
    && hasValidPayment(order)
    && hasItems(order)
    && hasShippingAddress(order);
}
```

### Duplication

- Flag repeated code blocks (> 3 lines)
- Suggest extracting to shared functions
- Consider if duplication is intentional (YAGNI vs DRY)

### Naming

- Flag unclear variable/function names
- Suggest more descriptive names
- Check for abbreviations that aren't standard
- Boolean names should read like English (`isX`, `hasY`, `canZ`)
- Event handlers should start with `handle...` (e.g. `handleSubmit`)
- Types/interfaces should not use `I`/`T` prefixes (use descriptive names instead)
- Enums: PascalCase enum name, UPPER_SNAKE_CASE values
- True constants: UPPER_SNAKE_CASE (e.g. `DEFAULT_TIMEOUT`)

## Comment Templates

### Critical Issue Template

```markdown
**🚨 Critical: [Issue Type]**

[Brief description of the critical issue]

**Current code:**
```[language]
[problematic code]
```

**Problem:** [Explain why this is critical]

**Recommended fix:**
```[language]
[fixed code]
```

**Impact:** [Explain the consequences - security risk, data loss, crash, etc.]
```

### Major Issue Template

```markdown
**⚠️ Major: [Issue Type]**

[Brief description]

**Current code:**
```[language]
[problematic code]
```

**Issue:** [Explain the problem]

**Recommended fix:**
```[language]
[fixed code]
```

**Impact:** [Explain impact on maintainability, performance, or reliability]
```

### Suggestion Template

```markdown
**💡 Suggestion: [Improvement Type]**

[Brief description of improvement opportunity]

**Current code:**
```[language]
[current code]
```

**Consider:**
```[language]
[improved code]
```

**Benefit:** [Explain why this improvement helps]
```

## Framework-Specific Considerations

### React
- Hook dependencies
- Component re-render optimization
- Context usage (avoid unnecessary providers)
- Memoization opportunities

### Express.js
- Middleware ordering
- Error handling middleware
- Route parameter validation
- Response headers

### Django
- Query optimization
- Middleware ordering
- Model field choices
- Signal handlers

### Spring Boot
- Bean scope
- Transaction boundaries
- Exception handling
- Configuration properties
