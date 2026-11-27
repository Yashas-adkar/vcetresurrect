import hashlib
import logging
import time

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
import pymupdf
from starlette.concurrency import run_in_threadpool
from starlette.responses import Response

from services.gemini_service import (
    MAX_SUMMARY_SOURCE_CHARACTERS,
    CompleteDocumentSummaryResponse,
    DocumentSummaryResponse,
    GeminiConfigurationError,
    GeminiServiceError,
    SummaryMode,
    get_gemini_service,
)
from services.report_pdf import build_research_report_pdf, sanitize_report_stem
from services.visual_service import (
    MAX_VISUAL_SOURCE_CHARACTERS,
    VisualTool,
    get_visual_service,
)
from services.request_cache import SingleFlightCache

MAX_PDF_SIZE = 20 * 1024 * 1024
MAX_PDF_PAGES = 100
PDF_HEADER_WINDOW = 1024
logger = logging.getLogger(__name__)

app = FastAPI(title="Insight Forge API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["*"],
)


@app.get("/")
async def api_root() -> dict[str, object]:
    return {
        "message": "Insight Forge API is running.",
        "docs": "/docs",
        "endpoints": [
            "/api/documents/extract",
            "/api/documents/summarize",
            "/api/documents/summarize-complete",
            "/api/documents/visualize",
            "/api/documents/summary-report",
        ],
    }


class PageText(BaseModel):
    page_number: int
    text: str


class ExtractionResponse(BaseModel):
    filename: str
    page_count: int
    extracted_text: str
    pages: list[PageText]
    document_hash: str


_extraction_cache: SingleFlightCache[ExtractionResponse] = SingleFlightCache(
    max_entries=4,
    max_weight=16 * 1024 * 1024,
    ttl_seconds=2 * 60 * 60,
)


class DocumentSummaryRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    extracted_text: str = Field(min_length=1, max_length=MAX_SUMMARY_SOURCE_CHARACTERS)
    summary_mode: SummaryMode = "detailed"
    document_hash: str | None = Field(default=None, min_length=64, max_length=64, pattern="^[a-f0-9]{64}$")


class CompleteSummaryRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    extracted_text: str = Field(min_length=1, max_length=MAX_SUMMARY_SOURCE_CHARACTERS)
    document_hash: str | None = Field(default=None, min_length=64, max_length=64, pattern="^[a-f0-9]{64}$")


class VisualAnalysisRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    extracted_text: str = Field(min_length=1, max_length=MAX_VISUAL_SOURCE_CHARACTERS)
    tool: VisualTool
    document_hash: str | None = Field(default=None, min_length=64, max_length=64, pattern="^[a-f0-9]{64}$")


class VisualAnalysisResponse(BaseModel):
    filename: str
    tool: VisualTool
    visualization: dict[str, object]


class CompleteSummaryReportRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    summaries: list[DocumentSummaryResponse] = Field(min_length=5, max_length=5)

    @model_validator(mode="after")
    def require_all_summary_modes(self) -> "CompleteSummaryReportRequest":
        modes = [summary.summary_mode for summary in self.summaries]
        if len(set(modes)) != 5 or set(modes) != {
            "brief",
            "detailed",
            "topic_skimming",
            "key_takeaways",
            "executive_summary",
        }:
            raise ValueError("A complete report requires one valid result for each summary mode.")
        return self


def safe_filename(filename: str | None) -> str:
    name = (filename or "uploaded.pdf").replace("\\", "/").rsplit("/", 1)[-1]
    printable_name = "".join(character for character in name if character.isprintable())
    return printable_name[:255] or "uploaded.pdf"


def extract_pdf_content(content: bytes, filename: str, document_hash: str) -> ExtractionResponse:
    try:
        document = pymupdf.open(stream=content, filetype="pdf")
    except pymupdf.FileDataError as error:
        raise HTTPException(status_code=400, detail="PDF is corrupted or invalid.") from error

    try:
        page_count = document.page_count
        if page_count == 0:
            raise HTTPException(status_code=422, detail="PDF contains no pages.")
        if page_count > MAX_PDF_PAGES:
            raise HTTPException(
                status_code=413,
                detail=f"PDF exceeds the {MAX_PDF_PAGES}-page limit.",
            )

        pages = [
            PageText(page_number=page_number, text=page.get_text("text"))
            for page_number, page in enumerate(document, start=1)
        ]
    except HTTPException:
        raise
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail="Failed to extract text from PDF.") from error
    finally:
        document.close()

    extracted_text = "\n".join(page.text for page in pages)
    if not extracted_text.strip():
        raise HTTPException(status_code=422, detail="PDF contains no extractable text.")
    return ExtractionResponse(
        filename=safe_filename(filename),
        page_count=page_count,
        extracted_text=extracted_text,
        pages=pages,
        document_hash=document_hash,
    )


@app.post("/api/documents/extract", response_model=ExtractionResponse)
async def extract_document(file: UploadFile = File(...)) -> ExtractionResponse:
    try:
        if file.size is not None and file.size > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="PDF exceeds the 20 MB limit.")

        content = await file.read(MAX_PDF_SIZE + 1)
        if len(content) > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="PDF exceeds the 20 MB limit.")
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if b"%PDF-" not in content[:PDF_HEADER_WINDOW]:
            raise HTTPException(status_code=415, detail="Uploaded file is not a valid PDF.")
        document_hash = hashlib.sha256(content).hexdigest()
        cached = _extraction_cache.get_or_compute(
            document_hash,
            lambda: extract_pdf_content(content, file.filename or "uploaded.pdf", document_hash),
            weight=lambda result: (
                len(result.extracted_text.encode("utf-8"))
                + sum(len(page.text.encode("utf-8")) for page in result.pages)
            ),
        )
        return cached.model_copy(update={"filename": safe_filename(file.filename)})
    finally:
        await file.close()


@app.post(
    "/api/documents/summarize",
    response_model=DocumentSummaryResponse,
)
async def summarize_document(
    request: DocumentSummaryRequest,
) -> DocumentSummaryResponse:
    started_at = time.perf_counter()
    logger.info(
        "Summary request received: mode=%s extracted_chars=%d",
        request.summary_mode,
        len(request.extracted_text),
    )
    try:
        response = await run_in_threadpool(
            get_gemini_service().summarize_document,
            safe_filename(request.filename),
            request.extracted_text,
            request.summary_mode,
            request.document_hash,
        )
        logger.info(
            "Summary request completed: mode=%s duration_seconds=%.1f",
            request.summary_mode,
            time.perf_counter() - started_at,
        )
        return response
    except GeminiConfigurationError as error:
        logger.error(
            "Summary request failed: stage=configuration mode=%s duration_seconds=%.1f",
            request.summary_mode,
            time.perf_counter() - started_at,
        )
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the backend.",
        ) from error
    except GeminiServiceError as error:
        logger.error(
            "Summary request failed: mode=%s duration_seconds=%.1f category=%s status=%s timed_out=%s",
            request.summary_mode,
            time.perf_counter() - started_at,
            error.category,
            error.provider_code,
            error.timed_out,
        )
        if error.timed_out:
            raise HTTPException(
                status_code=504,
                detail="Summary generation timed out. Please retry or use a shorter document.",
            ) from error
        if error.category == "quota":
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini rejected this request because a quota or project limit is unavailable. "
                    "Check the project's active limits or wait for the quota period to reset."
                ),
            ) from error
        if error.category == "rate_limit":
            raise HTTPException(
                status_code=503,
                detail="Gemini is temporarily rate-limiting requests. Wait briefly, then retry.",
            ) from error
        if error.category in ("unauthorized", "forbidden"):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini rejected the API key or project. Check GEMINI_API_KEY and the "
                    "project's Gemini API access in Google AI Studio."
                ),
            ) from error
        if error.category == "model_unavailable":
            raise HTTPException(
                status_code=503,
                detail="The configured Gemini model is unavailable to this project.",
            ) from error
        if error.category in ("unavailable", "network"):
            raise HTTPException(
                status_code=503,
                detail="Gemini is temporarily unavailable. Check your internet connection and try again.",
            ) from error
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini returned an invalid response."
                if error.category == "invalid_response"
                else "Research summarization failed. Please try again."
            ),
        ) from error
    except ValueError as error:
        logger.warning(
            "Summary request rejected: mode=%s duration_seconds=%.1f reason=%s",
            request.summary_mode,
            time.perf_counter() - started_at,
            str(error),
        )
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post(
    "/api/documents/summarize-complete",
    response_model=CompleteDocumentSummaryResponse,
)
async def summarize_complete_document(
    request: CompleteSummaryRequest,
) -> CompleteDocumentSummaryResponse:
    started_at = time.perf_counter()
    logger.info(
        "Complete summary request received: extracted_chars=%d",
        len(request.extracted_text),
    )
    try:
        response = await run_in_threadpool(
            get_gemini_service().summarize_complete_document,
            safe_filename(request.filename),
            request.extracted_text,
            request.document_hash,
        )
        logger.info(
            "Complete summary request completed: returned=%d missing=%d duration_seconds=%.1f",
            len(response.summaries),
            len(response.missing_modes),
            time.perf_counter() - started_at,
        )
        return response
    except GeminiConfigurationError as error:
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the backend.",
        ) from error
    except GeminiServiceError as error:
        logger.error(
            "Complete summary request failed: duration_seconds=%.1f category=%s status=%s timed_out=%s",
            time.perf_counter() - started_at,
            error.category,
            error.provider_code,
            error.timed_out,
        )
        if error.timed_out:
            raise HTTPException(
                status_code=504,
                detail="Summary generation timed out. Please retry or use a shorter document.",
            ) from error
        if error.category == "quota":
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini rejected this request because a quota or project limit is unavailable. "
                    "Check the project's active limits or wait for the quota period to reset."
                ),
            ) from error
        if error.category == "rate_limit":
            raise HTTPException(
                status_code=503,
                detail="Gemini is temporarily rate-limiting requests. Wait briefly, then retry.",
            ) from error
        if error.category in ("unauthorized", "forbidden"):
            raise HTTPException(
                status_code=503,
                detail="Gemini rejected the API key or project. Check GEMINI_API_KEY and project access.",
            ) from error
        if error.category == "model_unavailable":
            raise HTTPException(
                status_code=503,
                detail="The configured Gemini model is unavailable to this project.",
            ) from error
        if error.category in ("unavailable", "network"):
            raise HTTPException(
                status_code=503,
                detail="Gemini is temporarily unavailable. Check your internet connection and try again.",
            ) from error
        raise HTTPException(
            status_code=502,
            detail="Gemini could not return a valid complete summary. Retry the missing sections individually.",
        ) from error
    except ValueError as error:
        logger.warning(
            "Complete summary request rejected: duration_seconds=%.1f reason=%s",
            time.perf_counter() - started_at,
            str(error),
        )
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post(
    "/api/documents/visualize",
    response_model=VisualAnalysisResponse,
)
async def visualize_document(
    request: VisualAnalysisRequest,
) -> VisualAnalysisResponse:
    started_at = time.perf_counter()
    logger.info(
        "Visual request received: tool=%s extracted_chars=%d",
        request.tool,
        len(request.extracted_text),
    )
    try:
        visualization = await run_in_threadpool(
            get_visual_service().generate,
            safe_filename(request.filename),
            request.extracted_text,
            request.tool,
            request.document_hash,
        )
        logger.info(
            "Visual request completed: tool=%s duration_seconds=%.1f",
            request.tool,
            time.perf_counter() - started_at,
        )
        return VisualAnalysisResponse(
            filename=safe_filename(request.filename),
            tool=request.tool,
            visualization=visualization,
        )
    except GeminiConfigurationError as error:
        logger.error(
            "Visual request failed: stage=configuration tool=%s duration_seconds=%.1f",
            request.tool,
            time.perf_counter() - started_at,
        )
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the backend.",
        ) from error
    except GeminiServiceError as error:
        logger.error(
            "Visual request failed: tool=%s duration_seconds=%.1f category=%s status=%s timed_out=%s",
            request.tool,
            time.perf_counter() - started_at,
            error.category,
            error.provider_code,
            error.timed_out,
        )
        if error.timed_out:
            raise HTTPException(
                status_code=504,
                detail="Visualization generation timed out. Try again or use a shorter document.",
            ) from error
        if error.category == "quota":
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini API quota or rate limit was reached for this project/model. "
                    "Check the project's active limits in Google AI Studio or wait for the quota to reset."
                ),
            ) from error
        if error.category == "rate_limit":
            raise HTTPException(
                status_code=503,
                detail="Gemini is temporarily rate-limiting requests. Wait briefly, then retry.",
            ) from error
        if error.category in ("unauthorized", "forbidden"):
            raise HTTPException(
                status_code=503,
                detail="Gemini rejected the API key or project. Check GEMINI_API_KEY and Gemini API access.",
            ) from error
        if error.category == "model_unavailable":
            raise HTTPException(
                status_code=503,
                detail="The configured Gemini model is unavailable to this project.",
            ) from error
        if error.category in ("unavailable", "network"):
            raise HTTPException(
                status_code=503,
                detail="Gemini is temporarily unavailable. Check your internet connection and try again.",
            ) from error
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini returned invalid visualization data."
                if error.category == "invalid_response"
                else "Research visualization failed. Please try again."
            ),
        ) from error
    except ValueError as error:
        logger.warning(
            "Visual request rejected: tool=%s duration_seconds=%.1f reason=%s",
            request.tool,
            time.perf_counter() - started_at,
            str(error),
        )
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/documents/summary-report")
async def create_summary_report(
    request: CompleteSummaryReportRequest,
) -> Response:
    try:
        pdf_content = await run_in_threadpool(
            build_research_report_pdf,
            safe_filename(request.filename),
            request.summaries,
        )
    except ValueError as error:
        logger.warning("Complete summary report rejected: reason=%s", str(error))
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        logger.exception("Complete summary PDF generation failed.")
        raise HTTPException(
            status_code=500,
            detail="The research report PDF could not be generated. Please try again.",
        ) from error

    report_stem = sanitize_report_stem(request.filename)
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="InsightForge_Research_Report_{report_stem}.pdf"',
        },
    )
