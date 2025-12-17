"""
Main Spark ETL job for the Scholarly Knowledge Graph.

This job:
1. Reads raw NDJSON data from all sources
2. Normalizes schemas into unified tables
3. Resolves entity identities (works, authors)
4. Builds citation edges
5. Writes Parquet files partitioned by year
"""

from __future__ import annotations
import argparse
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import yaml
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, 
    ArrayType, FloatType, BooleanType
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_spark_session(config: Dict[str, Any]) -> SparkSession:
    """Create and configure Spark session."""
    spark_config = config.get('spark', {})
    
    builder = SparkSession.builder \
        .appName(spark_config.get('app_name', 'ScholarlyKG-ETL'))
    
    # Set master if not running on cluster
    master = spark_config.get('master')
    if master:
        builder = builder.master(master)
    
    # Configure memory
    builder = builder.config('spark.driver.memory', spark_config.get('driver_memory', '2g'))
    builder = builder.config('spark.executor.memory', spark_config.get('executor_memory', '2g'))
    
    # Shuffle partitions
    shuffle_partitions = spark_config.get('shuffle_partitions', 200)
    builder = builder.config('spark.sql.shuffle.partitions', shuffle_partitions)
    
    # Enable adaptive query execution
    if spark_config.get('adaptive_query_execution', True):
        builder = builder.config('spark.sql.adaptive.enabled', 'true')
    
    return builder.getOrCreate()


def read_raw_arxiv(spark: SparkSession, raw_path: str) -> DataFrame:
    """Read and parse raw arXiv data."""
    logger.info(f"Reading arXiv data from {raw_path}/arxiv")
    
    schema = StructType([
        StructField("arxiv_id", StringType()),
        StructField("title", StringType()),
        StructField("abstract", StringType()),
        StructField("authors", ArrayType(StructType([
            StructField("name", StringType()),
            StructField("affiliation", StringType())
        ]))),
        StructField("categories", ArrayType(StringType())),
        StructField("primary_category", StringType()),
        StructField("published", StringType()),
        StructField("updated", StringType()),
        StructField("doi", StringType()),
        StructField("journal_ref", StringType()),
        StructField("comment", StringType()),
        StructField("_ingested_at", StringType()),
        StructField("_source", StringType()),
        StructField("_batch_id", StringType())
    ])
    
    df = spark.read.schema(schema).json(f"{raw_path}/arxiv/**/*.ndjson*")
    
    return df.select(
        F.concat(F.lit("arxiv:"), F.col("arxiv_id")).alias("source_id"),
        F.lit("arxiv").alias("source"),
        F.col("title"),
        F.col("abstract"),
        F.col("authors"),
        F.col("categories").alias("fields"),
        F.col("primary_category").alias("primary_field"),
        F.to_date(F.col("published")).alias("pub_date"),
        F.year(F.to_date(F.col("published"))).alias("year"),
        F.col("doi"),
        F.col("journal_ref").alias("venue_name"),
        F.lit(None).cast(ArrayType(StringType())).alias("referenced_works"),
        F.col("_ingested_at")
    )


def read_raw_pubmed(spark: SparkSession, raw_path: str) -> DataFrame:
    """Read and parse raw PubMed data."""
    logger.info(f"Reading PubMed data from {raw_path}/pubmed")
    
    schema = StructType([
        StructField("pmid", StringType()),
        StructField("title", StringType()),
        StructField("abstract", StringType()),
        StructField("authors", ArrayType(StructType([
            StructField("name", StringType()),
            StructField("affiliation", StringType())
        ]))),
        StructField("journal", StringType()),
        StructField("pub_date", StringType()),
        StructField("mesh_terms", ArrayType(StructType([
            StructField("term", StringType()),
            StructField("ui", StringType()),
            StructField("major_topic", BooleanType())
        ]))),
        StructField("keywords", ArrayType(StringType())),
        StructField("doi", StringType()),
        StructField("pmc_id", StringType()),
        StructField("_ingested_at", StringType()),
        StructField("_source", StringType()),
        StructField("_batch_id", StringType())
    ])
    
    df = spark.read.schema(schema).json(f"{raw_path}/pubmed/**/*.ndjson*")
    
    # Extract MeSH term names as fields using SQL expr for compatibility
    df = df.withColumn(
        "mesh_term_names",
        F.expr("transform(mesh_terms, x -> x.term)")
    )
    
    return df.select(
        F.concat(F.lit("pmid:"), F.col("pmid")).alias("source_id"),
        F.lit("pubmed").alias("source"),
        F.col("title"),
        F.col("abstract"),
        F.col("authors"),
        F.col("mesh_term_names").alias("fields"),
        F.element_at(F.col("mesh_term_names"), 1).alias("primary_field"),
        F.to_date(F.col("pub_date")).alias("pub_date"),
        F.year(F.to_date(F.col("pub_date"))).alias("year"),
        F.col("doi"),
        F.col("journal").alias("venue_name"),
        F.lit(None).cast(ArrayType(StringType())).alias("referenced_works"),
        F.col("_ingested_at")
    )


def read_raw_openalex(spark: SparkSession, raw_path: str) -> DataFrame:
    """Read and parse raw OpenAlex data."""
    logger.info(f"Reading OpenAlex data from {raw_path}/openalex")
    
    schema = StructType([
        StructField("openalex_id", StringType()),
        StructField("doi", StringType()),
        StructField("title", StringType()),
        StructField("publication_year", IntegerType()),
        StructField("publication_date", StringType()),
        StructField("type", StringType()),
        StructField("cited_by_count", IntegerType()),
        StructField("authors", ArrayType(StructType([
            StructField("openalex_id", StringType()),
            StructField("name", StringType()),
            StructField("orcid", StringType()),
            StructField("position", StringType()),
            StructField("affiliations", ArrayType(StringType()))
        ]))),
        StructField("concepts", ArrayType(StructType([
            StructField("id", StringType()),
            StructField("name", StringType()),
            StructField("level", IntegerType()),
            StructField("score", FloatType())
        ]))),
        StructField("venue", StructType([
            StructField("id", StringType()),
            StructField("name", StringType()),
            StructField("type", StringType()),
            StructField("issn", StringType())
        ])),
        StructField("referenced_works", ArrayType(StringType())),
        StructField("related_works", ArrayType(StringType())),
        StructField("abstract", StringType()),
        StructField("is_oa", BooleanType()),
        StructField("oa_status", StringType()),
        StructField("oa_url", StringType()),
        StructField("_ingested_at", StringType()),
        StructField("_source", StringType()),
        StructField("_batch_id", StringType())
    ])
    
    df = spark.read.schema(schema).json(f"{raw_path}/openalex/**/*.ndjson*")
    
    # Convert authors to common format - use expr for higher-order functions
    # First transform authors array to standard format
    df = df.withColumn(
        "authors_normalized",
        F.expr("transform(authors, a -> struct(a.name as name, element_at(a.affiliations, 1) as affiliation))")
    )
    
    # Extract concept names as fields
    df = df.withColumn(
        "concept_names",
        F.expr("transform(concepts, c -> c.name)")
    )
    
    return df.select(
        F.concat(F.lit("openalex:"), F.col("openalex_id")).alias("source_id"),
        F.lit("openalex").alias("source"),
        F.col("title"),
        F.col("abstract"),
        F.col("authors_normalized").alias("authors"),
        F.col("concept_names").alias("fields"),
        F.element_at(F.col("concept_names"), 1).alias("primary_field"),
        F.to_date(F.col("publication_date")).alias("pub_date"),
        F.col("publication_year").alias("year"),
        F.col("doi"),
        F.col("venue.name").alias("venue_name"),
        F.col("referenced_works"),
        F.col("_ingested_at")
    )


def create_unified_works(
    arxiv_df: DataFrame,
    pubmed_df: DataFrame,
    openalex_df: DataFrame
) -> DataFrame:
    """Create unified works table from all sources."""
    logger.info("Creating unified works table")
    
    # Union all sources
    unified = arxiv_df.unionByName(pubmed_df).unionByName(openalex_df)
    
    # Generate stable work_id using hash of source_id
    unified = unified.withColumn(
        "work_id",
        F.sha2(F.col("source_id"), 256).substr(1, 16)
    )
    
    # Deduplicate by DOI if available
    unified = unified.withColumn(
        "dedup_key",
        F.coalesce(
            F.lower(F.regexp_replace(F.col("doi"), r"^https?://doi\.org/", "")),
            F.col("source_id")
        )
    )
    
    # Keep first record per dedup_key, preferring OpenAlex (has citations)
    window = Window.partitionBy("dedup_key").orderBy(
        F.when(F.col("source") == "openalex", 0).otherwise(1),
        F.col("_ingested_at").desc()
    )
    
    unified = unified.withColumn("row_num", F.row_number().over(window)) \
        .filter(F.col("row_num") == 1) \
        .drop("row_num", "dedup_key")
    
    return unified


def create_authors_table(works_df: DataFrame) -> DataFrame:
    """Extract and deduplicate authors."""
    logger.info("Creating authors table")
    
    # Explode authors from works
    authors = works_df.select(
        F.col("work_id"),
        F.posexplode(F.col("authors")).alias("position", "author")
    ).select(
        F.col("work_id"),
        F.col("position"),
        F.col("author.name").alias("name"),
        F.col("author.affiliation").alias("affiliation")
    )
    
    # Create author_id from name hash
    authors = authors.withColumn(
        "author_id",
        F.sha2(F.lower(F.trim(F.col("name"))), 256).substr(1, 16)
    )
    
    # Deduplicate authors
    unique_authors = authors.select(
        "author_id", "name", "affiliation"
    ).dropDuplicates(["author_id"])
    
    # Work-author relationships
    work_authors = authors.select(
        "work_id", "author_id", "position"
    )
    
    return unique_authors, work_authors


def create_venues_table(works_df: DataFrame) -> DataFrame:
    """Extract unique venues."""
    logger.info("Creating venues table")
    
    venues = works_df.select(
        F.col("venue_name").alias("name")
    ).filter(
        F.col("name").isNotNull()
    ).dropDuplicates()
    
    # Create venue_id
    venues = venues.withColumn(
        "venue_id",
        F.sha2(F.lower(F.trim(F.col("name"))), 256).substr(1, 16)
    )
    
    # Add venue_id to works
    works_with_venue = works_df.join(
        venues.select("name", "venue_id"),
        works_df.venue_name == venues.name,
        "left"
    ).drop("name")
    
    return venues, works_with_venue


def create_citations_table(works_df: DataFrame) -> DataFrame:
    """Create citation edges from referenced_works."""
    logger.info("Creating citations table")
    
    # Explode referenced works
    citations = works_df.filter(
        F.size(F.col("referenced_works")) > 0
    ).select(
        F.col("work_id").alias("citing_work_id"),
        F.explode(F.col("referenced_works")).alias("cited_source_id")
    )
    
    # Join to get cited_work_id
    # First, create a mapping of source_id -> work_id
    source_mapping = works_df.select(
        F.col("source_id"),
        F.col("work_id")
    )
    
    # Also create mapping for OpenAlex IDs
    openalex_mapping = works_df.filter(
        F.col("source") == "openalex"
    ).select(
        F.regexp_replace(F.col("source_id"), "^openalex:", "").alias("source_id"),
        F.col("work_id")
    )
    
    # Union mappings
    all_mappings = source_mapping.union(openalex_mapping).dropDuplicates(["source_id"])
    
    # Join citations with mapping
    citations = citations.join(
        all_mappings.select(
            F.col("source_id"),
            F.col("work_id").alias("cited_work_id")
        ),
        citations.cited_source_id == all_mappings.source_id,
        "inner"
    ).select(
        "citing_work_id",
        "cited_work_id"
    ).dropDuplicates()
    
    return citations


def write_parquet(df: DataFrame, path: str, partition_cols: Optional[List[str]] = None):
    """Write DataFrame to Parquet with partitioning."""
    writer = df.write.mode("overwrite").option("compression", "snappy")
    
    if partition_cols:
        writer = writer.partitionBy(*partition_cols)
    
    writer.parquet(path)
    logger.info(f"Wrote {df.count()} records to {path}")


def main():
    parser = argparse.ArgumentParser(description='Scholarly KG ETL Job')
    parser.add_argument('--config', '-c', required=True, help='Config file path')
    args = parser.parse_args()
    
    # Load config
    with open(args.config) as f:
        config = yaml.safe_load(f)
    
    global_config = config.get('global', {})
    raw_path = global_config.get('raw_data_dir', '/data/raw')
    processed_path = global_config.get('processed_data_dir', '/data/processed')
    
    # Create Spark session
    spark = create_spark_session(config)
    spark.sparkContext.setLogLevel("WARN")
    
    try:
        logger.info("=" * 60)
        logger.info("Starting ETL Pipeline")
        logger.info("=" * 60)
        
        # Read raw data from all sources
        arxiv_df = read_raw_arxiv(spark, raw_path)
        pubmed_df = read_raw_pubmed(spark, raw_path)
        openalex_df = read_raw_openalex(spark, raw_path)
        
        # Log source counts
        logger.info(f"arXiv records: {arxiv_df.count()}")
        logger.info(f"PubMed records: {pubmed_df.count()}")
        logger.info(f"OpenAlex records: {openalex_df.count()}")
        
        # Create unified works
        works_df = create_unified_works(arxiv_df, pubmed_df, openalex_df)
        works_df.cache()
        logger.info(f"Unified works (deduplicated): {works_df.count()}")
        
        # Create authors
        authors_df, work_authors_df = create_authors_table(works_df)
        logger.info(f"Unique authors: {authors_df.count()}")
        
        # Create venues
        venues_df, works_with_venue = create_venues_table(works_df)
        logger.info(f"Unique venues: {venues_df.count()}")
        
        # Create citations
        citations_df = create_citations_table(works_df)
        logger.info(f"Citation edges: {citations_df.count()}")
        
        # Write all tables
        logger.info("Writing Parquet tables...")
        
        # Works - partitioned by year
        final_works = works_with_venue.select(
            "work_id", "source_id", "source", "title", "abstract",
            "fields", "primary_field", "pub_date", "year",
            "doi", "venue_id", "venue_name"
        )
        write_parquet(final_works, f"{processed_path}/works", ["year"])
        
        # Authors
        write_parquet(authors_df, f"{processed_path}/authors")
        
        # Work-Authors
        write_parquet(work_authors_df, f"{processed_path}/work_authors")
        
        # Venues
        write_parquet(venues_df, f"{processed_path}/venues")
        
        # Citations
        write_parquet(citations_df, f"{processed_path}/citations")
        
        logger.info("=" * 60)
        logger.info("ETL Pipeline Complete!")
        logger.info("=" * 60)
        
    finally:
        spark.stop()


if __name__ == "__main__":
    main()

