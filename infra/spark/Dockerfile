# Spark image with Python dependencies for ETL/Analytics jobs
# Extends bde2020 spark images with required packages

ARG SPARK_IMAGE=bde2020/spark-master:3.3.0-hadoop3.3
FROM ${SPARK_IMAGE}

# Install Python dependencies needed for Spark jobs
# Using apk for numpy (pre-built binary, avoids compilation issues on Alpine)
# Using pip for pyyaml (pure Python, no compilation needed)
RUN apk add --no-cache py3-numpy && \
    pip3 install --no-cache-dir pyyaml==6.0.1

# Verify installations
RUN python3 -c "import numpy; print('numpy:', numpy.__version__)" && \
    python3 -c "import yaml; print('pyyaml: installed')"

