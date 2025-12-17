"""
Storage management for ingested data.

Handles writing data to the raw zone with:
- NDJSON format for streaming processing
- Partitioning by source and date
- Atomic writes for data integrity
"""

import gzip
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator, Optional

logger = logging.getLogger(__name__)


class StorageManager:
    """Manages storage of raw ingested data."""
    
    def __init__(self, base_path: str, compress: bool = True):
        """
        Initialize the storage manager.
        
        Args:
            base_path: Base directory for raw data storage
            compress: Whether to gzip compress output files
        """
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.compress = compress
        self._file_handles: dict[str, Any] = {}
        self._record_counts: dict[str, int] = {}
    
    def _get_partition_path(
        self,
        source: str,
        ingest_date: Optional[datetime] = None
    ) -> Path:
        """
        Get the partition path for a source and date.
        
        Args:
            source: Source name (e.g., 'arxiv')
            ingest_date: Date for partitioning (defaults to today)
            
        Returns:
            Path to the partition directory
        """
        if ingest_date is None:
            ingest_date = datetime.utcnow()
            
        partition = self.base_path / source / f"ingest_date={ingest_date.strftime('%Y-%m-%d')}"
        partition.mkdir(parents=True, exist_ok=True)
        return partition
    
    def _get_file_path(
        self,
        source: str,
        batch_id: str,
        ingest_date: Optional[datetime] = None
    ) -> Path:
        """
        Get the file path for a batch.
        
        Args:
            source: Source name
            batch_id: Unique batch identifier
            ingest_date: Date for partitioning
            
        Returns:
            Path to the output file
        """
        partition = self._get_partition_path(source, ingest_date)
        extension = '.ndjson.gz' if self.compress else '.ndjson'
        return partition / f"{batch_id}{extension}"
    
    def write_records(
        self,
        source: str,
        records: list[dict[str, Any]],
        batch_id: str,
        ingest_date: Optional[datetime] = None
    ) -> int:
        """
        Write a batch of records to storage.
        
        Args:
            source: Source name
            records: List of records to write
            batch_id: Unique batch identifier
            ingest_date: Date for partitioning
            
        Returns:
            Number of records written
        """
        if not records:
            return 0
            
        file_path = self._get_file_path(source, batch_id, ingest_date)
        temp_path = file_path.with_suffix('.tmp')
        
        try:
            # Write to temp file first
            open_func = gzip.open if self.compress else open
            mode = 'wt' if self.compress else 'w'
            
            with open_func(temp_path, mode, encoding='utf-8') as f:
                for record in records:
                    # Add metadata
                    record['_ingested_at'] = datetime.utcnow().isoformat()
                    record['_source'] = source
                    record['_batch_id'] = batch_id
                    
                    json.dump(record, f, ensure_ascii=False)
                    f.write('\n')
            
            # Atomic rename
            temp_path.rename(file_path)
            
            logger.debug(f"Wrote {len(records)} records to {file_path}")
            return len(records)
            
        except Exception as e:
            logger.error(f"Failed to write records: {e}")
            if temp_path.exists():
                temp_path.unlink()
            raise
    
    def write_record_stream(
        self,
        source: str,
        records: Iterator[dict[str, Any]],
        batch_id: str,
        ingest_date: Optional[datetime] = None,
        flush_interval: int = 100
    ) -> int:
        """
        Write a stream of records to storage.
        
        Args:
            source: Source name
            records: Iterator of records
            batch_id: Unique batch identifier
            ingest_date: Date for partitioning
            flush_interval: Flush to disk every N records
            
        Returns:
            Number of records written
        """
        file_path = self._get_file_path(source, batch_id, ingest_date)
        temp_path = file_path.with_suffix('.tmp')
        
        count = 0
        open_func = gzip.open if self.compress else open
        mode = 'wt' if self.compress else 'w'
        
        try:
            with open_func(temp_path, mode, encoding='utf-8') as f:
                for record in records:
                    record['_ingested_at'] = datetime.utcnow().isoformat()
                    record['_source'] = source
                    record['_batch_id'] = batch_id
                    
                    json.dump(record, f, ensure_ascii=False)
                    f.write('\n')
                    count += 1
                    
                    if count % flush_interval == 0:
                        f.flush()
            
            temp_path.rename(file_path)
            logger.info(f"Wrote {count} records to {file_path}")
            return count
            
        except Exception as e:
            logger.error(f"Failed to write record stream: {e}")
            if temp_path.exists():
                temp_path.unlink()
            raise
    
    def list_files(
        self,
        source: str,
        ingest_date: Optional[datetime] = None
    ) -> list[Path]:
        """
        List all files for a source and optional date.
        
        Args:
            source: Source name
            ingest_date: Optional date filter
            
        Returns:
            List of file paths
        """
        if ingest_date:
            partition = self._get_partition_path(source, ingest_date)
            return list(partition.glob('*.ndjson*'))
        else:
            source_path = self.base_path / source
            return list(source_path.glob('**/*.ndjson*'))
    
    def read_records(
        self,
        file_path: Path
    ) -> Iterator[dict[str, Any]]:
        """
        Read records from a file.
        
        Args:
            file_path: Path to the file
            
        Yields:
            Records from the file
        """
        open_func = gzip.open if file_path.suffix == '.gz' else open
        mode = 'rt' if file_path.suffix == '.gz' else 'r'
        
        with open_func(file_path, mode, encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    yield json.loads(line)
    
    def get_stats(self, source: str) -> dict[str, Any]:
        """
        Get statistics for a source.
        
        Args:
            source: Source name
            
        Returns:
            Statistics dictionary
        """
        files = self.list_files(source)
        total_size = sum(f.stat().st_size for f in files)
        
        return {
            'source': source,
            'file_count': len(files),
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'partitions': len(set(f.parent for f in files))
        }

