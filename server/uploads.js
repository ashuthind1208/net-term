import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import multer from 'multer'

const requestedMaxSize = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB || 25)
const maxSizeMb = Number.isFinite(requestedMaxSize) && requestedMaxSize > 0 ? requestedMaxSize : 25

export const uploadsDirectory = resolve(process.env.UPLOADS_DIR || 'uploads')

const storage = multer.diskStorage({
  destination(_req, _file, done) {
    mkdir(uploadsDirectory, { recursive: true })
      .then(() => done(null, uploadsDirectory))
      .catch(done)
  },
  filename(_req, file, done) {
    const extension = extname(file.originalname).toLowerCase()
    const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ''
    done(null, `${randomUUID()}${safeExtension}`)
  },
})

export const uploadSingle = multer({
  storage,
  limits: { fileSize: maxSizeMb * 1024 * 1024, files: 1 },
}).single('file')
