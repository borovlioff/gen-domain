#!/usr/bin/env node

import { cli } from '../src/cli.js';

// Запуск CLI
cli(process.argv.slice(2));