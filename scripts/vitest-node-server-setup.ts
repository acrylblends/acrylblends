// The ported adapter suite finds its fixtures relative to the plugin folder (ACRYL runs it from there); run it from there here too.
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('../plugins/acryl-node-server/', import.meta.url)))
