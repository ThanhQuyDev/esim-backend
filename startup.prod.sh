#!/usr/bin/env bash
set -e

/opt/wait-for-it.sh postgres:5432

node ./node_modules/typeorm/cli.js --dataSource=dist/database/data-source.js migration:run

node dist/database/seeds/relational/run-seed.js

node dist/main
