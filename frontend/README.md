# eink-server frontend

A SvelteKit frontend powered by Vite, with Hono for API routes.

## Frameworks and Tools

- **SvelteKit** - Web framework
- **Vite** - Build tool
- **Hono** - Lightweight web framework for API routes
- **pnpm** - Package manager

## Development

This project uses a Nix flake for development dependencies. We recommend using
[direnv](https://direnv.net/) for automatic environment loading:

```bash
# Allow direnv for this project
direnv allow

# Dependencies will be installed automatically
# Start the dev server
pnpm dev
```

### Without direnv

```bash
# Enter the Nix development shell
nix develop

# Dependencies will be installed automatically
# Start the dev server
pnpm dev
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm check` - Run Svelte type checking
- `pnpm format` - Format code with Prettier
- `pnpm lint` - Check code formatting
