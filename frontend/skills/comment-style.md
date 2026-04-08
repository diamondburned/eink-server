# Comment Style Guidelines

## No JSDoc

**NEVER use JSDoc comments** in this codebase.

- Do not use `/** */` style comments
- Do not use JSDoc tags like `@param`, `@returns`, etc.
- TypeScript types provide all the documentation needed

## Preferred Comment Style

**Always prefer `//` single-line comments** whenever possible:

- Use `//` for TypeScript/JavaScript code
- Use `/* */` only for CSS (where `//` is not valid)
- Multi-line comments should use multiple `//` lines, not `/* */`

## Examples

### ❌ Bad (JSDoc)

```typescript
/**
 * Formats a time string with optional minute display.
 *
 * @param isoString - ISO date string to format
 * @param options - Formatting options
 * @returns Formatted time string
 */
export function formatTime(isoString: string, options: FormatTimeOptions): string {
  // ...
}
```

### ❌ Bad (block comments in TypeScript)

```typescript
/*
 * This is a multi-line comment
 * that should use // instead
 */
function doSomething() {
  // ...
}
```

### ✅ Good (single-line comments)

```typescript
// Formats a time string with optional minute display.
// Returns formatted time string (may contain HTML for quarterly styling).
export function formatTime(isoString: string, options: FormatTimeOptions): string {
  // Round to nearest 15 minutes
  const minutes = date.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;

  // ...
}
```

### ✅ Good (CSS)

```css
.element {
  /* This is fine in CSS where // doesn't work */
  color: #000;
}
```

## Rationale

- TypeScript's type system provides better documentation than JSDoc
- Single-line comments are simpler and more consistent
- Function signatures with proper types are self-documenting
- Reduces visual noise and makes code easier to scan
