import express from 'express';
import { PrismaClient } from '../generated/prisma/index.js';

const router = express.Router();
const prisma = new PrismaClient();

// ==================== CRIAR PEDIDO ====================
router.post('/pedidos', async (req, res) => {
  try {
    const { 
      userId, 
      numeroIdentificador, 
      timestamp, 
      data, 
      hora, 
      pagamento,
      parcelas, // ✅ Número de parcelas (1-12)
      enderecoId, 
      itens,
      etapas 
    } = req.body;

    // Validação básica
    if (!userId || !numeroIdentificador || !pagamento || !enderecoId || !itens || !Array.isArray(itens)) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: userId, numeroIdentificador, pagamento, enderecoId, itens' 
      });
    }

    // Verifica se o usuário existe
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verifica se o endereço existe e pertence ao usuário
    const address = await prisma.address.findFirst({
      where: { 
        id: enderecoId,
        userId: userId 
      }
    });
    if (!address) {
      return res.status(404).json({ error: 'Endereço não encontrado ou não pertence ao usuário' });
    }

    const pedido = await prisma.pedido.create({
      data: {
        userId,
        numeroIdentificador,
        timestamp: timestamp || BigInt(Date.now()),
        data: data || new Date().toLocaleDateString('pt-BR'),
        hora: hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        pagamento,
        parcelas: parcelas || 1, // ✅ Default 1x (à vista)
        enderecoId,
        itens: itens, // Array de produtos em JSON
        etapas: etapas || [0, 0, 0, 0] // [Pagamento, Preparo, Entrega, Chegou]
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

    res.status(201).json(pedido);
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro ao criar pedido' });
  }
});

// ==================== LISTAR PEDIDOS DO USUÁRIO ====================
router.get('/users/:userId/pedidos', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const pedidos = await prisma.pedido.findMany({
      where: { userId },
      include: {
        endereco: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(pedidos);
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

// ==================== BUSCAR PEDIDO ESPECÍFICO ====================
router.get('/pedidos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const pedido = await prisma.pedido.findUnique({
      where: { id },
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

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    res.json(pedido);
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
});

// ==================== ATUALIZAR ETAPAS DO PEDIDO ====================
router.put('/pedidos/:id/etapas', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { etapas } = req.body;

    if (!Array.isArray(etapas) || etapas.length !== 4) {
      return res.status(400).json({ 
        error: 'Etapas deve ser um array com 4 elementos [0 ou 1]' 
      });
    }

    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const pedidoAtualizado = await prisma.pedido.update({
      where: { id },
      data: { etapas },
      include: {
        endereco: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(pedidoAtualizado);
  } catch (error) {
    console.error('Erro ao atualizar etapas:', error);
    res.status(500).json({ error: 'Erro ao atualizar etapas' });
  }
});

// ==================== ATUALIZAR STATUS DE PAGAMENTO ====================
router.put('/pedidos/:id/pagamento', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body; // 'pendente', 'aprovado', 'recusado'

    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    let etapasAtualizadas = pedido.etapas;
    
    if (status === 'aprovado') {
      etapasAtualizadas[0] = 1; // Marca primeira etapa (Pagamento) como concluída
    }

    const pedidoAtualizado = await prisma.pedido.update({
      where: { id },
      data: { 
        etapas: etapasAtualizadas 
      },
      include: {
        endereco: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(pedidoAtualizado);
  } catch (error) {
    console.error('Erro ao atualizar pagamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar pagamento' });
  }
});

// ==================== MARCAR PEDIDO COMO ENTREGUE ====================
router.put('/pedidos/:id/entregar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    // Marca todas as etapas como concluídas
    const etapasCompletas = [1, 1, 1, 1];

    const pedidoAtualizado = await prisma.pedido.update({
      where: { id },
      data: { 
        etapas: etapasCompletas 
      },
      include: {
        endereco: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(pedidoAtualizado);
  } catch (error) {
    console.error('Erro ao marcar como entregue:', error);
    res.status(500).json({ error: 'Erro ao marcar como entregue' });
  }
});

// ==================== CANCELAR PEDIDO ====================
router.delete('/pedidos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { userId } = req.body; // Para verificar se o pedido pertence ao usuário

    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    // Verifica se o pedido pertence ao usuário (opcional - depende da sua regra de negócio)
    if (userId && pedido.userId !== userId) {
      return res.status(403).json({ error: 'Você não tem permissão para cancelar este pedido' });
    }

    // Não permite cancelar pedidos já entregues
    const etapas = pedido.etapas;
    if (etapas[3] === 1) { // Se chegou (última etapa)
      return res.status(400).json({ error: 'Não é possível cancelar pedidos já entregues' });
    }

    await prisma.pedido.delete({ where: { id } });

    res.json({ message: 'Pedido cancelado com sucesso' });
  } catch (error) {
    console.error('Erro ao cancelar pedido:', error);
    res.status(500).json({ error: 'Erro ao cancelar pedido' });
  }
});

// ==================== BUSCAR PEDIDOS POR STATUS ====================
router.get('/users/:userId/pedidos/status/:etapa', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const etapa = parseInt(req.params.etapa); // 0-3 (Pagamento, Preparo, Entrega, Chegou)

    if (etapa < 0 || etapa > 3) {
      return res.status(400).json({ error: 'Etapa deve ser entre 0 e 3' });
    }

    const pedidos = await prisma.pedido.findMany({
      where: { userId },
      include: {
        endereco: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filtra pedidos pela etapa atual
    const pedidosFiltrados = pedidos.filter(p => {
      const etapas = p.etapas;
      // Retorna pedidos que estão na etapa especificada
      return etapas[etapa] === 1 && (etapa === 3 || etapas[etapa + 1] === 0);
    });

    res.json(pedidosFiltrados);
  } catch (error) {
    console.error('Erro ao buscar pedidos por status:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos por status' });
  }
});

export default router;