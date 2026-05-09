/**
 * Compatibility facade for AI tool registry and execution.
 * Registry definitions live in ./tools/*.tools.js; execution dispatch lives in ./toolExecutor.js.
 */

const toolRegistry = require('./toolRegistry')
const { executeTool } = require('./toolExecutor')

module.exports = {
  ...toolRegistry,
  executeTool
}












