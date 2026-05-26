import express from 'express';
import createError from 'http-errors';
import { PrismaClient } from '#generated/prisma/index.js';
import verifyToken from '#middlewares/verifyToken.js';

const prisma = new PrismaClient();
const router = express.Router();

// Função para normalizar texto (remover acentos)
const normalizarTexto = (texto) => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
};

// Função para remover plural (simples)
const singularizar = (palavra) => {
  // Remove 's' do final se a palavra tiver mais de 3 letras
  if (palavra.length > 3 && palavra.endsWith('s')) {
    return palavra.slice(0, -1);
  }
  return palavra;
};

// Função para extrair palavras-chave da busca
const extrairPalavrasChave = (texto) => {
  // Remove palavras conectivas comuns
  const stopWords = ['de', 'da', 'do', 'para', 'com', 'em', 'a', 'o', 'e', 'the', 'and', 'of', 'in', 'to'];
  
  const palavras = normalizarTexto(texto)
    .split(/\s+/)
    .filter(p => p.length > 1) // Remove palavras muito curtas
    .filter(p => !stopWords.includes(p)) // Remove stop words
    .map(p => singularizar(p)); // Singulariza
  
  return [...new Set(palavras)]; // Remove duplicatas
};

// Mapeamento de cores em inglês para português
const colorMapping = {
  // Cores básicas
  'red': 'Vermelho',
  'blue': 'Azul',
  'green': 'Verde',
  'yellow': 'Amarelo',
  'black': 'Preto',
  'white': 'Branco',
  'pink': 'Rosa',
  'purple': 'Roxo',
  'orange': 'Laranja',
  'brown': 'Marrom',
  'gray': 'Cinza',
  'grey': 'Cinza',
  
  // Cores específicas da paleta
  'coral': 'Coral',
  'cinnamon': 'Canela',
  'wine': 'Vinho',
  'daffodil': 'Narciso',
  'lime': 'Lima',
  'moss': 'Musgo',
  'pool': 'Piscina',
  'marine': 'Marine',
  'lilac': 'Lilás',
  'beige': 'Bege'
};

// Mapeamento de categorias em inglês para português - ATUALIZADO
const categoryMapping = {
  // Roupas - MAIS FLEXÍVEL
  'dress': 'vestido',
  'dresses': 'vestido',
  'vestido': 'vestido',
  'vestidos': 'vestido',
  'vest': 'vestido', // fallback
  
  'shirt': 'camiseta',
  'tshirt': 'camiseta',
  't-shirt': 'camiseta',
  'camiseta': 'camiseta',
  'camisetas': 'camiseta',
  
  'bikini': 'biquini',
  'biquini': 'biquini',
  'biquinis': 'biquini',
  
  'swimsuit': 'maio',
  'swimsuits': 'maio',
  'maio': 'maio',
  'maios': 'maio',
  'maiô': 'maio',
  'maiôs': 'maio',
  
  'short': 'short',
  'shorts': 'short',
  
  'skirt': 'saia',
  'skirts': 'saia',
  'saia': 'saia',
  'saias': 'saia',
  
  'beach towel': 'canga',
  'towel': 'canga',
  'beachtowel': 'canga',
  'canga': 'canga',
  'cangas': 'canga',
  
  // Calçados
  'sandal': 'sandalia',
  'sandals': 'sandalia',
  'sandalia': 'sandalia',
  'sandálias': 'sandalia',
  'sandalias': 'sandalia',
  
  'flip flop': 'chinelo',
  'flip-flop': 'chinelo',
  'flipflop': 'chinelo',
  'flip': 'chinelo',
  'chinelo': 'chinelo',
  'chinelos': 'chinelo',
  
  // Acessórios
  'umbrella': 'sombrinha',
  'beach umbrella': 'sombrinha',
  'beachumbrella': 'sombrinha',
  'sombrinha': 'sombrinha',
  'sombrinhas': 'sombrinha',
  
  'bag': 'bolsa',
  'bags': 'bolsa',
  'beach bag': 'bolsa',
  'beachbag': 'bolsa',
  'bolsa': 'bolsa',
  'bolsas': 'bolsa',
  
  // Categorias gerais
  'beachwear': 'praia',
  'swimwear': 'praia',
  'beach': 'praia',
  'praia': 'praia',
  
  'clothing': 'roupas',
  'clothes': 'roupas',
  'roupas': 'roupas',
  
  'shoes': 'calçados',
  'footwear': 'calçados',
  'calçados': 'calçados',
  'calcados': 'calçados',
  
  'accessories': 'acessorios',
  'acessórios': 'acessorios',
  'acessorios': 'acessorios',

  // Novidades
  'new': 'novidades',
  'news': 'novidades',
  'novelty': 'novidades',
  'novelties': 'novidades',
  'novidades': 'novidades'
};

// Função para calcular score de relevância - ATUALIZADA
// Função para calcular score de relevância - CORRIGIDA
const calcularRelevancia = (produto, palavrasChave, termoPesquisaCompleto) => {
  let score = 0;
  
  const campos = [
    { texto: produto.name || '', peso: 5 },
    { texto: produto.category || '', peso: 4 },
    { texto: produto.description || '', peso: 2 },
    { texto: produto.detailedDescription || '', peso: 1 },
    { texto: produto.material || '', peso: 3 },
    { texto: produto.color || '', peso: 2 },
  ];

  // ✅ PRIMEIRO: Verificar se o termo completo ou palavras-chave correspondem a uma categoria mapeada
  const todasPalavras = [termoPesquisaCompleto, ...palavrasChave];
  let categoriaBuscada = null;
  
  for (const palavra of todasPalavras) {
    if (categoryMapping[palavra]) {
      categoriaBuscada = normalizarTexto(categoryMapping[palavra]);
      break;
    }
  }

  // Se estamos buscando por uma categoria específica (ex: dress → vestido)
  if (categoriaBuscada) {
    const categoriaProduto = normalizarTexto(produto.category || '');
    
    // Match exato de categoria
    if (categoriaProduto === categoriaBuscada) {
      score += 100; // Score MUITO ALTO para match exato de categoria
    }
    // Categoria contém o termo
    else if (categoriaProduto.includes(categoriaBuscada) || categoriaBuscada.includes(categoriaProduto)) {
      score += 80;
    }
  }

  // ✅ Verificar se é busca por "novidades" ou "new"
  if (termoPesquisaCompleto === 'novidades' || termoPesquisaCompleto === 'new' || 
      termoPesquisaCompleto === 'novidade' || termoPesquisaCompleto === 'new arrivals' ||
      palavrasChave.includes('new') || palavrasChave.includes('novidades')) {
    
    if (produto.new) {
      score += 100;
    }
    
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    if (produto.createdAt && new Date(produto.createdAt) > trintaDiasAtras) {
      score += 50;
    }
    
    const categoriasNovidades = ['vestido', 'biquini', 'maio', 'short', 'saia', 'camiseta'];
    if (categoriasNovidades.includes(produto.category?.toLowerCase())) {
      score += 25;
    }
  }
  
  // Processar outros campos
  campos.forEach(({ texto, peso }) => {
    const textoNormalizado = normalizarTexto(texto);
    const textoSingular = singularizar(textoNormalizado);
    
    // ✅ Verificar se é busca por cor em inglês
    palavrasChave.forEach(palavra => {
      const corMapeada = colorMapping[palavra];
      if (corMapeada) {
        const corMapeadaNormalizada = normalizarTexto(corMapeada);
        if (textoNormalizado.includes(corMapeadaNormalizada) || 
            textoSingular.includes(corMapeadaNormalizada)) {
          score += peso * 8;
        }
      }
    });
    
    // Match exato com termo completo (maior score)
    if (textoNormalizado === termoPesquisaCompleto || textoSingular === termoPesquisaCompleto) {
      score += peso * 10;
    }
    
    // Match exato com alguma palavra-chave
    palavrasChave.forEach(palavra => {
      const palavraSingular = singularizar(palavra);
      
      // Match exato da palavra
      if (textoNormalizado === palavra || textoNormalizado === palavraSingular ||
          textoSingular === palavra || textoSingular === palavraSingular) {
        score += peso * 5;
      }
      // Palavra contida no texto
      else if (textoNormalizado.includes(palavra) || textoNormalizado.includes(palavraSingular) ||
               textoSingular.includes(palavra) || textoSingular.includes(palavraSingular)) {
        score += peso * 2;
      }
    });
  });
  
  return score;
};

// ⚠️ ORDEM CRÍTICA DAS ROTAS:
// 1. Rotas específicas primeiro (GET /cores, GET /search)
// 2. POST com parâmetros (POST /:id/reviews)
// 3. Rota de listagem (GET /)
// 4. Rota dinâmica por último (GET /:id)

// 🎨 Rota para buscar cores disponíveis
router.get('/cores', async (req, res, next) => {
  try {
    const cores = await prisma.product.findMany({
      where: { color: { not: null } },
      select: { color: true },
      distinct: ['color'],
    });

    res.json(cores.map(c => c.color));
  } catch (err) {
    console.error(err);
    next(createError(500, 'Erro ao buscar cores'));
  }
});

// 🔍 ROTA DE PESQUISA - DEVE VIR ANTES DO /:id
router.get('/search', async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    
    console.log('🔍 === BUSCA INICIADA ===');
    console.log('Query params:', { q, page, limit });

    // Validações
    if (!q || q.trim() === '') {
      console.log('❌ Termo de busca vazio');
      return next(createError(400, 'Parâmetro de busca "q" é obrigatório'));
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1) {
      return next(createError(400, 'Page e limit devem ser números positivos'));
    }

    if (limitNum > 100) {
      return next(createError(400, 'Limit não pode exceder 100'));
    }

    const skip = (pageNum - 1) * limitNum;

    // Normalizar o termo de busca
    const termoPesquisaCompleto = normalizarTexto(q);
    const palavrasChave = extrairPalavrasChave(q);
    
    console.log('📝 Termo normalizado:', termoPesquisaCompleto);
    console.log('🔑 Palavras-chave extraídas:', palavrasChave);

    // DEBUG ESPECÍFICO PARA DRESS
    console.log('🎯 === DEBUG DRESS ===');
    console.log('Termo pesquisa completo:', termoPesquisaCompleto);
    console.log('Palavras-chave:', palavrasChave);
    console.log('Mapeamento para "dress":', categoryMapping['dress']);
    console.log('Mapeamento para "skirt":', categoryMapping['skirt']);

    // Buscar todos os produtos para fazer pesquisa case-insensitive e sem acentos
    console.log('🔄 Buscando produtos no banco...');
    const todosProdutos = await prisma.product.findMany({
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
        collection: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        createdAt: true,
      },
    });

    console.log('📊 Total de produtos no banco:', todosProdutos.length);

    // DEBUG: Log das categorias únicas
    console.log('🏷️ Categorias únicas no banco:');
    const categoriasUnicas = [...new Set(todosProdutos.map(p => p.category).filter(Boolean))];
    categoriasUnicas.forEach(cat => console.log('   -', cat));

    // DEBUG específico para dress
    if (termoPesquisaCompleto === 'dress' || termoPesquisaCompleto === 'dresses') {
      console.log('🔎 DEBUG DRESS - Produtos com categoria relacionada a vestido:');
      const produtosVestido = todosProdutos.filter(p => 
        p.category && normalizarTexto(p.category).includes('vestido')
      );
      console.log('   Encontrados:', produtosVestido.length);
      produtosVestido.forEach(p => {
        console.log('   -', p.name, '| Categoria:', p.category);
      });
    }

    // Filtrar e calcular relevância dos produtos
    const produtosComScore = todosProdutos.map(produto => {
      const score = calcularRelevancia(produto, palavrasChave, termoPesquisaCompleto);
      return { ...produto, relevanciaScore: score };
    });

    // Filtrar apenas produtos com score > 0 e ordenar por relevância
    const produtosFiltrados = produtosComScore
      .filter(p => p.relevanciaScore > 0)
      .sort((a, b) => b.relevanciaScore - a.relevanciaScore);

    const total = produtosFiltrados.length;
    console.log('✅ Produtos encontrados após filtro:', total);
    
    // DEBUG: Log dos produtos com score para dress
    if (termoPesquisaCompleto === 'dress' || termoPesquisaCompleto === 'dresses') {
      console.log('📋 DEBUG DRESS - Produtos com score > 0:');
      produtosComScore
        .filter(p => p.relevanciaScore > 0)
        .forEach(p => {
          console.log('   -', p.name, '| Score:', p.relevanciaScore, '| Categoria:', p.category);
        });
    }
    
    // Log dos 3 produtos mais relevantes
    if (produtosFiltrados.length > 0) {
      console.log('🏆 Top 3 mais relevantes:');
      produtosFiltrados.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} (score: ${p.relevanciaScore})`);
      });
    }

    // Aplicar paginação
    const produtosPaginados = produtosFiltrados
      .slice(skip, skip + limitNum)
      .map(({ relevanciaScore, ...produto }) => produto); // Remove o score da resposta

    console.log('📄 Produtos nesta página:', produtosPaginados.length);
    console.log('🔍 === BUSCA FINALIZADA ===\n');

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: produtosPaginados,
      search: {
        query: q,
        normalizedQuery: termoPesquisaCompleto,
        keywords: palavrasChave,
        resultsFound: total,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('❌ ERRO NA BUSCA:', error);
    console.error('Stack:', error.stack);
    next(createError(500, 'Erro ao pesquisar produtos'));
  }
});

// ⭐ POST - Criar novo review (usuário vem do JWT)
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

    // Criar o review
    const review = await prisma.review.create({
      data: {
        comentario,
        estrelas: parseInt(estrelas),
        productId: productId,
        userId: parseInt(userId),
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

// GET - Buscar lista de produtos com paginação e filtros
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.categoria;
    const colecao = req.query.colecao;
    const preco = req.query.preco;
    const material = req.query.material;
    const tamanhos = req.query.tamanhos ? req.query.tamanhos.split(',') : [];
    const cores = req.query.cores ? req.query.cores.split(',') : [];
    const skip = (page - 1) * limit;

    console.log('=== NOVA REQUISIÇÃO ===');
    console.log('Query params recebidos:', req.query);
    console.log('Cores recebidas:', cores);

    if (page < 1 || limit < 1) {
      return next(createError(400, 'Page and limit must be positive numbers'));
    }

    if (limit > 100) {
      return next(createError(400, 'Limit cannot exceed 100'));
    }

    const where = {};
    
    // Filtro por categoria
    if (category) {
      where.category = category;
    }

    // Filtro por coleção (normalizado)
    if (colecao) {
      console.log('🔍 Buscando coleção:', colecao);
      
      const todasColecoes = await prisma.collection.findMany();
      console.log('📋 Coleções no banco:', todasColecoes.map(c => c.title));
      
      const colecaoNormalizada = normalizarTexto(colecao);
      
      const colecaoEncontrada = todasColecoes.find(
        c => normalizarTexto(c.title) === colecaoNormalizada
      );

      console.log('✅ Coleção encontrada:', colecaoEncontrada);

      if (!colecaoEncontrada) {
        console.log('❌ Coleção NÃO encontrada');
        return next(createError(404, `Coleção "${colecao}" não encontrada`));
      }

      console.log('🎯 Filtrando por collectionId:', colecaoEncontrada.id);
      where.collectionId = colecaoEncontrada.id;
    }

    // 🔢 Filtro de faixa de preço
    if (preco) {
      switch (preco) {
        case 'ate50':
          where.price = { lte: 50 };
          break;
        case '50a100':
          where.price = { gte: 50, lte: 100 };
          break;
        case '100a150':
          where.price = { gte: 100, lte: 150 };
          break;
        case '150a200':
          where.price = { gte: 150, lte: 200 };
          break;
        case '200mais':
          where.price = { gte: 200 };
          break;
      }
    }

    // 🧵 Filtro por material
    if (material) {
      where.material = material;
    }

    // 📏🎨 Filtro por tamanhos e cores
    const orConditions = [];

    if (tamanhos.length > 0) {
      // Se size for array JSON
      tamanhos.forEach(tamanho => {
        orConditions.push({
          size: {
            array_contains: tamanho
          }
        });
      });
    }

    if (cores.length > 0) {
      console.log('🎨 Filtrando por cores:', cores);
      
      // Color é String? - usar IN para múltiplas cores
      where.color = {
        in: cores
      };
      
      console.log('🎨 Filtro de cores aplicado:', where.color);
    }

    // Apenas adiciona OR se houver tamanhos (não cores)
    if (orConditions.length > 0) {
      where.OR = orConditions;
      console.log('📋 OR conditions:', JSON.stringify(orConditions, null, 2));
    }

    console.log('🛠️ Where clause final:', JSON.stringify(where, null, 2));

    const total = await prisma.product.count({ where });
    console.log('📊 Total de produtos com filtro:', total);

    const products = await prisma.product.findMany({
      where,
      skip,
      take: limit,
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
        collection: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('🛍️ Produtos encontrados:', products.length);
    console.log('🎨 Cores dos produtos:', products.map(p => ({ 
      name: p.name, 
      color: p.color,
      colorType: Array.isArray(p.color) ? 'array' : typeof p.color
    })));

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    next(createError(500, 'Erro ao buscar produtos'));
  }
});

// GET - Buscar detalhes completos de um produto por ID
// ⚠️ Esta rota DEVE vir POR ÚLTIMO porque /:id captura qualquer coisa
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

    console.log('🎨 Cor do produto:', product.color);

    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    next(createError(500, 'Erro ao buscar detalhes do produto'));
  }
});

export default router;