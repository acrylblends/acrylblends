#!/usr/bin/env node
import { runCreate } from '../dist/index.js'

process.exitCode = await runCreate(process.argv.slice(2))
