"""
Logging configuration using Loguru.

This module sets up structured logging with colorful console output
and optional JSON file logging. It also intercepts standard library
logs (uvicorn, fastapi) to route them through Loguru.
"""

import logging
import sys
from pathlib import Path

from loguru import logger


class InterceptHandler(logging.Handler):
    """
    Intercept standard Python logging and redirect to Loguru.
    
    This allows uvicorn, fastapi, and other libraries using the
    standard logging module to have their logs formatted by Loguru.
    """

    def emit(self, record: logging.LogRecord) -> None:
        # Get corresponding Loguru level if it exists
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where the logged message originated
        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging(
    level: str = "INFO",
    json_logs: bool = False,
    log_file: str = "logs/app.json",
) -> None:
    """
    Configure Loguru for the application.
    
    Args:
        level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_logs: Whether to also write JSON logs to a file
        log_file: Path to the JSON log file
    """
    # Remove all default handlers
    logger.remove()

    # Console handler with colorful format
    logger.add(
        sys.stderr,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        ),
        level=level,
        colorize=True,
    )

    # Optional JSON file handler
    if json_logs:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        logger.add(
            log_file,
            format="{message}",
            level=level,
            serialize=True,  # JSON serialization
            rotation="10 MB",  # Rotate when file reaches 10MB
            retention="7 days",  # Keep logs for 7 days
            compression="gz",  # Compress rotated logs
        )

    # Configure standard logging to use InterceptHandler
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    # Explicitly set loggers for uvicorn and fastapi
    for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"):
        logging_logger = logging.getLogger(logger_name)
        logging_logger.handlers = [InterceptHandler()]
        logging_logger.propagate = False

    logger.info("Logging configured successfully")
