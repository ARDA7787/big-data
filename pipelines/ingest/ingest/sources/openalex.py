"""
OpenAlex API ingester.

Fetches comprehensive scholarly data including:
- Works metadata
- Citation relationships
- Author information
- Concepts/topics
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urlencode

from ingest.utils.checkpoint import CheckpointManager
from ingest.utils.storage import StorageManager
from ingest.utils.rate_limiter import RateLimiter, RetryableHTTPClient

logger = logging.getLogger(__name__)


class OpenAlexIngester:
    """Ingester for OpenAlex API."""
    
    BASE_URL = "https://api.openalex.org/works"
    
    def __init__(
        self,
        config: dict[str, Any],
        checkpoint_manager: CheckpointManager,
        storage_manager: StorageManager
    ):
        """
        Initialize the OpenAlex ingester.
        
        Args:
            config: OpenAlex configuration from YAML
            checkpoint_manager: Checkpoint manager instance
            storage_manager: Storage manager instance
        """
        self.config = config
        self.checkpoint_mgr = checkpoint_manager
        self.storage_mgr = storage_manager
        
        # Rate limiter: 10 requests/sec for polite pool
        rate_limit = config.get('rate_limit', {})
        self.rate_limiter = RateLimiter(
            requests_per_second=rate_limit.get('requests_per_second', 10)
        )
        
        self.max_records = config.get('max_records', 1000)
        self.per_page = min(config.get('per_page', 200), 200)  # API max is 200
        self.email = config.get('email', 'scholarly-graph@nyu.edu')
        self.filters = config.get('filters', {})
        self.fetch_citations = config.get('fetch_citations', True)
    
    def _build_filter_string(self) -> str:
        """Build OpenAlex filter string."""
        filter_parts = []
        
        # Concepts filter
        concepts = self.filters.get('concepts', [])
        if concepts:
            concept_filter = '|'.join(concepts)
            filter_parts.append(f"concepts.id:{concept_filter}")
        
        # Date range
        from_date = self.filters.get('from_publication_date')
        to_date = self.filters.get('to_publication_date')
        
        if from_date:
            filter_parts.append(f"from_publication_date:{from_date}")
        if to_date:
            filter_parts.append(f"to_publication_date:{to_date}")
        
        # Has DOI
        if self.filters.get('has_doi'):
            filter_parts.append("has_doi:true")
        
        # Minimum citations
        min_citations = self.filters.get('cited_by_count_min')
        if min_citations:
            filter_parts.append(f"cited_by_count:>{min_citations}")
        
        return ','.join(filter_parts)
    
    def _parse_work(self, work: dict[str, Any]) -> dict[str, Any]:
        """Parse an OpenAlex work into a record."""
        
        # Extract OpenAlex ID
        openalex_id = work.get('id', '').replace('https://openalex.org/', '')
        
        # Parse authors
        authors = []
        for authorship in work.get('authorships', []):
            author = authorship.get('author', {})
            
            # Get affiliations
            affiliations = []
            for inst in authorship.get('institutions', []):
                if inst.get('display_name'):
                    affiliations.append(inst['display_name'])
            
            authors.append({
                'openalex_id': author.get('id', '').replace('https://openalex.org/', ''),
                'name': author.get('display_name'),
                'orcid': author.get('orcid'),
                'position': authorship.get('author_position'),
                'affiliations': affiliations
            })
        
        # Parse concepts
        concepts = []
        for concept in work.get('concepts', []):
            concepts.append({
                'id': concept.get('id', '').replace('https://openalex.org/', ''),
                'name': concept.get('display_name'),
                'level': concept.get('level'),
                'score': concept.get('score')
            })
        
        # Parse venue/location
        venue = None
        primary_location = work.get('primary_location', {})
        if primary_location:
            source = primary_location.get('source', {})
            if source:
                venue = {
                    'id': source.get('id', '').replace('https://openalex.org/', ''),
                    'name': source.get('display_name'),
                    'type': source.get('type'),
                    'issn': source.get('issn_l')
                }
        
        # Parse citations (referenced works)
        referenced_works = [
            ref.replace('https://openalex.org/', '')
            for ref in work.get('referenced_works', [])
        ]
        
        # Parse related works
        related_works = [
            rel.replace('https://openalex.org/', '')
            for rel in work.get('related_works', [])
        ]
        
        # Open access info
        open_access = work.get('open_access', {})
        
        return {
            'openalex_id': openalex_id,
            'doi': work.get('doi'),
            'title': work.get('title') or work.get('display_name'),
            'publication_year': work.get('publication_year'),
            'publication_date': work.get('publication_date'),
            'type': work.get('type'),
            'cited_by_count': work.get('cited_by_count', 0),
            'authors': authors,
            'concepts': concepts,
            'venue': venue,
            'referenced_works': referenced_works,
            'related_works': related_works,
            'is_oa': open_access.get('is_oa', False),
            'oa_status': open_access.get('oa_status'),
            'oa_url': open_access.get('oa_url'),
            'abstract_inverted_index': work.get('abstract_inverted_index'),
            'cited_by_api_url': work.get('cited_by_api_url')
        }
    
    def _reconstruct_abstract(self, inverted_index: Optional[dict]) -> Optional[str]:
        """Reconstruct abstract from inverted index format."""
        if not inverted_index:
            return None
        
        try:
            # Build position -> word mapping
            word_positions = []
            for word, positions in inverted_index.items():
                for pos in positions:
                    word_positions.append((pos, word))
            
            # Sort by position and join
            word_positions.sort(key=lambda x: x[0])
            return ' '.join(word for _, word in word_positions)
            
        except Exception as e:
            logger.warning(f"Failed to reconstruct abstract: {e}")
            return None
    
    async def ingest(self) -> dict[str, Any]:
        """
        Run the OpenAlex ingestion.
        
        Returns:
            Ingestion result summary
        """
        result = {
            'source': 'openalex',
            'records_ingested': 0,
            'batches': 0,
            'citations_count': 0,
            'errors': [],
            'rate_limit_stats': {}
        }
        
        # Check for checkpoint
        records_processed, cursor = self.checkpoint_mgr.get_progress('openalex')
        
        async with RetryableHTTPClient(
            self.rate_limiter,
            retry_attempts=self.config.get('rate_limit', {}).get('retry_attempts', 3),
            retry_backoff_factor=self.config.get('rate_limit', {}).get('retry_backoff_factor', 2)
        ) as client:
            
            page = 1
            if cursor:
                page = int(cursor)
                logger.info(f"Resuming from page {page}")
            
            filter_string = self._build_filter_string()
            
            while True:
                # Check if we've reached the limit
                if result['records_ingested'] >= self.max_records:
                    logger.info(f"Reached max records limit: {self.max_records}")
                    break
                
                try:
                    # Build request URL
                    params = {
                        'filter': filter_string,
                        'page': page,
                        'per-page': min(self.per_page, self.max_records - result['records_ingested']),
                        'mailto': self.email,
                        'select': 'id,doi,title,display_name,publication_year,publication_date,type,'
                                  'cited_by_count,authorships,concepts,primary_location,'
                                  'referenced_works,related_works,open_access,abstract_inverted_index,'
                                  'cited_by_api_url'
                    }
                    
                    logger.debug(f"Fetching OpenAlex page {page}")
                    response = await client.get(self.BASE_URL, params=params)
                    data = response.json()
                    
                    works = data.get('results', [])
                    
                    if not works:
                        logger.info("No more records available")
                        break
                    
                    # Parse works
                    records = []
                    for work in works:
                        try:
                            record = self._parse_work(work)
                            
                            # Reconstruct abstract
                            record['abstract'] = self._reconstruct_abstract(
                                record.pop('abstract_inverted_index', None)
                            )
                            
                            records.append(record)
                            
                            # Count citations
                            result['citations_count'] += len(record.get('referenced_works', []))
                            
                        except Exception as e:
                            logger.warning(f"Failed to parse work: {e}")
                            continue
                    
                    if records:
                        # Write batch
                        batch_id = f"page_{page:06d}"
                        self.storage_mgr.write_records('openalex', records, batch_id)
                        
                        result['records_ingested'] += len(records)
                        result['batches'] += 1
                        
                        # Save checkpoint
                        self.checkpoint_mgr.save_checkpoint(
                            'openalex',
                            str(page + 1),
                            result['records_ingested'],
                            {
                                'total_results': data.get('meta', {}).get('count'),
                                'citations_count': result['citations_count']
                            }
                        )
                        
                        logger.info(
                            f"OpenAlex progress: {result['records_ingested']}/{self.max_records} "
                            f"({100 * result['records_ingested'] / self.max_records:.1f}%) "
                            f"[{result['citations_count']} citations]"
                        )
                    
                    # Check if there are more pages
                    meta = data.get('meta', {})
                    total_count = meta.get('count', 0)
                    current_offset = (page - 1) * self.per_page + len(works)
                    
                    if current_offset >= total_count:
                        logger.info("Fetched all available records")
                        break
                    
                    page += 1
                        
                except Exception as e:
                    error_msg = f"Error on page {page}: {str(e)}"
                    logger.error(error_msg)
                    result['errors'].append(error_msg)
                    
                    # Continue with next page after error
                    page += 1
            
            result['rate_limit_stats'] = client.get_stats()
        
        # Clear checkpoint on successful completion
        if not result['errors']:
            self.checkpoint_mgr.clear_checkpoint('openalex')
        
        return result


async def main():
    """CLI entry point for standalone OpenAlex ingestion."""
    import argparse
    import yaml
    
    parser = argparse.ArgumentParser(description='OpenAlex Ingester')
    parser.add_argument('--config', '-c', required=True, help='Config file path')
    args = parser.parse_args()
    
    with open(args.config) as f:
        config = yaml.safe_load(f)
    
    checkpoint_mgr = CheckpointManager(config['global']['checkpoint_dir'])
    storage_mgr = StorageManager(config['global']['raw_data_dir'])
    
    ingester = OpenAlexIngester(
        config=config.get('openalex', {}),
        checkpoint_manager=checkpoint_mgr,
        storage_manager=storage_mgr
    )
    
    result = await ingester.ingest()
    print(f"Ingested {result['records_ingested']} records from OpenAlex")
    print(f"Citation relationships: {result['citations_count']}")


if __name__ == '__main__':
    asyncio.run(main())

