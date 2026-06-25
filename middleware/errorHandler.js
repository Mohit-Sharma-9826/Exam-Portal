const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Server Error';

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }

  res.status(statusCode).render('error', {
    title: 'Error Occurred',
    message,
    statusCode,
    user: req.user || null
  });
};

module.exports = errorHandler;
