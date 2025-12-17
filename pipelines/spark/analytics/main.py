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
    Tokenizer, StopWordsRemover, CountVectorizer, IDF, NGram, RegexTokenizer
)
from pyspark.ml.clustering import LDA
from pyspark.ml import Pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Scientific filler words to exclude from topic labels
# This comprehensive list prevents generic/nonsense topic labels like "Identified"
SCIENTIFIC_STOPWORDS = {
    # Generic research terms - MUST filter these
    'study', 'studies', 'research', 'paper', 'papers', 'method', 'methods', 
    'results', 'result', 'analysis', 'approach', 'approaches', 'model', 'models',
    'data', 'dataset', 'datasets', 'performance', 'experiments', 'experiment',
    'proposed', 'using', 'based', 'show', 'shows', 'shown', 'demonstrate',
    'demonstrates', 'present', 'presents', 'presented', 'work', 'works',
    'previous', 'existing', 'framework', 'technique', 'techniques',
    
    # CRITICAL: Generic verbs that often become topic labels incorrectly
    'identified', 'identify', 'identifying', 'evaluate', 'evaluated', 'evaluating',
    'achieved', 'achieve', 'achieving', 'developed', 'develop', 'developing',
    'obtained', 'obtain', 'obtaining', 'observed', 'observe', 'observing',
    'performed', 'perform', 'performing', 'conducted', 'conduct', 'conducting',
    'reported', 'report', 'reporting', 'measured', 'measure', 'measuring',
    'compared', 'compare', 'comparing', 'analyzed', 'analyze', 'analyzing',
    'examined', 'examine', 'examining', 'investigated', 'investigate', 'investigating',
    'assessed', 'assess', 'assessing', 'determined', 'determine', 'determining',
    'applied', 'apply', 'applying', 'considered', 'consider', 'considering',
    
    # Medical/bio filler
    'patients', 'patient', 'treatment', 'treatments', 'clinical', 'health',
    'disease', 'diseases', 'therapy', 'diagnosis', 'outcomes', 'outcome',
    'effect', 'effects', 'risk', 'factors', 'factor', 'associated',
    'significantly', 'group', 'groups', 'sample', 'samples', 'subjects',
    
    # Common verbs/adjectives
    'new', 'novel', 'improved', 'better', 'high', 'low', 'different',
    'various', 'several', 'many', 'use', 'used', 'provide', 'provides',
    'compared', 'however', 'also', 'well', 'findings', 'able',
    'important', 'significant', 'recent', 'current', 'state', 'art',
    
    # Numbers and units
    'one', 'two', 'three', 'first', 'second', 'third', 'may', 'can',
    'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    
    # Additional generic terms
    'problem', 'problems', 'task', 'tasks', 'system', 'systems', 'process',
    'processes', 'application', 'applications', 'information', 'level',
    'number', 'time', 'set', 'case', 'cases', 'example', 'examples',
    'feature', 'features', 'input', 'output', 'value', 'values',
    'type', 'types', 'form', 'forms', 'part', 'parts', 'order', 'area',
    'point', 'points', 'way', 'ways', 'step', 'steps', 'stage', 'stages',
    
    # AI/ML generic (keep specific terms like "transformer", "attention", "convolution")
    'learning', 'training', 'testing', 'network', 'networks', 'layer',
    'layers', 'algorithm', 'algorithms', 'accuracy', 'error', 'loss',
    'function', 'functions', 'parameter', 'parameters', 'weight', 'weights',
    'optimization', 'optimize', 'optimized', 'train', 'trained', 'test', 'tested',
    
    # More generic scientific terms
    'context', 'contexts', 'condition', 'conditions', 'strategy', 'strategies',
    'mechanism', 'mechanisms', 'structure', 'structures', 'property', 'properties',
    'quality', 'quantity', 'rate', 'rates', 'degree', 'degrees', 'ratio', 'ratios',
    'component', 'components', 'element', 'elements', 'source', 'sources',
    'target', 'targets', 'object', 'objects', 'class', 'classes', 'category',
    'measure', 'measures', 'metric', 'metrics', 'score', 'scores',
    'baseline', 'baselines', 'benchmark', 'benchmarks', 'standard', 'standards',
}


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
    
    # Text preprocessing pipeline with bigrams
    # Use RegexTokenizer to handle punctuation better
    tokenizer = RegexTokenizer(
        inputCol="abstract", 
        outputCol="words",
        pattern="\\W+",  # Split on non-word characters
        minTokenLength=3  # Ignore short tokens
    )
    
    # Remove stopwords
    remover = StopWordsRemover(inputCol="words", outputCol="filtered_words")
    
    # Generate bigrams for phrase detection
    bigram = NGram(n=2, inputCol="filtered_words", outputCol="bigrams")
    
    # Count vectorizer for unigrams
    cv_unigram = CountVectorizer(
        inputCol="filtered_words",
        outputCol="tf_unigram",
        vocabSize=vocab_size // 2,
        minDF=min_doc_freq,
        maxDF=max_doc_freq_ratio
    )
    
    # Count vectorizer for bigrams  
    cv_bigram = CountVectorizer(
        inputCol="bigrams",
        outputCol="tf_bigram",
        vocabSize=vocab_size // 2,
        minDF=max(3, min_doc_freq // 2),  # Bigrams need fewer occurrences
        maxDF=max_doc_freq_ratio
    )
    
    # We'll use unigrams for simplicity (bigrams add complexity)
    # but filter better with expanded stopwords
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
    
    # Convert to readable format with filler word filtering
    def get_topic_terms(term_indices, term_weights):
        terms = []
        for idx, weight in zip(term_indices, term_weights):
            if idx < len(vocabulary):
                term = vocabulary[idx].lower()
                # Skip scientific filler words and short terms
                if term not in SCIENTIFIC_STOPWORDS and len(term) > 3:
                    terms.append({
                        "term": vocabulary[idx],
                        "weight": float(weight)
                    })
        # Return at least some terms even if all filtered
        if not terms and term_indices:
            for idx, weight in zip(term_indices[:3], term_weights[:3]):
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
        # Use first term as label (already filtered by get_topic_terms)
        # Single term is cleaner for display
        "label",
        F.coalesce(
            F.initcap(F.element_at(F.col("top_terms.term"), 1)),
            F.lit("Unknown Topic")
        )
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

# Labels that are too generic for meaningful emerging topics
# These should match SCIENTIFIC_STOPWORDS for consistency
GENERIC_TOPIC_LABELS = {
    'patients', 'patient', 'sample', 'samples', 'data', 'model', 'models',
    'method', 'methods', 'study', 'studies', 'results', 'analysis', 'group',
    'groups', 'effect', 'effects', 'level', 'levels', 'approach', 'system',
    'systems', 'performance', 'time', 'rate', 'risk', 'treatment', 'clinical',
    # CRITICAL: Add all generic verbs that wrongly become topic labels
    'identified', 'identify', 'using', 'based', 'proposed', 'developed',
    'evaluated', 'achieved', 'obtained', 'performed', 'observed', 'measured',
    'conducted', 'compared', 'analyzed', 'examined', 'investigated', 'determined',
    'applied', 'demonstrate', 'demonstrated', 'present', 'presented', 'show',
    'network', 'networks', 'learning', 'training', 'algorithm', 'algorithms',
}

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
    min_papers_prev = trend_config.get('min_papers_per_period', 5)  # Min in previous period
    min_papers_current = trend_config.get('min_papers_current', 3)  # Min in current period
    emerging_threshold = trend_config.get('emerging_threshold', 0.3)  # 30% growth = emerging
    
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
    # Use 2-year rolling windows for more stability
    window = Window.partitionBy("topic_id").orderBy("year")
    
    with_rolling = topic_trends_df.withColumn(
        # Previous year's values
        "prev_share",
        F.lag("topic_share", 1).over(window)
    ).withColumn(
        "prev_count",
        F.lag("paper_count", 1).over(window)
    ).withColumn(
        # Two years ago (for smoothing)
        "prev2_share",
        F.lag("topic_share", 2).over(window)
    ).withColumn(
        "prev2_count",
        F.lag("paper_count", 2).over(window)
    )
    
    # Calculate growth using smoothed baseline (avg of prev 1-2 years)
    growth = with_rolling.withColumn(
        "baseline_share",
        F.coalesce(
            (F.col("prev_share") + F.coalesce(F.col("prev2_share"), F.col("prev_share"))) / 2,
            F.col("prev_share")
        )
    ).withColumn(
        "baseline_count",
        F.coalesce(
            (F.col("prev_count") + F.coalesce(F.col("prev2_count"), F.col("prev_count"))) / 2,
            F.col("prev_count")
        )
    ).filter(
        # Require minimum support in BOTH periods
        (F.col("baseline_share") > 0) & 
        (F.col("baseline_count") >= min_papers_prev) &
        (F.col("paper_count") >= min_papers_current)
    ).withColumn(
        "growth_rate",
        (F.col("topic_share") - F.col("baseline_share")) / F.col("baseline_share")
    )
    
    # Identify emerging topics in most recent year
    max_year = topics_with_year.agg(F.max("year")).collect()[0][0]
    
    # Filter out generic/filler topic labels
    generic_labels_lower = [l.lower() for l in GENERIC_TOPIC_LABELS]
    
    emerging_topics_df = growth.filter(
        (F.col("year") == max_year) & 
        (F.col("growth_rate") > emerging_threshold) &
        # Exclude generic labels (check if first word of label is generic)
        (~F.lower(F.split(F.col("label"), " ")[0]).isin(generic_labels_lower))
    ).select(
        "topic_id", "label", "paper_count", "topic_share", "growth_rate"
    ).orderBy(F.col("growth_rate").desc())
    
    # If we have no emerging topics, get the top growing topics above 0%
    if emerging_topics_df.count() == 0:
        logger.warning("No emerging topics above threshold, using top positive growth")
        emerging_topics_df = growth.filter(
            (F.col("year") == max_year) & 
            (F.col("growth_rate") > 0) &
            (~F.lower(F.split(F.col("label"), " ")[0]).isin(generic_labels_lower))
        ).select(
            "topic_id", "label", "paper_count", "topic_share", "growth_rate"
        ).orderBy(F.col("growth_rate").desc()).limit(10)
    
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

