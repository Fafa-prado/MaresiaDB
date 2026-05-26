import express from 'express';
import { PrismaClient } from '../generated/prisma/index.js';

const router = express.Router();
const prisma = new PrismaClient();

// ==================== ADICIONAR ITEM À SACOLA ====================
router.post('/cart', async (req, res) => {
  try {
    const { userId, productId, quantidade, tamanho, cor } = req.body;

    // Validação básica
    if (!userId || !productId) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: userId, productId' 
      });
    }

    // Verifica se usuário existe
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verifica se produto existe e está disponível
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    if (!product.available) {
      return res.status(400).json({ error: 'Produto indisponível' });
    }

    // Normaliza tamanho e cor para null se estiverem vazios
    const tamanhoNormalizado = tamanho && tamanho.trim() !== '' ? tamanho : null;
    const corNormalizada = cor && cor.trim() !== '' ? cor : null;

    // Busca se já existe um item igual (mesmo produto, tamanho e cor)
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        tamanho: tamanhoNormalizado,
        cor: corNormalizada
      }
    });

    let cartItem;

    if (existingItem) {
      // Atualiza quantidade se já existe
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantidade: existingItem.quantidade + (quantidade || 1) },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              image1: true
            }
          }
        }
      });
    } else {
      // Cria novo item na sacola
      cartItem = await prisma.cartItem.create({
        data: {
          userId,
          productId,
          quantidade: quantidade || 1,
          tamanho: tamanhoNormalizado,
          cor: corNormalizada
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              image1: true
            }
          }
        }
      });
    }

    res.status(201).json(cartItem);
  } catch (error) {
    console.error('Erro ao adicionar item à sacola:', error);
    res.status(500).json({ error: 'Erro ao adicionar item à sacola' });
  }
});

// ==================== LISTAR ITENS DA SACOLA ====================
router.get('/users/:userId/cart', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            image1: true,
            available: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcula o total da sacola
    const total = cartItems.reduce((acc, item) => {
      const price = parseFloat(item.product.price || 0);
      return acc + (price * item.quantidade);
    }, 0);

    res.json({
      items: cartItems,
      total: total.toFixed(2),
      count: cartItems.length
    });
  } catch (error) {
    console.error('Erro ao buscar sacola:', error);
    res.status(500).json({ error: 'Erro ao buscar sacola' });
  }
});

// ==================== ATUALIZAR QUANTIDADE DE ITEM ====================
router.put('/cart/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { quantidade } = req.body;

    if (!quantidade || quantidade < 1) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que 0' });
    }

    const cartItem = await prisma.cartItem.findUnique({ where: { id } });
    if (!cartItem) {
      return res.status(404).json({ error: 'Item não encontrado na sacola' });
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id },
      data: { quantidade },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            image1: true
          }
        }
      }
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

// ==================== REMOVER ITEM DA SACOLA ====================
router.delete('/cart/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const cartItem = await prisma.cartItem.findUnique({ where: { id } });
    if (!cartItem) {
      return res.status(404).json({ error: 'Item não encontrado na sacola' });
    }

    await prisma.cartItem.delete({ where: { id } });

    res.json({ message: 'Item removido da sacola com sucesso' });
  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ error: 'Erro ao remover item' });
  }
});

// ==================== LIMPAR SACOLA ====================
router.delete('/users/:userId/cart', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    await prisma.cartItem.deleteMany({
      where: { userId }
    });

    res.json({ message: 'Sacola limpa com sucesso' });
  } catch (error) {
    console.error('Erro ao limpar sacola:', error);
    res.status(500).json({ error: 'Erro ao limpar sacola' });
  }
});

// ==================== FINALIZAR COMPRA (CRIAR PEDIDO DA SACOLA) ====================
router.post('/users/:userId/cart/checkout', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { pagamento, parcelas, enderecoId } = req.body;

    // Validação
    if (!pagamento || !enderecoId) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: pagamento, enderecoId' 
      });
    }

    // Busca itens da sacola
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: true
      }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Sacola vazia' });
    }

    // Verifica se endereço existe e pertence ao usuário
    const address = await prisma.address.findFirst({
      where: { 
        id: enderecoId,
        userId: userId 
      }
    });
    if (!address) {
      return res.status(404).json({ error: 'Endereço não encontrado' });
    }

    // Monta array de itens para o pedido
    const itens = cartItems.map(item => ({
      productId: item.productId,
      name: item.product.name,
      price: parseFloat(item.product.price),
      quantidade: item.quantidade,
      tamanho: item.tamanho,
      cor: item.cor,
      image: item.product.image1
    }));

    // Gera número identificador único
    const numeroIdentificador = `PED${Date.now()}${userId}`;

    // Cria o pedido
    const pedido = await prisma.pedido.create({
      data: {
        userId,
        numeroIdentificador,
        timestamp: BigInt(Date.now()),
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        pagamento,
        parcelas: parcelas || 1,
        enderecoId,
        itens: itens,
        etapas: [0, 0, 0, 0]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        endereco: true
      }
    });

    // Limpa a sacola após criar o pedido
    await prisma.cartItem.deleteMany({
      where: { userId }
    });

    res.status(201).json({
      message: 'Pedido criado com sucesso',
      pedido
    });
  } catch (error) {
    console.error('Erro ao finalizar compra:', error);
    res.status(500).json({ error: 'Erro ao finalizar compra' });
  }
});

export default router;