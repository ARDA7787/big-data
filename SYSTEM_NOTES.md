# System Notes

Environment and configuration details for this deployment.

## Host System

| Property | Value |
|----------|-------|
| OS | macOS Darwin 25.0.0 |
| CPU Architecture | ARM64 (Apple Silicon M1) |
| Docker Desktop | 28.0.1 |
| Docker Compose | v2.33.1 |
| Make | GNU Make 3.81 |
| Git | 2.50.1 |

## Docker Resources

| Resource | Allocated |
|----------|-----------|
| Total Memory | 3.83 GB |
| CPUs | 8 |

**Note**: The limited memory (3.83 GB) can cause OOM issues when running all services simultaneously. Elasticsearch is particularly memory-hungry.

## Container Images

| Service | Image | Notes |
|---------|-------|-------|
| HDFS NameNode | bde2020/hadoop-namenode:2.0.0-hadoop3.2.1-java8 | x86_64 (emulated on ARM) |
| HDFS DataNode | bde2020/hadoop-datanode:2.0.0-hadoop3.2.1-java8 | x86_64 (emulated) |
| Spark Master | scholarly-spark-master:3.3.0 (custom build) | Based on bde2020/spark-master:3.3.0-hadoop3.3 |
| Spark Worker | scholarly-spark-worker:3.3.0 (custom build) | Based on bde2020/spark-worker:3.3.0-hadoop3.3 |
| Elasticsearch | docker.elastic.co/elasticsearch/elasticsearch:8.11.0 | Native ARM64 |
| Backend | infra-backend (custom build) | Python 3.11 |
| Frontend | infra-frontend (custom build) | Node.js 18 |

## Spark Configuration

| Property | Value |
|----------|-------|
| Spark Version | 3.3.0 |
| Python Version (in Spark) | 3.7 |
| GraphFrames | 0.8.2-spark3.2-s_2.12 |
| Worker Memory | 2g |
| Driver Memory | 1g (analytics) |
| Executor Memory | 1g (analytics) |
| Shuffle Partitions | 8 (analytics) |

### Baked Dependencies (in Spark image)

- `py3-numpy` 1.16.4 (via Alpine apk)
- `pyyaml` 6.0.1 (via pip)

## Python Environment

### Backend (FastAPI)
- Python 3.11
- elasticsearch>=8.11.0,<9.0.0 (pinned for server compatibility)
- See `apps/api/requirements.txt` for full list

### Ingestion Pipeline
- Python 3.11
- See `pipelines/ingest/requirements.txt`

### Spark Jobs
- Python 3.7 (container constraint)
- Type hints use `Dict`, `List`, `Tuple` from `typing` module (not Python 3.9+ syntax)

## Key Fixes Applied

1. **Spark Images**: Changed from `bitnami/spark:3.5` to `bde2020/spark-master:3.3.0-hadoop3.3` (bitnami images unavailable)

2. **Spark Dependencies**: Created custom Dockerfile to bake numpy and pyyaml into Spark images

3. **GraphFrames**: Downgraded from `0.8.3-spark3.5` to `0.8.2-spark3.2` for Spark 3.3 compatibility

4. **Python Compatibility**: Changed type hints from `dict[str, Any]` to `Dict[str, Any]` for Python 3.7

5. **Elasticsearch Client**: Pinned to `<9.0.0` to match server version 8.11.0

6. **arXiv API**: Changed from HTTP to HTTPS (301 redirect fix)

7. **Frontend**: Changed `npm ci` to `npm install` (no package-lock.json)

8. **Analytics Memory**: Reduced driver/executor memory to 1g, added shuffle partitions=8

## Known Limitations

1. **Memory Pressure**: With only ~4GB Docker memory, Elasticsearch may get OOM killed during heavy operations

2. **Platform Emulation**: x86_64 images run under Rosetta emulation on ARM64, causing performance overhead

3. **Indexing Errors**: Some documents fail to index due to missing required fields (98/900 indexed in demo)

4. **First Build Time**: Initial `make up` takes ~5 minutes to build custom Spark images

## Environment Variables

Key environment variables used:

```bash
SPARK_MASTER=spark://spark-master:7077
SPARK_WORKER_MEMORY=2g
CORE_CONF_fs_defaultFS=hdfs://namenode:9000
ELASTICSEARCH_URL=http://elasticsearch:9200
```

