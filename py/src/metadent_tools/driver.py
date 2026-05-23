from abc import ABC, abstractmethod
from typing import Optional
from typing_extensions import override
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
    
    def parent(self) -> "PathWrapper":
        split = self.rsplit("/", 1)
        if len(split) == 1:
            return PathWrapper("")
        return PathWrapper(split[0])


class DriverAbstract(ABC):
    image_dir: PathWrapper
    meta_dir: PathWrapper

    @abstractmethod
    def exists(self, file_path: PathWrapper) -> bool: ...

    @abstractmethod
    def read_bytes(self, file_path: PathWrapper) -> bytes: ...

    @abstractmethod
    def write_bytes(self, file_path: PathWrapper, data: bytes) -> None: 
        """ Write bytes data to the given file path. If the file already exists, it will be overwritten.  """
        ...

    @abstractmethod
    def delete(self, file_path: PathWrapper) -> None: 
        """ Delete a file/dir if exists. If the path does not exist, do nothing.  """
        ...

    @abstractmethod
    def check_many(
        self, 
        file_paths: list[PathWrapper], 
        read_text: bool = False
        ) -> dict[PathWrapper, Optional[str]]: 
        """
        check existence of multiple files, and optionally read text content if exists.
         - if read_text is False, the value in the returned dict will be '' if exists, or None if not exists.
         - if read_text is True, the value in the returned dict will be the text content if exists, or None if not exists.
        """
        ...

    def on_connect(self):
        pass
    
    def on_disconnect(self):
        pass
    
    def _maybe_connect(self):
        if hasattr(self, "_connected") and self._connected:
            return
        self.on_connect()
        self._connected = True
    
    def _maybe_disconnect(self):
        if hasattr(self, "_connected") and self._connected:
            self.on_disconnect()
            self._connected = False
        else:
            raise RuntimeError("Driver is not connected")

    def read_text(self, file_path: PathWrapper) -> str:
        return self.read_bytes(file_path).decode("utf-8")
    
    def read_json(self, file_path: PathWrapper) -> dict:
        return json.loads(self.read_text(file_path))

    def write_text(self, file_path: PathWrapper, data: str) -> None:
        self.write_bytes(file_path, data.encode("utf-8"))
    
    def write_json(self, file_path: PathWrapper, data: dict, indent: Optional[int] = None) -> None:
        self.write_text(file_path, json.dumps(data, ensure_ascii=False, indent=indent))

class LocalDriver(DriverAbstract):
    def __init__(self, image_dir: str, meta_dir: str):
        self.image_dir = PathWrapper(image_dir)
        self.meta_dir = PathWrapper(meta_dir)
    
    @override
    def on_connect(self):
        Path(self.image_dir).mkdir(exist_ok=True)
        Path(self.meta_dir).mkdir(exist_ok=True)
    
    def check_many(
        self, 
        file_paths: list[PathWrapper], 
        read_text: bool = False
        ) -> dict[PathWrapper, Optional[str]]: 
        result = {}
        for file_path in file_paths:
            full_path = Path(file_path)
            if full_path.exists():
                if read_text:
                    with open(full_path, "r", encoding="utf-8") as f:
                        result[file_path] = f.read()
                else:
                    result[file_path] = ''
            else:
                result[file_path] = None
        return result
    
    def exists(self, file_path: PathWrapper) -> bool:
        return Path(file_path).exists()

    def read_bytes(self, file_path: PathWrapper) -> bytes:
        with open(Path(file_path), "rb") as f:
            return f.read()
    
    def write_bytes(self, file_path: PathWrapper, data: bytes) -> None:
        if not Path(file_path).parent.exists():
            Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        with open(Path(file_path), "wb") as f:
            f.write(data)
    
    def delete(self, file_path: PathWrapper) -> None:
        Path(file_path).unlink(missing_ok=True)

class LFSSDriver(DriverAbstract):
    def __init__(
        self, 
        image_dir: str, 
        meta_dir: str, 
        client: Optional[Client] = None
        ):
        self.client = client if client is not None else Client()
        self.image_dir = PathWrapper(image_dir)
        self.meta_dir = PathWrapper(meta_dir)
    
    @override
    def on_connect(self):
        self.__session = self.client.session()
        self.__session.__enter__()
    
    @override
    def on_disconnect(self):
        self.__session.__exit__(None, None, None)
    
    def check_many(
        self, 
        file_paths: list[PathWrapper], 
        read_text: bool = False
        ) -> dict[PathWrapper, Optional[str]]:
        r = self.client.get_multiple_text(*map(str, file_paths), skip_content = not read_text)
        return {PathWrapper(k): v for k, v in r.items()}
    
    def exists(self, file_path: PathWrapper) -> bool:
        return self.client.exists(str(file_path))

    def read_bytes(self, file_path: PathWrapper) -> bytes:
        return self.client.get(str(file_path))
    
    def write_bytes(self, file_path: PathWrapper, data: bytes) -> None:
        self.client.put(str(file_path), data, conflict = 'overwrite')
    
    def delete(self, file_path: PathWrapper) -> None:
        if self.client.exists(str(file_path)):
            self.client.delete(str(file_path))