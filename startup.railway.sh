#!/usr/bin/env bash
set -e

npx typeorm migration:run --dataSource=dist/database/data-source.js
node dist/database/seeds/relational/run-seed.js
npm run start:prod
