# eink-server

A SvelteKit + Deno application with a dinosaur database.

## Setup

This project uses Nix flakes for dependency management. To enter the development environment:

```bash
nix develop
```

## Development

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
deno install
```

3. Run the development server:
```bash
deno task dev
```

4. Open your browser to `http://localhost:5173`

## Project Structure

- `frontend/` - SvelteKit application
  - `src/routes/` - SvelteKit file-based routes
    - `+page.svelte` - Home page listing all dinosaurs
    - `[dinosaur]/+page.svelte` - Individual dinosaur detail page
    - `api/dinosaurs/+server.ts` - API endpoint for all dinosaurs
    - `api/dinosaurs/[id]/+server.ts` - API endpoint for individual dinosaur
  - `deno.json` - Deno configuration with tasks and imports

## Features

- 🦕 Browse a list of dinosaurs
- 📖 View detailed information about each dinosaur
- 🎨 Clean, modern UI with SvelteKit
- ⚡ Fast development with Deno and Vite
- 🔧 Nix flakes for reproducible development environment

## Stack

- [SvelteKit](https://kit.svelte.dev/) - Full-stack web framework
- [Deno](https://deno.com/) - JavaScript/TypeScript runtime
- [Nix](https://nixos.org/) - Package manager and development environment
