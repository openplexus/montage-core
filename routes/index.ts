import express from 'express';
export const indexRouter = express.Router();

/* GET home page. */
indexRouter.get('/', function(req: any, res: any) {
  res.send('respond with a resource');
});
