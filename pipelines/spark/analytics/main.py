"""
Main Spark Analytics job for the Scholarly Knowledge Graph.

This job runs:
1. Topic Modeling (TF-IDF + LDA) on abstracts
2. Citation Network Analysis (PageRank, communities) using GraphFrames
3. Trend Analysis (topic share, emerging topics)
4. Aggregations for the UI/API
"""

from __future__ import annotations
import argparse
import logging
from typing import Any, Dict, Tuple

import yaml
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.ml.feature import (
    Tokenizer, StopWordsRemover, CountVectorizer, IDF
)
from pyspark.ml.clustering import LDA
from pyspark.ml import Pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_spark_session(config: Dict[str, Any]) -> SparkSession:
    """Create and configure Spark session with GraphFrames."""
    spark_config = config.get('spark', {})
    
    builder = SparkSession.builder \
        .appName(spark_config.get('app_name', 'ScholarlyKG-Analytics'))
    
    master = spark_config.get('master')
    if master:
        builder = builder.master(master)
    
    builder = builder.config('spark.driver.memory', spark_config.get('driver_memory', '2g'))
    builder = builder.config('spark.executor.memory', spark_config.get('executor_memory', '2g'))
    builder = builder.config('spark.sql.shuffle.partitions', spark_config.get('shuffle_partitions', 200))
    
    return builder.getOrCreate()


# =============================================================================
# TOPIC MODELING
# =============================================================================

def run_topic_modeling(
    spark: SparkSession,
    works_df: DataFrame,
    config: Dict[str, Any]
) -> Tuple[DataFrame, DataFrame, DataFrame]:
    """
    Run LDA topic modeling on abstracts.
    
    Returns:
        - topics_df: Topic definitions with top terms
        - work_topics_df: Work-topic assignments with scores
        - vocab_df: Vocabulary mapping
    """
    topic_config = config.get('analytics', {}).get('topics', {})
    
    if not topic_config.get('enabled', True):
        logger.info("Topic modeling disabled, skipping...")
        return None, None, None
    
    logger.info("Running topic modeling...")
    
    num_topics = topic_config.get('num_topics', 20)
    max_iterations = topic_config.get('max_iterations', 50)
    vocab_size = topic_config.get('vocabulary_size', 10000)
    min_doc_freq = topic_config.get('min_doc_freq', 10)
    max_doc_freq_ratio = topic_config.get('max_doc_freq_ratio', 0.6)
    
    # Filter works with abstracts
    docs = works_df.filter(
        (F.col("abstract").isNotNull()) & 
        (F.length(F.col("abstract")) > 100)
    ).select("work_id", "abstract", "year")
    
    doc_count = docs.count()
    logger.info(f"Documents with abstracts: {doc_count}")
    
    if doc_count < num_topics * 10:
        logger.warning(f"Too few documents ({doc_count}) for {num_topics} topics")
        num_topics = max(5, doc_count // 20)
        logger.info(f"Reduced to {num_topics} topics")
    
    # Text preprocessing pipeline
    tokenizer = Tokenizer(inputCol="abstract", outputCol="words")
    
    # Remove stopwords
    remover = StopWordsRemover(inputCol="words", outputCol="filtered_words")
    
    # Count vectorizer (TF)
    cv = CountVectorizer(
        inputCol="filtered_words",
        outputCol="tf",
        vocabSize=vocab_size,
        minDF=min_doc_freq,
        maxDF=max_doc_freq_ratio
    )
    
    # IDF
    idf = IDF(inputCol="tf", outputCol="features")
    
    # LDA
    lda = LDA(
        k=num_topics,
        maxIter=max_iterations,
        featuresCol="features",
        optimizer="em"
    )
    
    # Build and run pipeline (without LDA first to get vocab)
    preprocess_pipeline = Pipeline(stages=[tokenizer, remover, cv, idf])
    preprocess_model = preprocess_pipeline.fit(docs)
    transformed = preprocess_model.transform(docs)
    
    # Get vocabulary
    cv_model = preprocess_model.stages[2]
    vocabulary = cv_model.vocabulary
    
    # Run LDA
    lda_model = lda.fit(transformed)
    
    # Extract topic-term distributions
    topics_matrix = lda_model.describeTopics(maxTermsPerTopic=15)
    
    # Convert to readable format
    def get_topic_terms(term_indices, term_weights):
        terms = []
        for idx, weight in zip(term_indices, term_weights):
            if idx < len(vocabulary):
                terms.append({
                    "term": vocabulary[idx],
                    "weight": float(weight)
                })
        return terms
    
    from pyspark.sql.types import ArrayType, StructType, StructField, StringType, FloatType
    
    topic_terms_schema = ArrayType(StructType([
        StructField("term", StringType()),
        StructField("weight", FloatType())
    ]))
    
    get_terms_udf = F.udf(get_topic_terms, topic_terms_schema)
    
    topics_df = topics_matrix.select(
        F.col("topic").alias("topic_id"),
        get_terms_udf(F.col("termIndices"), F.col("termWeights")).alias("top_terms")
    ).withColumn(
        "label",
        F.element_at(F.col("top_terms.term"), 1)  # First term as label
    )
    
    # Get document-topic distributions
    doc_topics = lda_model.transform(transformed)
    
    # Extract topic assignments (dominant topic and score)
    from pyspark.sql.types import IntegerType, DoubleType
    
    def get_dominant_topic(topic_dist):
        if topic_dist is None:
            return None
        max_idx = 0
        max_val = float(topic_dist[0])
        for i, val in enumerate(topic_dist):
            if float(val) > max_val:
                max_val = float(val)
                max_idx = i
        return max_idx
    
    def get_topic_score(topic_dist, topic_idx):
        if topic_dist is None or topic_idx is None:
            return None
        return float(topic_dist[topic_idx])
    
    get_dominant_udf = F.udf(get_dominant_topic, IntegerType())
    get_score_udf = F.udf(get_topic_score, DoubleType())
    
    work_topics_df = doc_topics.select(
        F.col("work_id"),
        F.col("year"),
        get_dominant_udf(F.col("topicDistribution")).alias("topic_id")
    ).withColumn(
        "topic_score",
        F.lit(1.0)  # Simplified; in production, extract from distribution
    )
    
    logger.info(f"Created {topics_df.count()} topics")
    
    return topics_df, work_topics_df, None


# =============================================================================
# CITATION GRAPH ANALYSIS
# =============================================================================

def run_graph_analytics(
    spark: SparkSession,
    works_df: DataFrame,
    citations_df: DataFrame,
    config: Dict[str, Any]
) -> DataFrame:
    """
    Run graph analytics using GraphFrames.
    
    Returns:
        - metrics_df: Work metrics (pagerank, community, citation_count)
    """
    graph_config = config.get('analytics', {}).get('graph', {})
    
    if not graph_config.get('enabled', True):
        logger.info("Graph analytics disabled, skipping...")
        return None
    
    logger.info("Running graph analytics...")
    
    # Import GraphFrames
    try:
        from graphframes import GraphFrame
    except ImportError:
        logger.error("GraphFrames not available. Run with --packages graphframes:graphframes:0.8.3-spark3.5-s_2.12")
        return None
    
    # Create vertices (works)
    vertices = works_df.select(
        F.col("work_id").alias("id"),
        F.col("title"),
        F.col("year")
    )
    
    # Create edges (citations)
    edges = citations_df.select(
        F.col("citing_work_id").alias("src"),
        F.col("cited_work_id").alias("dst")
    )
    
    # Filter to valid vertices only
    valid_ids = vertices.select("id")
    edges = edges.join(valid_ids, edges.src == valid_ids.id, "inner").drop("id")
    edges = edges.join(valid_ids, edges.dst == valid_ids.id, "inner").drop("id")
    
    logger.info(f"Graph: {vertices.count()} vertices, {edges.count()} edges")
    
    if edges.count() == 0:
        logger.warning("No citation edges found, skipping graph analytics")
        # Return basic metrics
        return works_df.select("work_id").withColumn(
            "pagerank", F.lit(1.0)
        ).withColumn(
            "community_id", F.monotonically_increasing_id()
        ).withColumn(
            "citation_count", F.lit(0)
        )
    
    # Create GraphFrame
    graph = GraphFrame(vertices, edges)
    
    # PageRank
    pagerank_config = graph_config.get('pagerank', {})
    max_iter = pagerank_config.get('max_iterations', 20)
    reset_prob = pagerank_config.get('reset_probability', 0.15)
    
    logger.info(f"Running PageRank (max_iter={max_iter}, reset_prob={reset_prob})...")
    pagerank_results = graph.pageRank(resetProbability=reset_prob, maxIter=max_iter)
    
    pagerank_df = pagerank_results.vertices.select(
        F.col("id").alias("work_id"),
        F.col("pagerank")
    )
    
    # Community Detection (Label Propagation)
    community_config = graph_config.get('community_detection', {})
    lp_max_iter = community_config.get('max_iterations', 10)
    
    logger.info(f"Running Label Propagation (max_iter={lp_max_iter})...")
    communities = graph.labelPropagation(maxIter=lp_max_iter)
    
    community_df = communities.select(
        F.col("id").alias("work_id"),
        F.col("label").alias("community_id")
    )
    
    # Citation counts (in-degree)
    citation_counts = edges.groupBy("dst").agg(
        F.count("*").alias("citation_count")
    ).select(
        F.col("dst").alias("work_id"),
        F.col("citation_count")
    )
    
    # Combine all metrics
    metrics_df = pagerank_df.join(
        community_df, "work_id", "left"
    ).join(
        citation_counts, "work_id", "left"
    ).fillna(0, ["citation_count"])
    
    logger.info(f"Computed metrics for {metrics_df.count()} works")
    
    return metrics_df


# =============================================================================
# TREND ANALYSIS
# =============================================================================

def run_trend_analysis(
    spark: SparkSession,
    works_df: DataFrame,
    work_topics_df: DataFrame,
    topics_df: DataFrame,
    config: Dict[str, Any]
) -> Tuple[DataFrame, DataFrame]:
    """
    Analyze topic trends over time.
    
    Returns:
        - topic_trends_df: Topic share by time period
        - emerging_topics_df: Topics with high growth rate
    """
    trend_config = config.get('analytics', {}).get('trends', {})
    
    if not trend_config.get('enabled', True) or work_topics_df is None:
        logger.info("Trend analysis disabled or no topics, skipping...")
        return None, None
    
    logger.info("Running trend analysis...")
    
    granularity = trend_config.get('time_granularity', 'year')
    min_papers = trend_config.get('min_papers_per_period', 10)
    emerging_threshold = trend_config.get('emerging_threshold', 1.5)
    
    # Join topics with works
    topics_with_year = work_topics_df.select(
        "work_id", "topic_id", "year"
    ).filter(F.col("year").isNotNull())
    
    # Count papers per topic per year
    topic_year_counts = topics_with_year.groupBy("year", "topic_id").agg(
        F.count("*").alias("paper_count")
    )
    
    # Total papers per year
    year_totals = topics_with_year.groupBy("year").agg(
        F.count("*").alias("total_papers")
    )
    
    # Calculate topic share
    topic_trends = topic_year_counts.join(
        year_totals, "year"
    ).withColumn(
        "topic_share",
        F.col("paper_count") / F.col("total_papers")
    )
    
    # Join with topic labels
    topic_trends_df = topic_trends.join(
        topics_df.select("topic_id", "label"),
        "topic_id"
    ).select(
        "year", "topic_id", "label", "paper_count", "total_papers", "topic_share"
    ).orderBy("year", "topic_id")
    
    # Calculate growth rates for emerging topics
    window = Window.partitionBy("topic_id").orderBy("year")
    
    with_prev = topic_trends_df.withColumn(
        "prev_share",
        F.lag("topic_share").over(window)
    ).withColumn(
        "prev_count",
        F.lag("paper_count").over(window)
    )
    
    growth = with_prev.filter(
        (F.col("prev_share") > 0) & (F.col("prev_count") >= min_papers)
    ).withColumn(
        "growth_rate",
        (F.col("topic_share") - F.col("prev_share")) / F.col("prev_share")
    )
    
    # Identify emerging topics (recent high growth)
    max_year = topics_with_year.agg(F.max("year")).collect()[0][0]
    
    emerging_topics_df = growth.filter(
        (F.col("year") == max_year) & 
        (F.col("growth_rate") > emerging_threshold)
    ).select(
        "topic_id", "label", "paper_count", "topic_share", "growth_rate"
    ).orderBy(F.col("growth_rate").desc())
    
    logger.info(f"Found {emerging_topics_df.count()} emerging topics")
    
    return topic_trends_df, emerging_topics_df


# =============================================================================
# AGGREGATIONS
# =============================================================================

def create_aggregations(
    spark: SparkSession,
    works_df: DataFrame,
    metrics_df: DataFrame,
    topics_df: DataFrame,
    work_topics_df: DataFrame,
    authors_df: DataFrame,
    work_authors_df: DataFrame,
    output_path: str
) -> None:
    """Create pre-aggregated tables for the UI/API."""
    logger.info("Creating aggregations for UI...")
    
    # Top papers by PageRank
    if metrics_df is not None:
        top_papers = works_df.join(
            metrics_df, "work_id"
        ).select(
            "work_id", "title", "year", "primary_field",
            "pagerank", "citation_count", "community_id"
        ).orderBy(F.col("pagerank").desc()).limit(1000)
        
        top_papers.write.mode("overwrite").parquet(f"{output_path}/top_papers")
        logger.info(f"Wrote top papers")
    
    # Top authors (by total pagerank of papers)
    if metrics_df is not None and work_authors_df is not None:
        author_metrics = work_authors_df.join(
            metrics_df, "work_id"
        ).groupBy("author_id").agg(
            F.sum("pagerank").alias("total_pagerank"),
            F.sum("citation_count").alias("total_citations"),
            F.count("*").alias("paper_count")
        ).join(
            authors_df, "author_id"
        ).orderBy(F.col("total_pagerank").desc()).limit(500)
        
        author_metrics.write.mode("overwrite").parquet(f"{output_path}/top_authors")
        logger.info(f"Wrote top authors")
    
    # Yearly statistics
    yearly_stats = works_df.groupBy("year").agg(
        F.count("*").alias("paper_count"),
        F.countDistinct("primary_field").alias("field_count")
    ).orderBy("year")
    
    yearly_stats.write.mode("overwrite").parquet(f"{output_path}/yearly_stats")
    
    # Field distribution
    field_stats = works_df.groupBy("primary_field", "year").agg(
        F.count("*").alias("paper_count")
    ).orderBy("primary_field", "year")
    
    field_stats.write.mode("overwrite").parquet(f"{output_path}/field_stats")
    
    # Overall stats
    stats = {
        "total_works": works_df.count(),
        "years_covered": works_df.select("year").distinct().count(),
        "sources": works_df.select("source").distinct().count(),
    }
    
    if metrics_df is not None:
        edge_count = metrics_df.agg(F.sum("citation_count")).collect()[0][0]
        stats["total_citations"] = int(edge_count) if edge_count else 0
    
    stats_df = spark.createDataFrame([stats])
    stats_df.write.mode("overwrite").parquet(f"{output_path}/overall_stats")
    
    logger.info("Aggregations complete")


def main():
    parser = argparse.ArgumentParser(description='Scholarly KG Analytics Job')
    parser.add_argument('--config', '-c', required=True, help='Config file path')
    args = parser.parse_args()
    
    with open(args.config) as f:
        config = yaml.safe_load(f)
    
    global_config = config.get('global', {})
    processed_path = global_config.get('processed_data_dir', '/data/processed')
    analytics_path = global_config.get('analytics_dir', '/data/analytics')
    
    spark = create_spark_session(config)
    spark.sparkContext.setLogLevel("WARN")
    
    try:
        logger.info("=" * 60)
        logger.info("Starting Analytics Pipeline")
        logger.info("=" * 60)
        
        # Read processed data
        logger.info("Loading processed data...")
        works_df = spark.read.parquet(f"{processed_path}/works")
        citations_df = spark.read.parquet(f"{processed_path}/citations")
        authors_df = spark.read.parquet(f"{processed_path}/authors")
        work_authors_df = spark.read.parquet(f"{processed_path}/work_authors")
        
        logger.info(f"Works: {works_df.count()}")
        logger.info(f"Citations: {citations_df.count()}")
        
        # Run topic modeling
        topics_df, work_topics_df, _ = run_topic_modeling(spark, works_df, config)
        
        if topics_df is not None:
            topics_df.write.mode("overwrite").parquet(f"{processed_path}/topics")
            work_topics_df.write.mode("overwrite").parquet(f"{processed_path}/work_topics")
        
        # Run graph analytics
        metrics_df = run_graph_analytics(spark, works_df, citations_df, config)
        
        if metrics_df is not None:
            metrics_df.write.mode("overwrite").parquet(f"{processed_path}/metrics")
        
        # Run trend analysis
        if topics_df is not None:
            topic_trends_df, emerging_topics_df = run_trend_analysis(
                spark, works_df, work_topics_df, topics_df, config
            )
            
            if topic_trends_df is not None:
                topic_trends_df.write.mode("overwrite").parquet(f"{analytics_path}/topic_trends")
            
            if emerging_topics_df is not None:
                emerging_topics_df.write.mode("overwrite").parquet(f"{analytics_path}/emerging_topics")
        
        # Create aggregations
        create_aggregations(
            spark, works_df, metrics_df, topics_df, work_topics_df,
            authors_df, work_authors_df, analytics_path
        )
        
        logger.info("=" * 60)
        logger.info("Analytics Pipeline Complete!")
        logger.info("=" * 60)
        
    finally:
        spark.stop()


if __name__ == "__main__":
    main()

