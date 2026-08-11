// Re-export Zod-based helpers from lib/validate.js.
// This shim keeps any remaining imports from this path working.
export { uuid, lat, lng, body, uuidParam } from './lib/validate.js'
