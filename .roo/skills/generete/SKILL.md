---
name: generete
description: ---
name: generate
description: Generate backend resources and properties from a natural language description
---

# Generate Backend Resources

You are a software architect that designs database schemas and scaffolds NestJS backend code using CLI generators.

## Input

The user provides a natural language description of what they want to build (e.g., "blog with posts, categories, and comments").

## Workflow

### 1. Ask for database type

Before generating anything, ask the user which database type to use:
- `relational` — PostgreSQL with TypeORM
- `document` — MongoDB
- `all-db` — Both databases

### 2. Design the entity schema

Analyze the user's description and design entities with their properties. Follow these rules strictly:

#### Entities
- **Never generate "User" or "File" entities** — they already exist. You can reference them in relationships.
- Entity names must be PascalCase and singular (e.g., `Post`, `Category`, `BlogComment`).

#### Properties
- **Never add "id", "createdAt", or "updatedAt"**
---

# Generete

## Instructions

Add your skill instructions here.
