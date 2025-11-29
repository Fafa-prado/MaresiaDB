import bcrypt from 'bcrypt';
import createError from 'http-errors';
import express from 'express';
import jwt from 'jsonwebtoken';
import ms from 'ms';

import { PrismaClient } from '#generated/prisma/index.js';
import verifyToken from '#middlewares/verifyToken.js';

const prisma = new PrismaClient();
const router = express.Router();

// Helper function to format user response (exclude password)
const formatUserResponse = (user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    birthdate: user.birthdate,
    cpf: user.cpf,
    gender: user.gender,
    phone: user.phone,
    createdAt: user.createdAt,
});

router.post('/register', async (req, res, next) => {
    const { name, username, password, email, birthdate, cpf, gender, phone } = req.body;

    if (!name || !username || !password || !email || !birthdate) {
        return next(createError(400, 'Name, username, password, email and birthdate are required'));
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
        return next(createError(409, 'The username is already in use'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
        data: {
            name,
            username,
            email,
            password: hashedPassword,
            birthdate,
            cpf,
            gender,
            phone,
        },
    });

    res.status(201).json({
        message: 'User successfully registered',
        user: formatUserResponse(newUser)
    });
});

router.post('/login', async (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return next(createError(400, 'Username and password are required'));
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        return next(createError(401, 'Invalid username or password'));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return next(createError(401, 'Invalid username or password'));
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: ms(process.env.JWT_EXPIRES_IN),
    });

    res.json({
        message: 'Login successful',
        user: formatUserResponse(user)
    });
});

router.post('/logout', async (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout successful' });
});

router.put('/update', verifyToken, async (req, res, next) => {
    const { name, email, birthdate, cpf, gender, phone } = req.body;
    const userId = req.user.id;

    if (!userId) {
        return next(createError(400, 'User ID is required from token'));
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(birthdate && { birthdate }),
                ...(cpf && { cpf }),
                ...(gender && { gender }),
                ...(phone && { phone }),
            },
        });

        res.json({
            message: 'Profile updated successfully',
            user: formatUserResponse(updatedUser)
        });
    } catch (error) {
        next(createError(500, 'Error updating profile'));
    }
});

router.get('/me', verifyToken, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });

        if (!user) {
            return next(createError(404, 'User not found'));
        }

        res.json({
            message: 'Current user fetched successfully',
            user: formatUserResponse(user)
        });
    } catch (error) {
        next(createError(500, 'Error fetching user'));
    }
});

export default router;
