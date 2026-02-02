"""Worker entry point."""

import asyncio
import logging
import sys

from city_worker.config import settings
from city_worker.runner import JobRunner


def setup_logging() -> None:
    """Configure logging for the worker."""
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )


async def main() -> None:
    """Run the worker process."""
    setup_logging()
    logger = logging.getLogger(__name__)
    logger.info("City Doodle Worker starting...")

    runner = JobRunner()
    await runner.run()


def run() -> None:
    """Entry point for the worker."""
    asyncio.run(main())


if __name__ == "__main__":
    run()
