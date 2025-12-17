# ==============================================================================
# Scalable Scholarly Knowledge Graph - Makefile
# ==============================================================================

.PHONY: help up down logs status clean demo ingest etl analytics index \
        spark-shell test lint format build-images

# Default configuration
CONFIG ?= demo
COMPOSE_FILE := infra/docker-compose.yml
COMPOSE_CMD := docker compose -f $(COMPOSE_FILE)

# Colors for terminal output
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m

# ==============================================================================
# HELP
# ==============================================================================

help: ## Show this help message
	@echo "$(BLUE)╔══════════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║     Scalable Scholarly Knowledge Graph - Command Reference       ║$(NC)"
	@echo "$(BLUE)╚══════════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Usage examples:$(NC)"
	@echo "  make up                    # Start all services"
	@echo "  make demo                  # Run full pipeline (demo mode)"
	@echo "  make ingest CONFIG=full    # Run full ingestion"
	@echo ""

# ==============================================================================
# INFRASTRUCTURE
# ==============================================================================

up: ## Start all infrastructure containers
	@echo "$(BLUE)▶ Starting infrastructure...$(NC)"
	$(COMPOSE_CMD) up -d hdfs-namenode hdfs-datanode spark-master spark-worker-1 elasticsearch backend frontend
	@echo "$(GREEN)✓ Infrastructure started$(NC)"
	@echo ""
	@echo "$(YELLOW)Service URLs:$(NC)"
	@echo "  Frontend:       http://localhost:3000"
	@echo "  API:            http://localhost:8000"
	@echo "  API Docs:       http://localhost:8000/docs"
	@echo "  Spark Master:   http://localhost:8080"
	@echo "  HDFS NameNode:  http://localhost:9870"
	@echo "  Elasticsearch:  http://localhost:9200"

up-full: ## Start all containers including extra workers
	@echo "$(BLUE)▶ Starting full infrastructure...$(NC)"
	$(COMPOSE_CMD) --profile full up -d
	@echo "$(GREEN)✓ Full infrastructure started$(NC)"

up-prod: ## Start production configuration
	@echo "$(BLUE)▶ Starting production infrastructure...$(NC)"
	$(COMPOSE_CMD) --profile full up -d --scale spark-worker-1=2
	@echo "$(GREEN)✓ Production infrastructure started$(NC)"

down: ## Stop all containers
	@echo "$(BLUE)▶ Stopping infrastructure...$(NC)"
	$(COMPOSE_CMD) --profile full --profile ingestion down
	@echo "$(GREEN)✓ Infrastructure stopped$(NC)"

restart: down up ## Restart all containers

logs: ## View container logs (use CONTAINER=name for specific)
ifdef CONTAINER
	$(COMPOSE_CMD) logs -f $(CONTAINER)
else
	$(COMPOSE_CMD) logs -f
endif

status: ## Check status of all services
	@echo "$(BLUE)▶ Service Status$(NC)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@$(COMPOSE_CMD) ps
	@echo ""
	@echo "$(BLUE)▶ HDFS Status$(NC)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@docker exec -it hdfs-namenode hdfs dfsadmin -report 2>/dev/null | head -20 || echo "HDFS not ready"
	@echo ""
	@echo "$(BLUE)▶ Elasticsearch Status$(NC)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@curl -s http://localhost:9200/_cluster/health?pretty 2>/dev/null || echo "Elasticsearch not ready"

wait-healthy: ## Wait for all services to be healthy
	@echo "$(BLUE)▶ Waiting for services to be healthy...$(NC)"
	@until docker exec hdfs-namenode hdfs dfsadmin -safemode get 2>/dev/null | grep -q "Safe mode is OFF"; do \
		echo "  Waiting for HDFS to exit safe mode..."; \
		sleep 5; \
	done
	@echo "$(GREEN)✓ HDFS ready$(NC)"
	@until curl -s http://localhost:9200/_cluster/health 2>/dev/null | grep -q '"status"'; do \
		echo "  Waiting for Elasticsearch..."; \
		sleep 5; \
	done
	@echo "$(GREEN)✓ Elasticsearch ready$(NC)"
	@until curl -s http://localhost:8000/health 2>/dev/null | grep -q '"status"'; do \
		echo "  Waiting for API..."; \
		sleep 5; \
	done
	@echo "$(GREEN)✓ All services healthy$(NC)"

# ==============================================================================
# DATA PIPELINE
# ==============================================================================

init-hdfs: ## Initialize HDFS directories
	@echo "$(BLUE)▶ Initializing HDFS directories...$(NC)"
	docker exec hdfs-namenode hdfs dfs -mkdir -p /data/raw/arxiv
	docker exec hdfs-namenode hdfs dfs -mkdir -p /data/raw/pubmed
	docker exec hdfs-namenode hdfs dfs -mkdir -p /data/raw/openalex
	docker exec hdfs-namenode hdfs dfs -mkdir -p /data/processed/works
	docker exec hdfs-namenode hdfs dfs -mkdir -p /data/processed/authors
	docker exec hdfs-namenode hdfs dfs -mkdir -p /data/processed/citations
	docker exec hdfs-namenode hdfs dfs -mkdir -p /data/processed/topics
	docker exec hdfs-namenode hdfs dfs -mkdir -p /data/processed/metrics
	docker exec hdfs-namenode hdfs dfs -mkdir -p /data/analytics
	docker exec hdfs-namenode hdfs dfs -chmod -R 777 /data
	@echo "$(GREEN)✓ HDFS directories initialized$(NC)"

ingest: ## Run data ingestion (CONFIG=demo|full)
	@echo "$(BLUE)▶ Running ingestion with config: $(CONFIG)$(NC)"
	@mkdir -p data/raw data/checkpoints
	$(COMPOSE_CMD) --profile ingestion run --rm ingestion \
		python -m ingest.main --config /config/$(CONFIG).yaml
	@echo "$(GREEN)✓ Ingestion complete$(NC)"

ingest-arxiv: ## Run arXiv ingestion only
	@echo "$(BLUE)▶ Running arXiv ingestion...$(NC)"
	$(COMPOSE_CMD) --profile ingestion run --rm ingestion \
		python -m ingest.sources.arxiv --config /config/$(CONFIG).yaml

ingest-pubmed: ## Run PubMed ingestion only
	@echo "$(BLUE)▶ Running PubMed ingestion...$(NC)"
	$(COMPOSE_CMD) --profile ingestion run --rm ingestion \
		python -m ingest.sources.pubmed --config /config/$(CONFIG).yaml

ingest-openalex: ## Run OpenAlex ingestion only
	@echo "$(BLUE)▶ Running OpenAlex ingestion...$(NC)"
	$(COMPOSE_CMD) --profile ingestion run --rm ingestion \
		python -m ingest.sources.openalex --config /config/$(CONFIG).yaml

etl: ## Run Spark ETL jobs
	@echo "$(BLUE)▶ Running Spark ETL...$(NC)"
	docker exec spark-master /spark/bin/spark-submit \
		--master spark://spark-master:7077 \
		--deploy-mode client \
		--driver-memory 2g \
		--executor-memory 2g \
		--packages graphframes:graphframes:0.8.2-spark3.2-s_2.12 \
		/opt/spark-jobs/etl/main.py \
		--config /config/$(CONFIG).yaml
	@echo "$(GREEN)✓ ETL complete$(NC)"

analytics: ## Run Spark analytics jobs
	@echo "$(BLUE)▶ Running Spark analytics...$(NC)"
	docker exec spark-master /spark/bin/spark-submit \
		--master spark://spark-master:7077 \
		--deploy-mode client \
		--driver-memory 2g \
		--executor-memory 2g \
		--packages graphframes:graphframes:0.8.2-spark3.2-s_2.12 \
		/opt/spark-jobs/analytics/main.py \
		--config /config/$(CONFIG).yaml
	@echo "$(GREEN)✓ Analytics complete$(NC)"

index: ## Index data to Elasticsearch
	@echo "$(BLUE)▶ Indexing to Elasticsearch...$(NC)"
	docker exec backend python -m scripts.index_elasticsearch
	@echo "$(GREEN)✓ Indexing complete$(NC)"

# ==============================================================================
# DEMO & FULL PIPELINE
# ==============================================================================

demo: up wait-healthy init-hdfs ## Run complete demo pipeline
	@echo "$(BLUE)╔══════════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║              Running Complete Demo Pipeline                      ║$(NC)"
	@echo "$(BLUE)╚══════════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	$(MAKE) ingest CONFIG=demo
	$(MAKE) etl CONFIG=demo
	$(MAKE) analytics CONFIG=demo
	$(MAKE) index
	@echo ""
	@echo "$(GREEN)╔══════════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║                    Demo Pipeline Complete!                       ║$(NC)"
	@echo "$(GREEN)╚══════════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(YELLOW)Open the dashboard: http://localhost:3000$(NC)"

full-pipeline: up wait-healthy init-hdfs ## Run complete full pipeline
	@echo "$(BLUE)▶ Running full pipeline...$(NC)"
	$(MAKE) ingest CONFIG=full
	$(MAKE) etl CONFIG=full
	$(MAKE) analytics CONFIG=full
	$(MAKE) index
	@echo "$(GREEN)✓ Full pipeline complete$(NC)"

# ==============================================================================
# DEVELOPMENT
# ==============================================================================

spark-shell: ## Open interactive Spark shell
	docker exec -it spark-master spark-shell \
		--packages graphframes:graphframes:0.8.2-spark3.2-s_2.12

pyspark-shell: ## Open interactive PySpark shell
	docker exec -it spark-master pyspark \
		--packages graphframes:graphframes:0.8.2-spark3.2-s_2.12

hdfs-shell: ## Open HDFS shell
	docker exec -it hdfs-namenode bash

es-shell: ## Open Elasticsearch dev tools equivalent
	@echo "$(YELLOW)Use curl or visit http://localhost:9200$(NC)"
	@curl -s http://localhost:9200/_cat/indices?v

backend-shell: ## Open backend shell
	docker exec -it backend bash

frontend-shell: ## Open frontend shell
	docker exec -it frontend sh

# ==============================================================================
# BUILD & TEST
# ==============================================================================

build-images: ## Build all Docker images
	@echo "$(BLUE)▶ Building Docker images...$(NC)"
	$(COMPOSE_CMD) build
	@echo "$(GREEN)✓ Images built$(NC)"

test: ## Run all tests
	@echo "$(BLUE)▶ Running tests...$(NC)"
	docker exec backend pytest tests/ -v
	docker exec frontend npm test
	@echo "$(GREEN)✓ Tests passed$(NC)"

test-api: ## Run API tests only
	docker exec backend pytest tests/ -v

test-web: ## Run frontend tests only
	docker exec frontend npm test

lint: ## Run linters
	@echo "$(BLUE)▶ Running linters...$(NC)"
	docker exec backend ruff check .
	docker exec frontend npm run lint

format: ## Format code
	@echo "$(BLUE)▶ Formatting code...$(NC)"
	docker exec backend ruff format .
	docker exec frontend npm run format

# ==============================================================================
# CLEANUP
# ==============================================================================

clean: down ## Clean up containers and volumes
	@echo "$(BLUE)▶ Cleaning up...$(NC)"
	$(COMPOSE_CMD) --profile full --profile ingestion down -v
	rm -rf data/raw/* data/processed/* data/checkpoints/*
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

clean-data: ## Clean data only (keep containers)
	@echo "$(BLUE)▶ Cleaning data...$(NC)"
	rm -rf data/raw/* data/processed/* data/checkpoints/*
	docker exec hdfs-namenode hdfs dfs -rm -r -f /data/raw/* 2>/dev/null || true
	docker exec hdfs-namenode hdfs dfs -rm -r -f /data/processed/* 2>/dev/null || true
	@echo "$(GREEN)✓ Data cleaned$(NC)"

prune: clean ## Deep clean including Docker system prune
	@echo "$(BLUE)▶ Pruning Docker system...$(NC)"
	docker system prune -f
	@echo "$(GREEN)✓ Prune complete$(NC)"

# ==============================================================================
# MONITORING
# ==============================================================================

monitor-spark: ## Open Spark Master UI
	@echo "$(YELLOW)Opening Spark Master UI...$(NC)"
	open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080

monitor-hdfs: ## Open HDFS NameNode UI
	@echo "$(YELLOW)Opening HDFS NameNode UI...$(NC)"
	open http://localhost:9870 2>/dev/null || xdg-open http://localhost:9870

monitor-es: ## Show Elasticsearch cluster health
	@curl -s http://localhost:9200/_cluster/health?pretty

# ==============================================================================
# UTILITIES
# ==============================================================================

copy-to-hdfs: ## Copy local data to HDFS (use SRC=path)
ifdef SRC
	docker exec hdfs-namenode hdfs dfs -put -f /data/$(SRC) /data/$(SRC)
else
	@echo "$(RED)Error: Specify SRC=path$(NC)"
endif

copy-from-hdfs: ## Copy data from HDFS to local (use SRC=path)
ifdef SRC
	docker exec hdfs-namenode hdfs dfs -get /data/$(SRC) /data/$(SRC)
else
	@echo "$(RED)Error: Specify SRC=path$(NC)"
endif

generate-sample-data: ## Generate sample data for testing
	@echo "$(BLUE)▶ Generating sample data...$(NC)"
	docker exec backend python -m scripts.generate_sample_data
	@echo "$(GREEN)✓ Sample data generated$(NC)"

