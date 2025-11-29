import express from 'express';
import { PrismaClient } from '../generated/prisma/index.js';

const router = express.Router();
const prisma = new PrismaClient();

// ✅ Criar novo endereço
router.post('/addresses', async (req, res) => {
  try {
    const { userId, cep, cidade, estado, bairro, rua, numero, complemento } = req.body;

    // Validação básica
    if (!userId || !cep || !cidade || !estado || !bairro || !rua || !numero) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: userId, cep, cidade, estado, bairro, rua, numero' 
      });
    }

    const address = await prisma.address.create({
      data: {
        userId,
        cep,
        cidade,
        estado,
        bairro,
        rua,
        numero,
        complemento: complemento || null
      }
    });

    res.status(201).json(address);
  } catch (error) {
    console.error('Erro ao criar endereço:', error);
    res.status(500).json({ error: 'Erro ao criar endereço' });
  }
});

// ✅ Listar todos os endereços de um usuário
router.get('/users/:userId/addresses', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(addresses);
  } catch (error) {
    console.error('Erro ao buscar endereços:', error);
    res.status(500).json({ error: 'Erro ao buscar endereços' });
  }
});

// ✅ Buscar um endereço específico
router.get('/addresses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const address = await prisma.address.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!address) {
      return res.status(404).json({ error: 'Endereço não encontrado' });
    }

    res.json(address);
  } catch (error) {
    console.error('Erro ao buscar endereço:', error);
    res.status(500).json({ error: 'Erro ao buscar endereço' });
  }
});

// ✅ Atualizar endereço
router.put('/addresses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { cep, cidade, estado, bairro, rua, numero, complemento } = req.body;

    // Verifica se o endereço existe
    const existingAddress = await prisma.address.findUnique({
      where: { id }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Endereço não encontrado' });
    }

    const address = await prisma.address.update({
      where: { id },
      data: {
        cep: cep || existingAddress.cep,
        cidade: cidade || existingAddress.cidade,
        estado: estado || existingAddress.estado,
        bairro: bairro || existingAddress.bairro,
        rua: rua || existingAddress.rua,
        numero: numero || existingAddress.numero,
        complemento: complemento !== undefined ? complemento : existingAddress.complemento
      }
    });

    res.json(address);
  } catch (error) {
    console.error('Erro ao atualizar endereço:', error);
    res.status(500).json({ error: 'Erro ao atualizar endereço' });
  }
});

// ✅ Deletar endereço
router.delete('/addresses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Verifica se o endereço existe
    const existingAddress = await prisma.address.findUnique({
      where: { id }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Endereço não encontrado' });
    }

    await prisma.address.delete({
      where: { id }
    });

    res.json({ message: 'Endereço deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar endereço:', error);
    res.status(500).json({ error: 'Erro ao deletar endereço' });
  }
});

export default router;