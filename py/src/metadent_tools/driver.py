from abc import ABC, abstractmethod
from typing import Optional
from pathlib import Path
from lfss.api import Client
import json

class PathWrapper(str):

    def __truediv__(self, other: str) -> "PathWrapper":
        if self.endswith("/"):
            return PathWrapper(f"{self}{other}")
        return PathWrapper(f"{self}/{other}")
    
    def __rtruediv__(self, other: str) -> "PathWrapper":
        if self.startswith("/"):
            return PathWrapper(f"{other}{self}")
        return PathWrapper(f"{other}/{self}")
    
    def __itruediv__(self, other: str) -> "PathWrapper":
        if self.endswith("/"):
            return PathWrapper(f"{self}{other}")
        return self.__truediv__(other)


class DriverAbstract(ABC):
    image_dir: PathWrapper
    meta_dir: PathWrapper

    @abstractmethod
    def exists(self, file_path: PathWrapper) -> bool: ...

    @abstractmethod
    def read_bytes(self, file_path: PathWrapper) -> bytes: ...

    def read_text(self, file_path: PathWrapper) -> str:
        return self.read_bytes(file_path).decode("utf-8")
    
    def read_json(self, file_path: PathWrapper) -> dict:
        return json.loads(self.read_text(file_path))

class LocalDriver(DriverAbstract):
    def __init__(self, image_dir: str, meta_dir: str):
        self.image_dir = PathWrapper(image_dir)
        self.meta_dir = PathWrapper(meta_dir)
    
    def exists(self, file_path: PathWrapper) -> bool:
        return Path(file_path).exists()

    def read_bytes(self, file_path: PathWrapper) -> bytes:
        with open(Path(file_path), "rb") as f:
            return f.read()

class LFSSDriver(DriverAbstract):
    def __init__(
        self, 
        image_dir: str, 
        meta_dir: str, 
        client: Optional[Client] = None
        ):
        self.client = client or Client()
        self.image_dir = PathWrapper(image_dir)
        self.meta_dir = PathWrapper(meta_dir)
    
    def exists(self, file_path: PathWrapper) -> bool:
        return self.client.exists(file_path)

    def read_bytes(self, file_path: PathWrapper) -> bytes:
        return self.client.get(file_path)