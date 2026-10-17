import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import * as adminModel from '../models/adminModel.js';
import * as settingsModel from '../models/settingsModel.js';
import * as singerModel from '../models/singerModel.js';
import { ApiError } from '../middlewares/errors.js';

export const defaultUploadsDirectory = fileURLToPath(
  new URL('../../uploads/', import.meta.url)
);

const allowedImageFormats = new Set(['jpeg', 'png', 'webp']);
const singerNameMaxLength = 255;

function normalizeSingerName(name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Singer name is required');
  }
  const normalizedName = name.trim();
  if (normalizedName.length > singerNameMaxLength) {
    throw new ApiError(400, 'Singer name must be 255 characters or fewer');
  }
  return normalizedName;
}

function imageFilenameFromUrl(imageUrl) {
  const filename = path.basename(imageUrl || '');
  return /^[0-9a-f-]{36}\.webp$/i.test(filename) ? filename : null;
}

async function removeImage(imageUrl, uploadsDirectory) {
  const filename = imageFilenameFromUrl(imageUrl);
  if (!filename) {
    return;
  }

  try {
    await unlink(path.join(uploadsDirectory, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function processImage(file, uploadsDirectory) {
  if (!file?.buffer) {
    throw new ApiError(400, 'Singer image is required');
  }

  let output;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!allowedImageFormats.has(metadata.format)) {
      throw new ApiError(400, 'Only JPG, PNG, and WebP images are allowed');
    }
    output = await image
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(400, 'Uploaded file is not a valid JPG, PNG, or WebP image');
  }

  const filename = `${randomUUID()}.webp`;
  await mkdir(uploadsDirectory, { recursive: true });
  await writeFile(path.join(uploadsDirectory, filename), output, { flag: 'wx' });
  return { filename, imageUrl: `/uploads/${filename}` };
}

export async function login(pool, username, password, jwtSecret = process.env.JWT_SECRET) {
  if (!jwtSecret) {
    throw new ApiError(500, 'Admin authentication is not configured');
  }

  const admin = await adminModel.findByUsername(pool, username);
  const passwordMatches = admin
    ? await bcrypt.compare(password, admin.password_hash)
    : false;
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const token = jwt.sign(
    { username: admin.username },
    jwtSecret,
    { subject: String(admin.id), expiresIn: '8h' }
  );
  return token;
}

export async function getResults(pool) {
  return singerModel.findAllResults(pool);
}

export async function setVotingStatus(pool, isOpen) {
  await settingsModel.setValueByKey(pool, 'is_voting_open', String(isOpen));
}

export async function createSinger(pool, name, file, uploadsDirectory = defaultUploadsDirectory) {
  const normalizedName = normalizeSingerName(name);
  const image = await processImage(file, uploadsDirectory);

  try {
    const id = await singerModel.create(pool, normalizedName, image.imageUrl);
    return { id, name: normalizedName, image_url: image.imageUrl };
  } catch (error) {
    await removeImage(image.imageUrl, uploadsDirectory);
    throw error;
  }
}

export async function updateSinger(
  pool,
  singerId,
  name,
  file,
  uploadsDirectory = defaultUploadsDirectory
) {
  const existingSinger = await singerModel.findById(pool, singerId);
  if (!existingSinger) {
    throw new ApiError(404, 'Singer not found');
  }
  if (name === undefined && !file) {
    throw new ApiError(400, 'Provide a singer name or image to update');
  }

  const normalizedName = name === undefined ? existingSinger.name : normalizeSingerName(name);
  const newImage = file ? await processImage(file, uploadsDirectory) : null;

  try {
    await singerModel.update(
      pool,
      singerId,
      normalizedName,
      newImage?.imageUrl ?? existingSinger.image_url
    );
  } catch (error) {
    if (newImage) {
      await removeImage(newImage.imageUrl, uploadsDirectory);
    }
    throw error;
  }

  if (newImage) {
    await removeImage(existingSinger.image_url, uploadsDirectory);
  }

  return {
    id: singerId,
    name: normalizedName,
    image_url: newImage?.imageUrl ?? existingSinger.image_url
  };
}

export async function deleteSinger(pool, singerId, uploadsDirectory = defaultUploadsDirectory) {
  const existingSinger = await singerModel.findById(pool, singerId);
  if (!existingSinger) {
    throw new ApiError(404, 'Singer not found');
  }

  await singerModel.deleteById(pool, singerId);
  await removeImage(existingSinger.image_url, uploadsDirectory);
}
