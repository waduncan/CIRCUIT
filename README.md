# CIRCUIT

## Clinical Interface Routing, Connectivity, and Unified Integration Tool

## Why this was made 
Working in Healthcare IT, you end up making a lot of visio diagrams; usually those diagrams are complicated 
and large. CIRCUIT aims to speed up this process by creating an opinionated way to visualizing how healthcare IT systems
connect and trasmit data while remaining verbose and detailed. 

CIRCUIT is a completely local, client-side React application built with Vite and Tailwind
CSS. Projects are saved in the browser's local storage and can be imported or
exported as JSON files.

## Prerequisites

- Windows 10 or newer
- Node.js `>=22.13.0`
- npm (included with Node.js)

## Run locally

Open PowerShell or Command Prompt in this folder, then run:

```powershell
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

## Production build

```powershell
npm run build
npm run start
```

`npm run build` creates a static production build in `dist`. `npm run start`
previews that build locally. Neither command deploys or uploads anything.

## Useful commands

- `npm run dev`: start the local Vite development server
- `npm run build`: type-check and create the static production build
- `npm run start`: preview the production build locally
- `npm test`: build and verify the generated SPA shell


The application has no Next.js, Vinext, authentication, database, cloud,
hosting, or server-rendering dependency. A future API can be added separately
and called from the browser with `fetch` without changing the Vite SPA model.
