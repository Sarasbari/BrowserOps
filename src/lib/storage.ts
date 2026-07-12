import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadminpassword",
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || true,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "browserops-artifacts";

// Helper to ensure the bucket exists (useful for local MinIO setup)
let bucketInitialized = false;
async function ensureBucketExists() {
  if (bucketInitialized) return;
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    bucketInitialized = true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        bucketInitialized = true;
        console.log(`[Storage] Created bucket: ${BUCKET_NAME}`);
      } catch (createErr) {
        console.error(`[Storage] Failed to create bucket ${BUCKET_NAME}:`, createErr);
      }
    } else {
      console.error("[Storage] HeadBucket check failed:", err);
    }
  }
}

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<string> {
  await ensureBucketExists();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: typeof body === "string" ? Buffer.from(body, "utf-8") : body,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return key;
}

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  await ensureBucketExists();

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

export async function deleteFile(key: string): Promise<void> {
  await ensureBucketExists();

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}
export { BUCKET_NAME };
