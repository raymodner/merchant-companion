import { z } from 'zod'

// Reusable primitive schemas
export const uuid = z.string().uuid()
export const lat  = z.number().finite().min(-90).max(90)
export const lng  = z.number().finite().min(-180).max(180)

/**
 * Express middleware that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed+coerced result.
 * On failure, responds 400 with the first issue's message.
 */
export function body(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message })
    }
    req.body = result.data
    next()
  }
}

/**
 * Express middleware that validates a named route param as a UUID.
 * Returns 400 with "Invalid <key>" if the param is not a valid UUID.
 */
export function uuidParam(key = 'id') {
  return (req, res, next) => {
    const result = uuid.safeParse(req.params[key])
    if (!result.success) {
      return res.status(400).json({ error: `Invalid ${key}` })
    }
    next()
  }
}
