# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js learning repository structured as a **pnpm workspace monorepo**. It contains:

- `frontend/` - Vue 3 + Vite frontend application (package name: `worker-thread-frontend`)
- `worker-thread-demo/` - Node.js Express server demonstrating worker threads with Piscina (package name: `worker-thread-demo`)

## Common Commands

```bash
# Install all dependencies (from monorepo root)
pnpm install

# Run both frontend and backend concurrently
pnpm dev

# Run only the frontend (Vue 3 + Vite)
pnpm --filter worker-thread-frontend dev

# Run only the backend (Express + Piscina)
pnpm --filter worker-thread-demo dev

# Build the backend
pnpm --filter worker-thread-demo build

# Type-check the frontend
pnpm --filter worker-thread-frontend typecheck
```

## Architecture

- **Root**: pnpm workspace configuration in `pnpm-workspace.yaml` manages `apps/*` and `packages/*`
- **Frontend** (`frontend/`): Vue 3 SPA with Vite, serves the UI for exploring worker thread demos
- **Backend** (`worker-thread-demo/`): Express server that uses Piscina (worker thread pool) to offload CPU-intensive tasks
- The `frontend` communicates with `worker-thread-demo` via HTTP (CORS enabled on the backend)

## Notable Dependencies

- **Piscina**: Worker thread pool library for running CPU-intensive tasks in parallel
- **Vue 3 + Vite**: Frontend framework with fast HMR
- **tsx**: TypeScript execution runtime for development
