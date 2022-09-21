import dotenv from "dotenv";

import { UpdateBucketCommand, UpdateBucketInput } from "@stedi/sdk-client-buckets";

import { bucketClient } from "../lib/buckets.js";

dotenv.config({ override: true });

(async () => {
  const bucketName = process.env["SFTP_BUCKET_NAME"]
  if (!bucketName) throw new Error("SFTP_BUCKET_NAME required");

  const enableBucketNotificationsArgs: UpdateBucketInput = {
    bucketName,
    notifications: {
      functions: [{ functionName: "read-inbound-edi" }],
    }
  }

  await bucketClient().send(new UpdateBucketCommand(enableBucketNotificationsArgs));
})();