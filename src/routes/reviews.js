import express from 'express';
import createError from 'http-errors';
import { PrismaClient } from '#generated/prisma/index.js';
import verifyToken from '#middlewares/verifyToken.js';

const prisma = new PrismaClient();
const router = express.Router();

// POST - Criar novo review (usuário vem do JWT)
router.post('/:id/reviews', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comentario, estrelas } = req.body;
    const userId = req.user.id; // Usuário autenticado via JWT

    console.log('📝 Criando review:', { productId: id, userId, estrelas, comentario });

    // Validações
    if (!comentario || estrelas === undefined) {
      return next(createError(400, 'Campos obrigatórios: comentario, estrelas'));
    }

    if (estrelas < 0 || estrelas > 5) {
      return next(createError(400, 'O campo "estrelas" deve estar entre 0 e 5'));
    }

    const productId = parseInt(id);

    // Checar se o produto existe
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return next(createError(404, 'Produto não encontrado'));
    }

    // ✅ Criar timestamp atual
    const timestampAtual = Date.now(); // Timestamp em milissegundos
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
    const horaFormatada = dataAtual.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    console.log('📅 Timestamp criado:', {
      timestamp: timestampAtual,
      data: dataFormatada,
      hora: horaFormatada
    });

    // Criar o review COM TIMESTAMP
    const review = await prisma.review.create({
      data: {
        comentario,
        estrelas: parseInt(estrelas),
        productId: productId,
        userId: parseInt(userId),
        timestamp: timestampAtual, // ✅ Adiciona timestamp
        data: dataFormatada,       // ✅ Adiciona data formatada
        hora: horaFormatada,       // ✅ Adiciona hora formatada
        dataDePublicacao: dataAtual // ✅ Mantém para ordenação
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          }
        }
      }
    });

    console.log('✅ Review criado com sucesso:', review);

    res.status(201).json({
      message: 'Review criado com sucesso',
      review
    });
  } catch (error) {
    console.error('❌ Erro ao criar review:', error);
    next(createError(500, 'Erro ao criar review'));
  }
});

// GET - Buscar detalhes completos de um produto por ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    console.log('🔍 Buscando produto ID:', productId);

    if (isNaN(productId)) {
      return next(createError(400, 'ID do produto inválido'));
    }

    // Buscar produto com todas as informações necessárias
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        detailedDescription: true,
        price: true,
        size: true,
        color: true,
        material: true,
        category: true,
        available: true,
        new: true,
        image1: true,
        image2: true,
        image3: true,
        image4: true,
        image5: true,
        collection: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        reviews: {
          select: {
            id: true,
            comentario: true,
            estrelas: true,
            timestamp: true, // ✅ Inclui timestamp
            data: true,      // ✅ Inclui data
            hora: true,      // ✅ Inclui hora
            dataDePublicacao: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
          orderBy: {
            dataDePublicacao: 'desc',
          },
        },
        createdAt: true,
      },
    });

    if (!product) {
      return next(createError(404, 'Produto não encontrado'));
    }

    // Calcular estatísticas das avaliações
    const totalReviews = product.reviews.length;
    const averageStars = totalReviews > 0
      ? product.reviews.reduce((sum, review) => sum + review.estrelas, 0) / totalReviews
      : 0;

    // Contar avaliações por estrela
    const starDistribution = {
      5: product.reviews.filter(r => r.estrelas === 5).length,
      4: product.reviews.filter(r => r.estrelas === 4).length,
      3: product.reviews.filter(r => r.estrelas === 3).length,
      2: product.reviews.filter(r => r.estrelas === 2).length,
      1: product.reviews.filter(r => r.estrelas === 1).length,
    };

    // Preparar resposta com todas as informações
    const response = {
      id: product.id,
      name: product.name,
      description: product.description,
      detailedDescription: product.detailedDescription,
      price: product.price,
      size: product.size,
      color: product.color,
      material: product.material,
      category: product.category,
      available: product.available,
      new: product.new,
      images: {
        image1: product.image1,
        image2: product.image2,
        image3: product.image3,
        image4: product.image4,
        image5: product.image5,
      },
      collection: product.collection,
      reviews: product.reviews,
      reviewStats: {
        total: totalReviews,
        averageStars: parseFloat(averageStars.toFixed(1)),
        distribution: starDistribution,
      },
      createdAt: product.createdAt,
    };

    console.log('📅 Reviews com timestamp:', product.reviews.map(r => ({
      username: r.user.username,
      timestamp: r.timestamp,
      data: r.data,
      hora: r.hora
    })));

    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    next(createError(500, 'Erro ao buscar detalhes do produto'));
  }
});

export default router;