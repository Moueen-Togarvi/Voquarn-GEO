export type BlobDriver = {
  put(objectKey: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(objectKey: string): Promise<Buffer>;
};
