import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getUploadsRootDir } from '../config/env';

const UPLOAD_DIR = path.join(getUploadsRootDir(), 'vendas');
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function getExt(mimetype: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };
  return map[mimetype] || '';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const vendaId = (req as any).params?.id;
    const dir = vendaId ? path.join(UPLOAD_DIR, vendaId) : UPLOAD_DIR;
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = getExt(file.mimetype) || path.extname(file.originalname) || '';
    const name = `${crypto.randomUUID()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo não permitido. Use PDF, JPG, PNG ou WEBP.'));
    }
  }
});

/** Salva em uploads/vendas/:vendaId/:uuid.ext e expõe path relativo (vendas/:vendaId/:nome) em req.file.pathRelative */
export function multerVendaAnexo(req: any, res: any, next: any) {
  const single = upload.single('file');
  single(req, res, (err: any) => {
    if (err) return next(err);
    const file = req.file;
    if (file && req.params?.id) {
      (file as any).pathRelative = `vendas/${req.params.id}/${file.filename}`;
    }
    next();
  });
}
