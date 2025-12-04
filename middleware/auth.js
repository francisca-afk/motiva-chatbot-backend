const jwt = require('jsonwebtoken')

const verifyToken = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ message: 'No token provided' })
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    req.token = token
    next()
  } catch (error) {
    console.error('Token verification failed:', error)
    return res.status(401).json({ message: 'Invalid token' })
  }
}

module.exports = verifyToken
