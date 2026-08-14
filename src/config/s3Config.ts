export const bucketName = () => process.env.AWS_S3_BUCKET || ''
import { S3Client } from '@aws-sdk/client-s3'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
dotenv.config()

// Ensure environment variables are defined at runtime
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
const region = process.env.AWS_REGION

if (!accessKeyId || !secretAccessKey || !region) {
  throw new Error('Missing AWS credentials or region in environment variables.')
}

export const s3Client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
  maxAttempts: 3,
})

type ItemWithNombreAws = {
  nombre_aws?: string
  [key: string]: any // allows other properties too
}

export async function uploadFileToS3(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  s3Folder: string = '',
): Promise<string> {
  const bucketName = process.env.AWS_BUCKET_NAME
  const key = s3Folder + fileName

  try {
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    }

    const command = new PutObjectCommand(uploadParams)
    await s3Client.send(command)

    return key // Return the S3 key for the uploaded file
  } catch (error) {
    console.error('Error uploading file to S3:', error)
    throw new Error('Error uploading file to S3')
  }
}

export async function uploadWhatsAppMedia(
  mediaBuffer: Buffer,
  originalFileName: string,
  mimeType: string,
  messageId: string,
): Promise<string> {
  // Generate a unique filename using messageId and timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const extension = originalFileName.split('.').pop() || mimeType.split('/')[1] || 'bin'
  const fileName = `whatsapp_${messageId}_${timestamp}.${extension}`

  const s3Key = await uploadFileToS3(
    mediaBuffer,
    fileName,
    mimeType,
    'whatsapp/', // Changed from 'whatsapp-media/' to 'whatsapp/'
  )

  return s3Key
}
