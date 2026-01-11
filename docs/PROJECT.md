# MyTradeLedger — Project Definition

## Overview

MyTradeLedger is a crypto trade logging application focused on simple, accurate record-keeping and clear profit or loss visibility. It allows users to record buy and sell trades, review them chronologically, and see cumulative financial results over time.

The project is designed with a **local-first core** that can run entirely on a user’s machine using Docker, while also supporting an **optional hosted version** for users who prefer a managed, online experience.

---

## Core Principles

- **Simplicity first**  
  The system records trades and shows profit or loss without additional interpretation.

- **Trade-centric**  
  Buy and sell executions are the primary unit of data.

- **Minimal presentation**  
  The interface prioritizes structured tables and chronological logs over dashboards or visual summaries.

- **Data ownership**  
  Users retain full access to their data, including the ability to export at any time.

- **Flexible deployment**  
  The same core application supports both self-hosted and managed online use.

---

## What the Application Does

- Records crypto buy and sell trades
- Tracks quantity, price, fees, and timestamps
- Calculates net and cumulative profit or loss
- Displays trades in a chronological log
- Supports multiple accounts or portfolios
- Exports all trade data to CSV

---

## Deployment Models

### Self-Hosted (Free / Open Use)

- Runs locally using Docker and Docker Compose
- Requires no external services
- Intended for users who prefer full control
- No ongoing costs beyond local infrastructure

### Hosted (Paid)

- Fully managed online version
- No installation or infrastructure setup required
- Secure account access via browser
- Intended for users who want convenience over self-hosting
- Offered at a low monthly subscription cost (e.g., ~$5 USD)

Both deployment models share the same core functionality and data model.

---

## Monetization Strategy

- **Primary revenue source:** Hosted version subscription
- **Pricing approach:** Simple, affordable monthly fee
- **Value proposition:** Convenience, zero setup, automatic updates
- **Core parity:** Functionality remains consistent across self-hosted and hosted deployments

The self-hosted version also serves as an entry point for users who later choose the hosted option.

---

## User Workflow

1. User records a buy or sell trade
2. Trades appear in a chronological list
3. Cumulative profit or loss is updated automatically
4. User may review data or export to CSV at any time

The workflow is intentionally linear and transparent.

---

## Data Model (High-Level)

- **Trade**
  - Timestamp
  - Symbol
  - Side (BUY / SELL)
  - Quantity
  - Price
  - Fees
  - Total value

- **Account**
  - Name
  - Base currency
  - Trade history
  - Net profit or loss

All calculated values are derived directly from recorded trades.

---

## Technical Stack

- **Frontend**
  - React
  - Tailwind CSS
  - DaisyUI

- **Backend**
  - Node.js
  - REST API

- **Database**
  - PostgreSQL

- **Runtime**
  - Docker / Docker Compose

---

## Export & Portability

CSV export is a first-class feature. Exported files are designed to be stable, predictable, and easily consumed by spreadsheets or external tools.

---

## Target Audience

- Crypto traders who want a clean, private trade log
- Users who want clear profit or loss tracking without unnecessary complexity
- Developers and technical users who prefer self-hosted tools
- Non-technical users who prefer a simple hosted solution

---

## Project Scope

MyTradeLedger is intentionally narrow in scope. It focuses on recording trades and presenting cumulative financial results in a clear, transparent way.

Future development must align with the core principles of simplicity, data ownership, minimal presentation, and deployment flexibility.
