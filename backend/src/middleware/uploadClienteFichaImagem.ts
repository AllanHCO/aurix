import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getUploadsBaseDir } from '../config/env';

const BASE = path.join(process.cwd(), getUploadsBaseDir(), 'cliente-ficha');
const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024;

function getExt(mimetype: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };
  return map[mimetype] || '';
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const clienteId = (req as any).params?.id;
    const dir = clienteId ? path.join(BASE, clienteId) : BASE;
    if (!fs.existsSync(BASE)) fs.mkdirSync(BASE, { recursive: true });
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = getExt(file.mimetype) || path.extname(file.originalname) || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Use imagem JPG, PNG ou WEBP.'));
  }
});

/** Path relativo: cliente-ficha/:clienteId/:arquivo */
export function multerClienteFichaImagem(req: any, res: any, next: any) {
  const single = upload.single('file');
  single(req, res, (err: any) => {
    if (err) return next(err);
    const file = req.file;
    if (file && req.params?.id) {
      (file as any).pathRelative = `cliente-ficha/${req.params.id}/${file.filename}`;
    }
    next();
  });
}
