import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  nome: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha é obrigatória')
});

export const register = async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);

  // Verificar se usuário já existe
  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email: data.email }
  });

  if (usuarioExistente) {
    throw new AppError('Email já cadastrado', 400);
  }

  // Hash da senha
  const senhaHash = await bcrypt.hash(data.senha, 10);

  // Criar usuário
  const usuario = await prisma.usuario.create({
    data: {
      email: data.email,
      senha: senhaHash,
      nome: data.nome
    },
    select: {
      id: true,
      email: true,
      nome: true,
      createdAt: true
    }
  });

  // Gerar token (exige JWT_SECRET em produção)
  const secret = process.env.JWT_SECRET?.trim() || '';
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new AppError('Configuração do servidor incompleta (JWT_SECRET)', 500);
  }
  const token = jwt.sign(
    { userId: usuario.id },
    secret || 'default-secret-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  res.status(201).json({
    usuario,
    token
  });
};

export const login = async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);

  // Buscar usuário
  const usuario = await prisma.usuario.findUnique({
    where: { email: data.email }
  });

  if (!usuario) {
    throw new AppError('Email ou senha inválidos', 401);
  }

  // Verificar senha
  const senhaValida = await bcrypt.compare(data.senha, usuario.senha);

  if (!senhaValida) {
    throw new AppError('Email ou senha inválidos', 401);
  }

  // Gerar token (exige JWT_SECRET em produção)
  const secret = process.env.JWT_SECRET?.trim() || '';
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new AppError('Configuração do servidor incompleta (JWT_SECRET)', 500);
  }
  const token = jwt.sign(
    { userId: usuario.id },
    secret || 'default-secret-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  res.json({
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome
    },
    token
  });
};
