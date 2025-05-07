import createError from 'http-errors';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/database';

import { indexRouter } from './routes/index';
import { usersRouter } from './routes/users';
import { expendituresRouter } from './routes/expenditures';

interface HttpError extends Error {
  status?: number;
}

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/expenditures', expendituresRouter);

// catch 404 and forward to error handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(404));
});

// error handler
app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  // only provide error stack in development
  const errorDetails = app.get('env') === 'development' ? err.stack : {};

  res.status(statusCode).json({
    error: {
      message,
      ...(errorDetails && { details: errorDetails })
    }
  });
});

export = app;
