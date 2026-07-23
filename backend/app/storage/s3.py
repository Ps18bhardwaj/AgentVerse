"""S3-compatible object storage provider (AWS S3, Cloudflare R2, Supabase Storage)."""
from __future__ import annotations

import os
import logging
from typing import Optional

from .base import BaseStorageProvider

logger = logging.getLogger(__name__)


class S3StorageProvider(BaseStorageProvider):
    """S3-compatible storage implementation using boto3."""

    def __init__(self):
        import boto3
        from botocore.config import Config

        self.bucket = os.getenv("S3_BUCKET", "agentverse-uploads")
        self.region = os.getenv("S3_REGION", "us-east-1")
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL") or None  # R2 or Supabase custom endpoint
        access_key = os.getenv("S3_ACCESS_KEY")
        secret_key = os.getenv("S3_SECRET_KEY")

        s3_config = Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        )

        self.client = boto3.client(
            "s3",
            region_name=self.region,
            endpoint_url=self.endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=s3_config,
        )
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception as e:
            logger.info(f"S3 bucket '{self.bucket}' check: {e}. Attempting auto-creation...")
            try:
                if self.region == "us-east-1":
                    self.client.create_bucket(Bucket=self.bucket)
                else:
                    self.client.create_bucket(
                        Bucket=self.bucket,
                        CreateBucketConfiguration={"LocationConstraint": self.region},
                    )
            except Exception as create_err:
                logger.warning(f"Could not auto-create S3 bucket '{self.bucket}': {create_err}")

    def save_file(self, filename: str, content: bytes, content_type: Optional[str] = None) -> str:
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type

        self.client.put_object(
            Bucket=self.bucket,
            Key=filename,
            Body=content,
            **extra_args,
        )
        logger.info(f"S3 storage: uploaded '{filename}' ({len(content)} bytes) to bucket '{self.bucket}'")
        return filename

    def get_file(self, file_key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=file_key)
        return response["Body"].read()

    def delete_file(self, file_key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=file_key)
        logger.info(f"S3 storage: deleted '{file_key}' from bucket '{self.bucket}'")

    def exists(self, file_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=file_key)
            return True
        except Exception:
            return False

    def get_file_url(self, file_key: str, expires_in: int = 3600) -> Optional[str]:
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": file_key},
                ExpiresIn=expires_in,
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate S3 presigned URL for '{file_key}': {e}")
            return None
