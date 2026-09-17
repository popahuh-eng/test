"""Training endpoint."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException

from src.logger import get_logger
from src.models.schemas import TrainRequest, TrainResponse
from src.training.pipeline import TrainingPipeline

router = APIRouter(tags=["training"])
logger = get_logger(__name__)

# Track background training jobs: {job_id -> status_dict}
_training_jobs: dict = {}


def _run_training(job_id: str, request: TrainRequest) -> None:
    _training_jobs[job_id] = {"status": "running", "result": None, "error": None}
    try:
        pipeline = TrainingPipeline()
        result = pipeline.run(request)
        _training_jobs[job_id] = {"status": "completed", "result": result, "error": None}
        logger.info("Background training completed", extra={"job_id": job_id})
    except Exception as exc:
        logger.warning("Background training failed", extra={"job_id": job_id, "error": str(exc)})
        _training_jobs[job_id] = {"status": "failed", "result": None, "error": str(exc)}


@router.post("/train", response_model=TrainResponse)
async def train_model(
    request: TrainRequest,
    background_tasks: BackgroundTasks,
) -> TrainResponse:
    """Start model training.

    Training runs synchronously (in-process) for simplicity.
    For long-running jobs the caller should poll /train/status/{job_id}.
    """
    import uuid
    job_id = str(uuid.uuid4())
    logger.info(
        "Training requested",
        extra={"symbol": request.symbol, "timeframe": request.timeframe, "job_id": job_id},
    )
    background_tasks.add_task(_run_training, job_id, request)
    # Return a preliminary response indicating training has started
    return TrainResponse(
        model_name=request.model_name,
        version="pending",
        training_period=f"{request.start_date} to {request.end_date}",
        validation_metrics={},
        test_metrics={},
        feature_count=0,
        training_samples=0,
        status=f"started (job_id={job_id})",
    )


@router.get("/train/status/{job_id}")
async def training_status(job_id: str) -> dict:
    """Check training job status."""
    if job_id not in _training_jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return _training_jobs[job_id]
