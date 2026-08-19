# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is the owner of this machine: an SDE-2 / SDE-3 preparing locally (DSA, routines, notes) at a night desk. There is no hosted audience and no multi-tenant role.

## Product Purpose

Daily Routine is a local-first workspace that keeps today's study block, a DSA Zettelkasten, reports, and chat against those notes on this computer. Success is being able to see the current block, log it, open the right note, and get back to work without leaving the machine.

## Positioning

A personal operator desk: Postgres and markdown on localhost, LeetCode submissions into notes, Obsidian two-way sync, a graph of problems/patterns/wikilinks, and chat that reads those files. Neighboring hosted note apps cannot truthfully claim "runs only on your machine."

## Operating Context

Used as a web app (`npm run dev`, `http://127.0.0.1:8765`) or a macOS Electron window (`npm run app`) against the same local database. Typical session: Today briefing → log a block → open a problem/pattern note → search or graph → optional chat. Appearance (color, font, code theme) is user-switchable in Settings.

## Capabilities and Constraints

Confirmed surfaces: Today (`/`), Routine, Reports, Search, Chat, Graph, DSA list/note, Patterns list/note, free notes, Settings. Confirmed systems: LeetCode poll into notes, Apple Calendar push (`SDE Prep`), extra properties, trash snapshots (latest 10), Obsidian sync, local/API/OmniRoute chat with `@note` and `/folder`, fuzzy search, backlinks.

Technical constraints: Next.js app, Catppuccin-named CSS tokens (`--ctp-*`) consumed across chrome, semantic color roles must keep mapping so other themes still work. Do not invent hosted SaaS, accounts, or cloud claims.

Open: none material for this redesign besides the visual world, which new-work owns.

## Brand Commitments

Product name: Daily Routine (user-renameable in the sidebar). Voice: quiet, exact, operator copy — not marketing.

Binding for the upcoming default: the shipped identity is a full desk (palette, type, selected-row chrome, markdown heading accents), inspired by the Inkdrop-like night-desk screenshot the owner provided. Catppuccin Mocha remains a switchable theme, not the shipped default. Existing color/font/code theme pickers stay.

## Evidence on Hand

Real product screenshots in `docs/screenshots/`. Live notes and routines live in the local database; do not fabricate study stats, LeetCode ranks, or testimonials. The Inkdrop Desktop v6.1.0 demo screenshot is a visual reference only, not a product claim or competitor endorsement in UI copy.

## Product Principles

1. Local-first: the machine is the product; nothing here is a hosted service.
2. Today is the job: see the block, log it, return to work.
3. Notes are the system of record: problems, patterns, wikilinks, and chat read the same files.
4. Appearance is user-owned: a new default must not strand existing theme options.
5. Color stays semantic: accents mean status and action, not decoration.

## Accessibility & Inclusion

No product-specific standard was set beyond ordinary web keyboard access, visible focus, and contrast on the dark desk. Light theme (Latte) remains an option, not the default scene.
