import express from 'express';
export const usersRouter = express.Router();

/* GET users listing. */
usersRouter.get('/', function(req: any, res: any) {
  res.send('respond with a resource');
});
