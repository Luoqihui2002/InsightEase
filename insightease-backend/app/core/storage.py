"""
存储服务 - 支持本地文件系统和阿里云 OSS
"""

import os
from typing import BinaryIO, Optional
from pathlib import Path


class StorageBackend:
    """存储后端抽象基类"""
    
    async def save(self, file_id: str, filename: str, file_data: bytes) -> str:
        """保存文件，返回存储路径/URL"""
        raise NotImplementedError
    
    async def exists(self, file_path: str) -> bool:
        """检查文件是否存在"""
        raise NotImplementedError
    
    async def read(self, file_path: str) -> bytes:
        """读取文件内容"""
        raise NotImplementedError
    
    async def delete(self, file_path: str) -> bool:
        """删除文件"""
        raise NotImplementedError
    
    def get_local_path(self, file_path: str) -> Optional[str]:
        """获取本地文件路径（用于FileResponse）"""
        raise NotImplementedError


class LocalStorage(StorageBackend):
    """本地文件系统存储（当前实现）"""
    
    def __init__(self, upload_dir: str = "./data/uploads"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    async def save(self, file_id: str, filename: str, file_data: bytes) -> str:
        """保存到本地目录"""
        safe_name = f"{file_id}_{filename.replace(' ', '_')}"
        filepath = self.upload_dir / safe_name
        
        with open(filepath, "wb") as f:
            f.write(file_data)
        
        return str(filepath)
    
    async def exists(self, file_path: str) -> bool:
        return Path(file_path).exists()
    
    async def read(self, file_path: str) -> bytes:
        with open(file_path, "rb") as f:
            return f.read()
    
    async def delete(self, file_path: str) -> bool:
        try:
            Path(file_path).unlink(missing_ok=True)
            return True
        except Exception:
            return False
    
    def get_local_path(self, file_path: str) -> Optional[str]:
        return file_path if Path(file_path).exists() else None


class AliyunOSSStorage(StorageBackend):
    """阿里云 OSS 存储（真正的云端存储）"""
    
    def __init__(self, access_key: str, secret_key: str, bucket: str, endpoint: str):
        try:
            import oss2
            self.auth = oss2.Auth(access_key, secret_key)
            self.bucket = oss2.Bucket(self.auth, endpoint, bucket)
            self.bucket_name = bucket
            self.endpoint = endpoint
        except ImportError:
            raise RuntimeError("请安装 oss2: pip install oss2")
    
    async def save(self, file_id: str, filename: str, file_data: bytes) -> str:
        """上传到 OSS"""
        object_key = f"datasets/{file_id}_{filename}"
        self.bucket.put_object(object_key, file_data)
        # 返回 OSS URL
        return f"oss://{self.bucket_name}/{object_key}"
    
    async def exists(self, file_path: str) -> bool:
        """检查 OSS 对象是否存在"""
        if file_path.startswith("oss://"):
            object_key = file_path.replace(f"oss://{self.bucket_name}/", "")
            return self.bucket.object_exists(object_key)
        return False
    
    async def read(self, file_path: str) -> bytes:
        """从 OSS 下载"""
        if file_path.startswith("oss://"):
            object_key = file_path.replace(f"oss://{self.bucket_name}/", "")
            return self.bucket.get_object(object_key).read()
        raise ValueError(f"Invalid OSS path: {file_path}")
    
    async def delete(self, file_path: str) -> bool:
        """从 OSS 删除"""
        try:
            if file_path.startswith("oss://"):
                object_key = file_path.replace(f"oss://{self.bucket_name}/", "")
                self.bucket.delete_object(object_key)
                return True
            return False
        except Exception:
            return False
    
    def get_local_path(self, file_path: str) -> Optional[str]:
        """
        OSS 文件没有本地路径
        需要先下载到临时目录再返回路径
        """
        # TODO: 可以下载到临时文件后返回
        return None
    
    def get_download_url(self, file_path: str, expires: int = 3600) -> str:
        """获取 OSS 临时下载链接"""
        if file_path.startswith("oss://"):
            object_key = file_path.replace(f"oss://{self.bucket_name}/", "")
            return self.bucket.sign_url('GET', object_key, expires)
        return file_path


def get_storage() -> StorageBackend:
    """获取配置的存储后端"""
    from app.core.config import settings
    
    # 检查是否配置了 OSS
    oss_access_key = os.getenv("OSS_ACCESS_KEY_ID")
    oss_secret_key = os.getenv("OSS_ACCESS_KEY_SECRET")
    oss_bucket = os.getenv("OSS_BUCKET_NAME")
    oss_endpoint = os.getenv("OSS_ENDPOINT")
    
    if all([oss_access_key, oss_secret_key, oss_bucket, oss_endpoint]):
        return AliyunOSSStorage(
            access_key=oss_access_key,
            secret_key=oss_secret_key,
            bucket=oss_bucket,
            endpoint=oss_endpoint
        )
    
    # 默认使用本地存储
    return LocalStorage(upload_dir=settings.UPLOAD_DIR)


# 全局存储实例
storage = get_storage()
