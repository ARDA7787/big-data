"""
Main entry point for the ingestion pipeline.

Orchestrates data collection from all configured sources with:
- Parallel execution where appropriate
- Checkpointing for resumability
- Comprehensive logging and metrics
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from ingest.sources.arxiv import ArxivIngester
from ingest.sources.pubmed import PubMedIngester
from ingest.sources.openalex import OpenAlexIngester
from ingest.utils.checkpoint import CheckpointManager
from ingest.utils.storage import StorageManager

console = Console()
logger = logging.getLogger(__name__)


def load_config(config_path: str) -> dict[str, Any]:
    """Load configuration from YAML file."""
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def setup_logging(config: dict[str, Any]) -> None:
    """Configure logging based on config."""
    log_config = config.get('logging', {})
    level = getattr(logging, log_config.get('level', 'INFO'))
    format_str = log_config.get('format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    logging.basicConfig(
        level=level,
        format=format_str,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ]
    )
    
    # Also log to file if configured
    log_file = log_config.get('file')
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(logging.Formatter(format_str))
        logging.getLogger().addHandler(file_handler)


async def run_ingestion(config: dict[str, Any]) -> dict[str, Any]:
    """Run the complete ingestion pipeline."""
    results = {
        'start_time': datetime.utcnow().isoformat(),
        'sources': {},
        'total_records': 0,
        'errors': []
    }
    
    global_config = config.get('global', {})
    checkpoint_dir = global_config.get('checkpoint_dir', '/data/checkpoints')
    raw_data_dir = global_config.get('raw_data_dir', '/data/raw')
    
    # Initialize managers
    checkpoint_mgr = CheckpointManager(checkpoint_dir)
    storage_mgr = StorageManager(raw_data_dir)
    
    # Ingest from each source
    sources = [
        ('arxiv', ArxivIngester, config.get('arxiv', {})),
        ('pubmed', PubMedIngester, config.get('pubmed', {})),
        ('openalex', OpenAlexIngester, config.get('openalex', {})),
    ]
    
    for source_name, ingester_class, source_config in sources:
        if not source_config.get('enabled', False):
            console.print(f"[yellow]⏭ Skipping {source_name} (disabled)[/yellow]")
            continue
            
        console.print(f"\n[blue]▶ Ingesting from {source_name}...[/blue]")
        
        try:
            ingester = ingester_class(
                config=source_config,
                checkpoint_manager=checkpoint_mgr,
                storage_manager=storage_mgr,
            )
            
            source_result = await ingester.ingest()
            results['sources'][source_name] = source_result
            results['total_records'] += source_result.get('records_ingested', 0)
            
            console.print(
                f"[green]✓ {source_name}: {source_result.get('records_ingested', 0)} records[/green]"
            )
            
        except Exception as e:
            error_msg = f"Error ingesting from {source_name}: {str(e)}"
            logger.exception(error_msg)
            results['errors'].append(error_msg)
            results['sources'][source_name] = {'error': str(e)}
            console.print(f"[red]✗ {source_name}: {str(e)}[/red]")
    
    results['end_time'] = datetime.utcnow().isoformat()
    return results


def print_summary(results: dict[str, Any]) -> None:
    """Print a summary of ingestion results."""
    console.print("\n")
    console.print("[bold blue]═" * 60 + "[/bold blue]")
    console.print("[bold blue]           INGESTION SUMMARY[/bold blue]")
    console.print("[bold blue]═" * 60 + "[/bold blue]")
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Source", style="cyan")
    table.add_column("Records", justify="right", style="green")
    table.add_column("Status", style="yellow")
    
    for source, data in results.get('sources', {}).items():
        if 'error' in data:
            table.add_row(source, "0", f"[red]Error: {data['error'][:30]}...[/red]")
        else:
            table.add_row(
                source,
                str(data.get('records_ingested', 0)),
                "[green]Success[/green]"
            )
    
    console.print(table)
    console.print(f"\n[bold]Total Records: {results.get('total_records', 0)}[/bold]")
    
    if results.get('errors'):
        console.print(f"\n[red]Errors: {len(results['errors'])}[/red]")
        for error in results['errors']:
            console.print(f"  [red]• {error}[/red]")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Scholarly Knowledge Graph - Data Ingestion Pipeline'
    )
    parser.add_argument(
        '--config', '-c',
        required=True,
        help='Path to configuration YAML file'
    )
    parser.add_argument(
        '--source', '-s',
        choices=['arxiv', 'pubmed', 'openalex'],
        help='Run only a specific source'
    )
    parser.add_argument(
        '--resume',
        action='store_true',
        help='Resume from last checkpoint'
    )
    
    args = parser.parse_args()
    
    # Load configuration
    config = load_config(args.config)
    
    # If specific source requested, disable others
    if args.source:
        for source in ['arxiv', 'pubmed', 'openalex']:
            if source != args.source:
                config[source]['enabled'] = False
    
    # Setup logging
    setup_logging(config)
    
    # Print header
    console.print("\n[bold blue]╔" + "═" * 58 + "╗[/bold blue]")
    console.print("[bold blue]║   Scalable Scholarly Knowledge Graph - Ingestion        ║[/bold blue]")
    console.print("[bold blue]╚" + "═" * 58 + "╝[/bold blue]")
    console.print(f"\n[dim]Mode: {config.get('mode', 'unknown')}[/dim]")
    console.print(f"[dim]Config: {args.config}[/dim]")
    
    # Run ingestion
    try:
        results = asyncio.run(run_ingestion(config))
        print_summary(results)
        
        if results.get('errors'):
            sys.exit(1)
            
    except KeyboardInterrupt:
        console.print("\n[yellow]Ingestion interrupted by user[/yellow]")
        sys.exit(130)
    except Exception as e:
        console.print(f"\n[red]Fatal error: {str(e)}[/red]")
        logger.exception("Fatal error during ingestion")
        sys.exit(1)


if __name__ == '__main__':
    main()

