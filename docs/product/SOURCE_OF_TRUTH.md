# Omni-Sync SMS Finance (v3.0)

This document is the canonical source of truth for the initial product scope.

## Project

- Name: Omni-Sync SMS Finance
- Version: v3.0
- Goal: A privacy-first, local-first SMS parser and expense tracker.
- Stack: React + TypeScript + Capacitor (Mobile) + Tauri (Desktop)

## Core Architecture (Phase 1)

### 1. The Listener

A background service that intercepts SMS messages from 5-6 different bank and wallet templates.

### 2. The Staging Area (Inbox)

A "To-Be-Approved" queue where raw SMS data waits for user titles, categories, and notes.

### 3. Local-First Storage

SQLite-based storage to ensure data never leaves the device unless synced.

### 4. The Sync Hub

Peer-to-peer or local network sync to the desktop dashboard.

## UI/UX Constraints

- Navigation: Floating/Hovering Modern Bottom Nav Bar
- Settings: Top-right gear icon (non-nav)
- The "Edit" Window: Detached, feature-rich hovering modal
