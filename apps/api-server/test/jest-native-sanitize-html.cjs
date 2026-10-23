const path = require('node:path');
const NodeModule = require('node:module');

// Jest 29's CJS loader cannot parse htmlparser2's ESM; Node 22 can load it.
const packageEntry = path.join(__dirname, '..', 'node_modules', 'sanitize-html', 'index.js');
module.exports = NodeModule._load(packageEntry, null, false);
