const crypto = require('crypto');

// ENCRYPTION_KEY phải được khai báo trong file .env. Nếu không có, dùng key mặc định cố định.
// QUAN TRỌNG: Key phải chính xác 32 bytes (ký tự ASCII) cho aes-256-cbc
const RAW_KEY = process.env.ENCRYPTION_KEY || 'pmcax_default_secret_key_32bytes';
const ENCRYPTION_KEY = Buffer.from(RAW_KEY.padEnd(32, '0').slice(0, 32));
const ALGORITHM = 'aes-256-cbc';

function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    return text;
  }
}

function decrypt(text) {
  if (!text) return text;
  // If it doesn't look like an encrypted string (IV:encryptedData format), return as is
  if (!text.includes(':')) return text;
  
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // If decryption fails, assume it was plain text that happened to have a colon, or old data
    return text;
  }
}

module.exports = { encrypt, decrypt };
