import 'dotenv/config';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import createError from 'http-errors';
import express from 'express';
import morgan from 'morgan';

import authRouter from '#routes/auth.js';
import indexRouter from '#routes/index.js';
import productRouter from '#routes/product.js';
import addressRouter from '#routes/address.js';
import pedidoRouter from '#routes/pedido.js'; // ✅ Importa rotas de pedidos
import cartRouter from '#routes/cart.js'; // ✅ Importa rotas da sacola

const app = express();
const port = process.env.PORT || 3000;

// Configuração do CORS
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN, 
    credentials: true,
  })
);

// Middlewares
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rotas
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/products', productRouter);
app.use(addressRouter);
app.use('/api', pedidoRouter); // ✅ Rotas de pedidos em /api/*
app.use('/api', cartRouter); // ✅ Rotas da sacola em /api/*

// Tratamento de erro 404
app.use((req, res, next) => {
  next(createError(404));
});

// Tratamento de outros erros
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({ error: message });
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});