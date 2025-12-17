"""
arXiv API ingester.

Fetches metadata from arXiv's public API with:
- Pagination support
- Rate limiting (1 request per 3 seconds)
- Category filtering
- Date range filtering
"""

import asyncio
import logging
import re
from datetime import datetime
from typing import Any, Optional
from xml.etree import ElementTree as ET

from ingest.utils.checkpoint import CheckpointManager
from ingest.utils.storage import StorageManager
from ingest.utils.rate_limiter import RateLimiter, RetryableHTTPClient

logger = logging.getLogger(__name__)

# arXiv API namespaces
NAMESPACES = {
    'atom': 'http://www.w3.org/2005/Atom',
    'arxiv': 'http://arxiv.org/schemas/atom',
    'opensearch': 'http://a9.com/-/spec/opensearch/1.1/'
}


class ArxivIngester:
    """Ingester for arXiv API."""
    
    BASE_URL = "https://export.arxiv.org/api/query"
    
    def __init__(
        self,
        config: dict[str, Any],
        checkpoint_manager: CheckpointManager,
        storage_manager: StorageManager
    ):
        """
        Initialize the arXiv ingester.
        
        Args:
            config: arXiv configuration from YAML
            checkpoint_manager: Checkpoint manager instance
            storage_manager: Storage manager instance
        """
        self.config = config
        self.checkpoint_mgr = checkpoint_manager
        self.storage_mgr = storage_manager
        
        # Rate limiter: 1 request per 3 seconds (API requirement)
        rate_limit = config.get('rate_limit', {})
        self.rate_limiter = RateLimiter(
            requests_per_second=rate_limit.get('requests_per_second', 0.33)
        )
        
        self.max_records = config.get('max_records', 1000)
        self.batch_size = config.get('batch_size', 100)
        self.categories = config.get('categories', ['cs.AI'])
    
    def _build_query(self, categories: list[str]) -> str:
        """Build arXiv search query from categories."""
        if len(categories) == 1:
            return f"cat:{categories[0]}"
        return " OR ".join(f"cat:{cat}" for cat in categories)
    
    def _parse_entry(self, entry: ET.Element) -> dict[str, Any]:
        """Parse an arXiv entry into a record."""
        
        def get_text(elem: Optional[ET.Element]) -> Optional[str]:
            return elem.text.strip() if elem is not None and elem.text else None
        
        def get_all_text(elems: list[ET.Element]) -> list[str]:
            return [e.text.strip() for e in elems if e.text]
        
        # Extract arXiv ID from the id URL
        id_elem = entry.find('atom:id', NAMESPACES)
        arxiv_id = None
        if id_elem is not None and id_elem.text:
            # ID format: http://arxiv.org/abs/2301.00001v1
            match = re.search(r'abs/(.+)$', id_elem.text)
            if match:
                arxiv_id = match.group(1)
        
        # Parse authors
        authors = []
        for author_elem in entry.findall('atom:author', NAMESPACES):
            name_elem = author_elem.find('atom:name', NAMESPACES)
            affil_elem = author_elem.find('arxiv:affiliation', NAMESPACES)
            if name_elem is not None and name_elem.text:
                authors.append({
                    'name': name_elem.text.strip(),
                    'affiliation': get_text(affil_elem)
                })
        
        # Parse categories
        categories = []
        for cat_elem in entry.findall('atom:category', NAMESPACES):
            term = cat_elem.get('term')
            if term:
                categories.append(term)
        
        # Parse links
        links = []
        for link_elem in entry.findall('atom:link', NAMESPACES):
            links.append({
                'href': link_elem.get('href'),
                'type': link_elem.get('type'),
                'rel': link_elem.get('rel', 'alternate')
            })
        
        # Parse dates
        published = get_text(entry.find('atom:published', NAMESPACES))
        updated = get_text(entry.find('atom:updated', NAMESPACES))
        
        return {
            'arxiv_id': arxiv_id,
            'title': get_text(entry.find('atom:title', NAMESPACES)),
            'abstract': get_text(entry.find('atom:summary', NAMESPACES)),
            'authors': authors,
            'categories': categories,
            'primary_category': entry.find('arxiv:primary_category', NAMESPACES).get('term') if entry.find('arxiv:primary_category', NAMESPACES) is not None else None,
            'published': published,
            'updated': updated,
            'doi': get_text(entry.find('arxiv:doi', NAMESPACES)),
            'journal_ref': get_text(entry.find('arxiv:journal_ref', NAMESPACES)),
            'comment': get_text(entry.find('arxiv:comment', NAMESPACES)),
            'links': links
        }
    
    def _parse_response(self, xml_content: str) -> tuple[list[dict], int]:
        """
        Parse arXiv API response.
        
        Returns:
            Tuple of (records, total_results)
        """
        root = ET.fromstring(xml_content)
        
        # Get total results
        total_elem = root.find('opensearch:totalResults', NAMESPACES)
        total_results = int(total_elem.text) if total_elem is not None else 0
        
        # Parse entries
        records = []
        for entry in root.findall('atom:entry', NAMESPACES):
            try:
                record = self._parse_entry(entry)
                if record.get('arxiv_id'):  # Only include valid entries
                    records.append(record)
            except Exception as e:
                logger.warning(f"Failed to parse arXiv entry: {e}")
                continue
        
        return records, total_results
    
    async def ingest(self) -> dict[str, Any]:
        """
        Run the arXiv ingestion.
        
        Returns:
            Ingestion result summary
        """
        result = {
            'source': 'arxiv',
            'records_ingested': 0,
            'batches': 0,
            'errors': [],
            'rate_limit_stats': {}
        }
        
        # Check for checkpoint
        records_processed, cursor = self.checkpoint_mgr.get_progress('arxiv')
        start_offset = int(cursor) if cursor else 0
        
        if start_offset > 0:
            logger.info(f"Resuming from offset {start_offset}")
        
        query = self._build_query(self.categories)
        
        async with RetryableHTTPClient(
            self.rate_limiter,
            retry_attempts=self.config.get('rate_limit', {}).get('retry_attempts', 3),
            retry_backoff_factor=self.config.get('rate_limit', {}).get('retry_backoff_factor', 2)
        ) as client:
            
            offset = start_offset
            total_results = None
            
            while True:
                # Check if we've reached the limit
                if result['records_ingested'] >= self.max_records:
                    logger.info(f"Reached max records limit: {self.max_records}")
                    break
                
                # Build request
                params = {
                    'search_query': query,
                    'start': offset,
                    'max_results': min(self.batch_size, self.max_records - result['records_ingested']),
                    'sortBy': 'submittedDate',
                    'sortOrder': 'descending'
                }
                
                try:
                    logger.debug(f"Fetching arXiv records: offset={offset}")
                    response = await client.get(self.BASE_URL, params=params)
                    
                    records, total = self._parse_response(response.text)
                    
                    if total_results is None:
                        total_results = total
                        logger.info(f"Total available records: {total_results}")
                    
                    if not records:
                        logger.info("No more records available")
                        break
                    
                    # Write batch
                    batch_id = f"batch_{offset:08d}"
                    self.storage_mgr.write_records('arxiv', records, batch_id)
                    
                    result['records_ingested'] += len(records)
                    result['batches'] += 1
                    
                    # Save checkpoint
                    self.checkpoint_mgr.save_checkpoint(
                        'arxiv',
                        str(offset + len(records)),
                        result['records_ingested'],
                        {'total_available': total_results}
                    )
                    
                    logger.info(
                        f"arXiv progress: {result['records_ingested']}/{self.max_records} "
                        f"({100 * result['records_ingested'] / self.max_records:.1f}%)"
                    )
                    
                    offset += len(records)
                    
                    # Check if we've fetched all available
                    if offset >= total_results:
                        logger.info("Fetched all available records")
                        break
                        
                except Exception as e:
                    error_msg = f"Error at offset {offset}: {str(e)}"
                    logger.error(error_msg)
                    result['errors'].append(error_msg)
                    
                    # Continue with next batch after error
                    offset += self.batch_size
            
            result['rate_limit_stats'] = client.get_stats()
        
        # Clear checkpoint on successful completion
        if not result['errors']:
            self.checkpoint_mgr.clear_checkpoint('arxiv')
        
        return result


async def main():
    """CLI entry point for standalone arXiv ingestion."""
    import argparse
    import yaml
    
    parser = argparse.ArgumentParser(description='arXiv Ingester')
    parser.add_argument('--config', '-c', required=True, help='Config file path')
    args = parser.parse_args()
    
    with open(args.config) as f:
        config = yaml.safe_load(f)
    
    checkpoint_mgr = CheckpointManager(config['global']['checkpoint_dir'])
    storage_mgr = StorageManager(config['global']['raw_data_dir'])
    
    ingester = ArxivIngester(
        config=config.get('arxiv', {}),
        checkpoint_manager=checkpoint_mgr,
        storage_manager=storage_mgr
    )
    
    result = await ingester.ingest()
    print(f"Ingested {result['records_ingested']} records from arXiv")


if __name__ == '__main__':
    asyncio.run(main())

