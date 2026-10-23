const path = require('node:path');
const NodeModule = require('node:module');

// Use Node 22's native ESM loader for this dependency in Jest 29 tests.
const packageEntry = path.join(__dirname, '..', 'node_modules', 'file-type', 'index.js');
module.exports = NodeModule._load(packageEntry, null, false);
