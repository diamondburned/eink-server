# Project Guidelines

## E-ink Display Styling

**KEEP ALL STYLING BLACK AND WHITE/GREYSCALE** - This is for e-ink displays.

- Use grayscale colors only
- Optimize for high contrast and readability
- Consider e-ink refresh characteristics

## Server-Side Rendering

All data must be loaded server-side with no client-side timers or reactive updates (except one-time
scroll on page load).

- The dashboard should be completely static after initial render
- Data fetching happens in `+page.server.ts` files
- No client-side polling or intervals

## Svelte 5 Patterns

Use Svelte 5 runes for reactive state:

- `$derived` for computed values
- `$props()` for component props
- Follow modern Svelte 5 patterns throughout

## CSS Styling

**Use modern CSS nesting** (not SCSS):

```css
.detail {
  .label {
    /* nested selector */
  }
}
```

- All font sizes must use `em` units (not `rem`)
- Follow existing patterns in the codebase for consistency

## Icons

Weather icons are imported from `@mdi/js` and used with the `<svg-icon>` web component:

```svelte
<svg-icon path={mdiWeatherCloudy} />
```

## General Principles

- Follow existing patterns in the codebase for API calls and UI components
- Maintain consistency with established code style
- Keep components simple and focused
