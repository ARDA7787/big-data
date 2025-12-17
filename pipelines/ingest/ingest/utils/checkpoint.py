"""
Checkpoint management for resumable ingestion.

Provides persistent state tracking to enable:
- Resume from interruption
- Incremental ingestion
- Progress tracking
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class CheckpointManager:
    """Manages checkpoints for resumable ingestion."""
    
    def __init__(self, checkpoint_dir: str):
        """
        Initialize the checkpoint manager.
        
        Args:
            checkpoint_dir: Directory to store checkpoint files
        """
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, dict[str, Any]] = {}
    
    def _get_checkpoint_path(self, source: str) -> Path:
        """Get the checkpoint file path for a source."""
        return self.checkpoint_dir / f"{source}_checkpoint.json"
    
    def get_checkpoint(self, source: str) -> Optional[dict[str, Any]]:
        """
        Get the latest checkpoint for a source.
        
        Args:
            source: Source name (e.g., 'arxiv', 'pubmed')
            
        Returns:
            Checkpoint data or None if no checkpoint exists
        """
        if source in self._cache:
            return self._cache[source]
            
        checkpoint_path = self._get_checkpoint_path(source)
        
        if not checkpoint_path.exists():
            return None
            
        try:
            with open(checkpoint_path, 'r') as f:
                checkpoint = json.load(f)
                self._cache[source] = checkpoint
                return checkpoint
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to load checkpoint for {source}: {e}")
            return None
    
    def save_checkpoint(
        self,
        source: str,
        cursor: str,
        records_processed: int,
        metadata: Optional[dict[str, Any]] = None
    ) -> None:
        """
        Save a checkpoint for a source.
        
        Args:
            source: Source name
            cursor: Pagination cursor or offset
            records_processed: Total records processed so far
            metadata: Additional metadata to store
        """
        checkpoint = {
            'source': source,
            'cursor': cursor,
            'records_processed': records_processed,
            'last_updated': datetime.utcnow().isoformat(),
            'metadata': metadata or {}
        }
        
        checkpoint_path = self._get_checkpoint_path(source)
        
        try:
            # Write atomically using temp file
            temp_path = checkpoint_path.with_suffix('.tmp')
            with open(temp_path, 'w') as f:
                json.dump(checkpoint, f, indent=2)
            temp_path.rename(checkpoint_path)
            
            self._cache[source] = checkpoint
            logger.debug(f"Saved checkpoint for {source}: {records_processed} records")
            
        except IOError as e:
            logger.error(f"Failed to save checkpoint for {source}: {e}")
            raise
    
    def clear_checkpoint(self, source: str) -> None:
        """
        Clear the checkpoint for a source.
        
        Args:
            source: Source name
        """
        checkpoint_path = self._get_checkpoint_path(source)
        
        if checkpoint_path.exists():
            checkpoint_path.unlink()
            
        if source in self._cache:
            del self._cache[source]
            
        logger.info(f"Cleared checkpoint for {source}")
    
    def get_progress(self, source: str) -> tuple[int, Optional[str]]:
        """
        Get the current progress for a source.
        
        Args:
            source: Source name
            
        Returns:
            Tuple of (records_processed, cursor)
        """
        checkpoint = self.get_checkpoint(source)
        
        if checkpoint:
            return checkpoint['records_processed'], checkpoint['cursor']
        return 0, None
    
    def list_checkpoints(self) -> list[dict[str, Any]]:
        """
        List all available checkpoints.
        
        Returns:
            List of checkpoint summaries
        """
        checkpoints = []
        
        for checkpoint_file in self.checkpoint_dir.glob('*_checkpoint.json'):
            try:
                with open(checkpoint_file, 'r') as f:
                    checkpoint = json.load(f)
                    checkpoints.append({
                        'source': checkpoint['source'],
                        'records_processed': checkpoint['records_processed'],
                        'last_updated': checkpoint['last_updated']
                    })
            except (json.JSONDecodeError, IOError):
                continue
                
        return checkpoints

