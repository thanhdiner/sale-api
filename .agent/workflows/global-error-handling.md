---
description: Implement Global Error Handling and Operational Errors in Express.js
---

To implement a robust, standardized global error handling system that integrates with Winston logging and handles common library errors (Mongoose, JWT, Multer), follow these steps:

1. **Create the Base Error Class**
   - Create `api/v1/utils/AppError.js`.
   - Implement `class AppError extends Error` to capture `statusCode`, `details`, and `isOperational`.
   - Use `Error.captureStackTrace(this, this.constructor)` to keep stack traces clean.

2. **Develop the Global Error Handler Middleware**
   - Create `api/v1/middlewares/errorHandler.middleware.js`.
   - Implement logic to translate library errors (CastError, ValidationError, JWT errors, Multer errors) into `AppError` instances.
   - Use the `logger` (Winston) to log `warn` for operational errors and `error` for unhandled bugs.
   - Return a consistent JSON payload: `{ success: false, statusCode, error, [details], [stack] }`.

3. **Define a 404 Catcher**
   - Create `api/v1/middlewares/notFound.middleware.js`.
   - Pass an `AppError` with a 404 status code to `next()`.

4. **Wired into the Application**
   - In `index.js`, import both middlewares.
   - **Order is critical**: Mount `notFound` followed by `errorHandler` at the very end of the middleware stack, *after* all routes and logic.

5. **Refactor Controllers and Middlewares**
   - Import `AppError` wherever manual errors are needed.
   - In `catch` blocks, use `next(err)` instead of manual `res.status().json()`.
   - This ensures all responses follow the same structure and all errors are logged centrally.

6. **Verify and Deploy**
   - Run a smoke test to ensure no circular dependencies.
   - Use `git add .`, commit, and push changes to the repository.
