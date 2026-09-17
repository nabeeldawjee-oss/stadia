import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import path from "path";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "stadia-assets";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

export async function uploadBuffer(
  buffer: Buffer,
  originalName: string,
  folder = "uploads"
): Promise<string> {
  const ext = path.extname(originalName);
  const key = `${folder}/${randomUUID()}${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: getMimeType(ext),
    })
  );

  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFile(url: string): Promise<void> {
  const key = url.replace(`${PUBLIC_URL}/`, "");
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

function getMimeType(ext: string): string {
  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
  };
  return types[ext.toLowerCase()] || "application/octet-stream";
}
