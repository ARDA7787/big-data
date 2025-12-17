"""
Rate limiting utilities for API requests.

Provides:
- Token bucket rate limiting
- Exponential backoff retry logic
- Request tracking and metrics
"""

import asyncio
import logging
import time
from typing import Any, Callable, Optional, TypeVar

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
import httpx

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RateLimiter:
    """Token bucket rate limiter for API requests."""
    
    def __init__(
        self,
        requests_per_second: float,
        burst_size: Optional[int] = None
    ):
        """
        Initialize the rate limiter.
        
        Args:
            requests_per_second: Maximum requests per second
            burst_size: Maximum burst size (defaults to 1)
        """
        self.requests_per_second = requests_per_second
        self.burst_size = burst_size or 1
        self.tokens = float(self.burst_size)
        self.last_update = time.monotonic()
        self._lock = asyncio.Lock()
        
        # Metrics
        self.total_requests = 0
        self.total_wait_time = 0.0
    
    async def acquire(self) -> float:
        """
        Acquire a token, waiting if necessary.
        
        Returns:
            Time waited in seconds
        """
        async with self._lock:
            now = time.monotonic()
            
            # Replenish tokens
            time_passed = now - self.last_update
            self.tokens = min(
                self.burst_size,
                self.tokens + time_passed * self.requests_per_second
            )
            self.last_update = now
            
            # Wait if no tokens available
            wait_time = 0.0
            if self.tokens < 1:
                wait_time = (1 - self.tokens) / self.requests_per_second
                await asyncio.sleep(wait_time)
                self.tokens = 0
            else:
                self.tokens -= 1
            
            self.total_requests += 1
            self.total_wait_time += wait_time
            
            return wait_time
    
    def get_stats(self) -> dict[str, Any]:
        """Get rate limiter statistics."""
        return {
            'total_requests': self.total_requests,
            'total_wait_time': round(self.total_wait_time, 2),
            'avg_wait_time': round(
                self.total_wait_time / max(1, self.total_requests), 4
            ),
            'requests_per_second': self.requests_per_second
        }


class RetryableHTTPClient:
    """HTTP client with retry logic and rate limiting."""
    
    def __init__(
        self,
        rate_limiter: RateLimiter,
        retry_attempts: int = 3,
        retry_backoff_factor: float = 2.0,
        timeout: float = 30.0
    ):
        """
        Initialize the HTTP client.
        
        Args:
            rate_limiter: Rate limiter instance
            retry_attempts: Maximum retry attempts
            retry_backoff_factor: Exponential backoff factor
            timeout: Request timeout in seconds
        """
        self.rate_limiter = rate_limiter
        self.retry_attempts = retry_attempts
        self.retry_backoff_factor = retry_backoff_factor
        self.timeout = timeout
        
        self._client: Optional[httpx.AsyncClient] = None
        
        # Metrics
        self.total_retries = 0
        self.total_errors = 0
    
    async def __aenter__(self) -> 'RetryableHTTPClient':
        """Async context manager entry."""
        self._client = httpx.AsyncClient(timeout=self.timeout)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()
    
    async def get(
        self,
        url: str,
        params: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None
    ) -> httpx.Response:
        """
        Make a GET request with rate limiting and retries.
        
        Args:
            url: Request URL
            params: Query parameters
            headers: Request headers
            
        Returns:
            HTTP response
        """
        await self.rate_limiter.acquire()
        
        for attempt in range(self.retry_attempts):
            try:
                response = await self._client.get(
                    url,
                    params=params,
                    headers=headers
                )
                
                # Handle rate limit responses
                if response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', 60))
                    logger.warning(f"Rate limited, waiting {retry_after}s")
                    await asyncio.sleep(retry_after)
                    self.total_retries += 1
                    continue
                
                response.raise_for_status()
                return response
                
            except httpx.HTTPStatusError as e:
                if e.response.status_code in (500, 502, 503, 504):
                    wait_time = self.retry_backoff_factor ** attempt
                    logger.warning(
                        f"Server error {e.response.status_code}, "
                        f"retrying in {wait_time}s (attempt {attempt + 1})"
                    )
                    await asyncio.sleep(wait_time)
                    self.total_retries += 1
                    continue
                raise
                
            except httpx.RequestError as e:
                if attempt < self.retry_attempts - 1:
                    wait_time = self.retry_backoff_factor ** attempt
                    logger.warning(
                        f"Request error: {e}, "
                        f"retrying in {wait_time}s (attempt {attempt + 1})"
                    )
                    await asyncio.sleep(wait_time)
                    self.total_retries += 1
                    continue
                raise
        
        self.total_errors += 1
        raise Exception(f"Failed after {self.retry_attempts} attempts: {url}")
    
    def get_stats(self) -> dict[str, Any]:
        """Get client statistics."""
        return {
            'total_retries': self.total_retries,
            'total_errors': self.total_errors,
            'rate_limiter': self.rate_limiter.get_stats()
        }


def create_sync_retry_decorator(
    attempts: int = 3,
    backoff_factor: float = 2.0
) -> Callable:
    """
    Create a synchronous retry decorator.
    
    Args:
        attempts: Maximum retry attempts
        backoff_factor: Exponential backoff factor
        
    Returns:
        Retry decorator
    """
    return retry(
        stop=stop_after_attempt(attempts),
        wait=wait_exponential(multiplier=backoff_factor, min=1, max=60),
        retry=retry_if_exception_type((
            ConnectionError,
            TimeoutError,
        )),
        before_sleep=lambda retry_state: logger.warning(
            f"Retrying after error: {retry_state.outcome.exception()}"
        )
    )

