"""Source-specific ingesters for scholarly data."""

from ingest.sources.arxiv import ArxivIngester
from ingest.sources.pubmed import PubMedIngester
from ingest.sources.openalex import OpenAlexIngester

__all__ = ['ArxivIngester', 'PubMedIngester', 'OpenAlexIngester']

