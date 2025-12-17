"""
Spark ETL Jobs for Scholarly Knowledge Graph.

Transforms raw ingested data into normalized Parquet tables:
- works: Unified paper metadata
- authors: Deduplicated author entities
- work_authors: Paper-author relationships
- venues: Publication venues
- citations: Citation edges
"""

__version__ = "1.0.0"

