"""
Scalable Scholarly Knowledge Graph - Ingestion Pipeline

This module provides robust data ingestion from multiple scholarly APIs:
- arXiv: Computer Science, Physics, Math papers
- PubMed: Biomedical literature
- OpenAlex: Comprehensive scholarly graph with citations

Features:
- Rate limiting with exponential backoff
- Checkpointing for resumability
- NDJSON output for streaming processing
- Partitioned storage by source and date
"""

__version__ = "1.0.0"
__author__ = "Aarya Shah, Aryan Donde"

