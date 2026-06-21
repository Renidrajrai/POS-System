export function validate(rules) {
  return (req, res, next) => {
    const errors = []
    for (const [field, checks] of Object.entries(rules)) {
      const value = req.body[field]
      for (const check of checks) {
        if (check.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`)
          break
        }
        if (value !== undefined && value !== null) {
          if (check.type === 'number' && isNaN(Number(value))) {
            errors.push(`${field} must be a number`)
          }
          if (check.type === 'string' && typeof value !== 'string') {
            errors.push(`${field} must be a string`)
          }
          if (check.min !== undefined && Number(value) < check.min) {
            errors.push(`${field} must be at least ${check.min}`)
          }
          if (check.max !== undefined && Number(value) > check.max) {
            errors.push(`${field} must be at most ${check.max}`)
          }
          if (check.oneOf && !check.oneOf.includes(value)) {
            errors.push(`${field} must be one of: ${check.oneOf.join(', ')}`)
          }
        }
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') })
    }
    next()
  }
}
