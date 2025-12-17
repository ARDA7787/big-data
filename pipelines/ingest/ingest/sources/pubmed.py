"""
PubMed E-utilities ingester.

Fetches biomedical literature metadata using NCBI E-utilities:
- ESearch for finding PMIDs
- EFetch for retrieving full metadata
- Rate limiting (3/sec without API key, 10/sec with)
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


class PubMedIngester:
    """Ingester for PubMed E-utilities."""
    
    ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    
    def __init__(
        self,
        config: dict[str, Any],
        checkpoint_manager: CheckpointManager,
        storage_manager: StorageManager
    ):
        """
        Initialize the PubMed ingester.
        
        Args:
            config: PubMed configuration from YAML
            checkpoint_manager: Checkpoint manager instance
            storage_manager: Storage manager instance
        """
        self.config = config
        self.checkpoint_mgr = checkpoint_manager
        self.storage_mgr = storage_manager
        
        # Rate limiter: 3/sec without API key, 10/sec with
        rate_limit = config.get('rate_limit', {})
        rps = 10 if config.get('use_api_key') else 3
        self.rate_limiter = RateLimiter(
            requests_per_second=rate_limit.get('requests_per_second', rps)
        )
        
        self.max_records = config.get('max_records', 1000)
        self.batch_size = config.get('batch_size', 100)
        self.search_terms = config.get('search_terms', ['machine learning'])
        self.api_key = config.get('api_key')
    
    def _build_search_query(self) -> str:
        """Build PubMed search query from terms."""
        terms = [f'"{term}"[Title/Abstract]' for term in self.search_terms]
        return " OR ".join(terms)
    
    def _parse_search_response(self, xml_content: str) -> tuple[list[str], int]:
        """
        Parse ESearch response.
        
        Returns:
            Tuple of (PMID list, total count)
        """
        root = ET.fromstring(xml_content)
        
        count_elem = root.find('.//Count')
        total_count = int(count_elem.text) if count_elem is not None else 0
        
        pmids = [id_elem.text for id_elem in root.findall('.//Id') if id_elem.text]
        
        return pmids, total_count
    
    def _parse_article(self, article: ET.Element) -> Optional[dict[str, Any]]:
        """Parse a PubMed article element."""
        
        def get_text(elem: Optional[ET.Element]) -> Optional[str]:
            return elem.text.strip() if elem is not None and elem.text else None
        
        try:
            # Get PMID
            pmid_elem = article.find('.//PMID')
            if pmid_elem is None:
                return None
            pmid = pmid_elem.text
            
            # Get article metadata
            article_meta = article.find('.//Article')
            if article_meta is None:
                return None
            
            # Title
            title_elem = article_meta.find('.//ArticleTitle')
            title = get_text(title_elem)
            
            # Abstract
            abstract_parts = []
            for abstract_elem in article_meta.findall('.//Abstract/AbstractText'):
                label = abstract_elem.get('Label', '')
                text = abstract_elem.text or ''
                if label:
                    abstract_parts.append(f"{label}: {text}")
                else:
                    abstract_parts.append(text)
            abstract = ' '.join(abstract_parts) if abstract_parts else None
            
            # Authors
            authors = []
            for author_elem in article_meta.findall('.//AuthorList/Author'):
                last_name = get_text(author_elem.find('LastName'))
                fore_name = get_text(author_elem.find('ForeName'))
                
                affiliation = None
                affil_elem = author_elem.find('.//Affiliation')
                if affil_elem is not None:
                    affiliation = affil_elem.text
                
                if last_name:
                    name = f"{fore_name} {last_name}" if fore_name else last_name
                    authors.append({
                        'name': name,
                        'affiliation': affiliation
                    })
            
            # Journal
            journal_elem = article_meta.find('.//Journal')
            journal = None
            if journal_elem is not None:
                journal_title = journal_elem.find('.//Title')
                journal = get_text(journal_title)
            
            # Publication date
            pub_date = None
            date_elem = article_meta.find('.//ArticleDate')
            if date_elem is None:
                date_elem = article.find('.//PubDate')
            
            if date_elem is not None:
                year = get_text(date_elem.find('Year'))
                month = get_text(date_elem.find('Month')) or '01'
                day = get_text(date_elem.find('Day')) or '01'
                
                # Convert month name to number if needed
                if month and not month.isdigit():
                    try:
                        month = datetime.strptime(month[:3], '%b').month
                    except ValueError:
                        month = 1
                
                if year:
                    pub_date = f"{year}-{int(month):02d}-{int(day):02d}"
            
            # MeSH terms
            mesh_terms = []
            for mesh_elem in article.findall('.//MeshHeading/DescriptorName'):
                if mesh_elem.text:
                    mesh_terms.append({
                        'term': mesh_elem.text,
                        'ui': mesh_elem.get('UI'),
                        'major_topic': mesh_elem.get('MajorTopicYN') == 'Y'
                    })
            
            # Keywords
            keywords = []
            for kw_elem in article.findall('.//KeywordList/Keyword'):
                if kw_elem.text:
                    keywords.append(kw_elem.text)
            
            # DOI
            doi = None
            for id_elem in article.findall('.//ArticleIdList/ArticleId'):
                if id_elem.get('IdType') == 'doi':
                    doi = id_elem.text
                    break
            
            # PMC ID
            pmc_id = None
            for id_elem in article.findall('.//ArticleIdList/ArticleId'):
                if id_elem.get('IdType') == 'pmc':
                    pmc_id = id_elem.text
                    break
            
            return {
                'pmid': pmid,
                'title': title,
                'abstract': abstract,
                'authors': authors,
                'journal': journal,
                'pub_date': pub_date,
                'mesh_terms': mesh_terms,
                'keywords': keywords,
                'doi': doi,
                'pmc_id': pmc_id
            }
            
        except Exception as e:
            logger.warning(f"Failed to parse PubMed article: {e}")
            return None
    
    def _parse_fetch_response(self, xml_content: str) -> list[dict[str, Any]]:
        """Parse EFetch response."""
        records = []
        
        try:
            root = ET.fromstring(xml_content)
            
            for article in root.findall('.//PubmedArticle'):
                record = self._parse_article(article)
                if record:
                    records.append(record)
                    
        except ET.ParseError as e:
            logger.error(f"Failed to parse PubMed response: {e}")
        
        return records
    
    async def _search_pmids(
        self,
        client: RetryableHTTPClient,
        query: str,
        retstart: int,
        retmax: int
    ) -> tuple[list[str], int]:
        """Search for PMIDs."""
        params = {
            'db': 'pubmed',
            'term': query,
            'retstart': retstart,
            'retmax': retmax,
            'retmode': 'xml',
            'usehistory': 'n'
        }
        
        if self.api_key:
            params['api_key'] = self.api_key
        
        response = await client.get(self.ESEARCH_URL, params=params)
        return self._parse_search_response(response.text)
    
    async def _fetch_articles(
        self,
        client: RetryableHTTPClient,
        pmids: list[str]
    ) -> list[dict[str, Any]]:
        """Fetch article metadata for PMIDs."""
        params = {
            'db': 'pubmed',
            'id': ','.join(pmids),
            'retmode': 'xml',
            'rettype': 'abstract'
        }
        
        if self.api_key:
            params['api_key'] = self.api_key
        
        response = await client.get(self.EFETCH_URL, params=params)
        return self._parse_fetch_response(response.text)
    
    async def ingest(self) -> dict[str, Any]:
        """
        Run the PubMed ingestion.
        
        Returns:
            Ingestion result summary
        """
        result = {
            'source': 'pubmed',
            'records_ingested': 0,
            'batches': 0,
            'errors': [],
            'rate_limit_stats': {}
        }
        
        # Check for checkpoint
        records_processed, cursor = self.checkpoint_mgr.get_progress('pubmed')
        start_offset = int(cursor) if cursor else 0
        
        if start_offset > 0:
            logger.info(f"Resuming from offset {start_offset}")
        
        query = self._build_search_query()
        logger.info(f"PubMed query: {query}")
        
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
                
                try:
                    # Search for PMIDs
                    batch_size = min(self.batch_size, self.max_records - result['records_ingested'])
                    pmids, total = await self._search_pmids(client, query, offset, batch_size)
                    
                    if total_results is None:
                        total_results = total
                        logger.info(f"Total available records: {total_results}")
                    
                    if not pmids:
                        logger.info("No more records available")
                        break
                    
                    # Fetch full metadata
                    records = await self._fetch_articles(client, pmids)
                    
                    if records:
                        # Write batch
                        batch_id = f"batch_{offset:08d}"
                        self.storage_mgr.write_records('pubmed', records, batch_id)
                        
                        result['records_ingested'] += len(records)
                        result['batches'] += 1
                        
                        # Save checkpoint
                        self.checkpoint_mgr.save_checkpoint(
                            'pubmed',
                            str(offset + len(pmids)),
                            result['records_ingested'],
                            {'total_available': total_results}
                        )
                        
                        logger.info(
                            f"PubMed progress: {result['records_ingested']}/{self.max_records} "
                            f"({100 * result['records_ingested'] / self.max_records:.1f}%)"
                        )
                    
                    offset += len(pmids)
                    
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
            self.checkpoint_mgr.clear_checkpoint('pubmed')
        
        return result


async def main():
    """CLI entry point for standalone PubMed ingestion."""
    import argparse
    import yaml
    
    parser = argparse.ArgumentParser(description='PubMed Ingester')
    parser.add_argument('--config', '-c', required=True, help='Config file path')
    args = parser.parse_args()
    
    with open(args.config) as f:
        config = yaml.safe_load(f)
    
    checkpoint_mgr = CheckpointManager(config['global']['checkpoint_dir'])
    storage_mgr = StorageManager(config['global']['raw_data_dir'])
    
    ingester = PubMedIngester(
        config=config.get('pubmed', {}),
        checkpoint_manager=checkpoint_mgr,
        storage_manager=storage_mgr
    )
    
    result = await ingester.ingest()
    print(f"Ingested {result['records_ingested']} records from PubMed")


if __name__ == '__main__':
    asyncio.run(main())

