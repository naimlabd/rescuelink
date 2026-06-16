from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class NotificationLog:
    def __init__(self, directory: Path) -> None:
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)

    def emit(self, stream: str, payload: dict[str, Any]) -> None:
        target = self.directory / f"{stream}.jsonl"
        with target.open("a", encoding="utf-8") as file_handle:
            file_handle.write(json.dumps(payload, ensure_ascii=True) + "\n")

    def tail(self, stream: str, limit: int = 10) -> list[dict[str, Any]]:
        target = self.directory / f"{stream}.jsonl"
        if not target.exists():
            return []

        with target.open("r", encoding="utf-8") as file_handle:
            lines = [line.strip() for line in file_handle.readlines() if line.strip()]

        entries: list[dict[str, Any]] = []
        for line in lines[-limit:]:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return entries

    def count(self, stream: str) -> int:
        target = self.directory / f"{stream}.jsonl"
        if not target.exists():
            return 0

        with target.open("r", encoding="utf-8") as file_handle:
            return sum(1 for line in file_handle if line.strip())
