"""
Application configuration using Pydantic Settings.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment variables."""
    
    # Elasticsearch
    elasticsearch_url: str = "http://localhost:9200"
    elasticsearch_index: str = "scholarly_works"
    
    # Data paths
    data_path: str = "/data/processed"
    analytics_path: str = "/data/analytics"
    
    # HDFS (if using)
    hdfs_namenode: str = "hdfs://namenode:9000"
    
    # Logging
    log_level: str = "INFO"
    
    # API settings
    api_prefix: str = ""
    debug: bool = False
    
    # Pagination defaults
    default_page_size: int = 20
    max_page_size: int = 100
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

