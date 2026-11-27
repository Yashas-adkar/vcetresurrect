from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pymupdf
from starlette.concurrency import run_in_threadpool
from typing import Literal

from services.gemini_service import (
    MAX_SUMMARY_SOURCE_CHARACTERS,
    DocumentSummaryResponse,
    GeminiConfigurationError,
    GeminiServiceError,
    get_gemini_service,
)

MAX_PDF_SIZE = 20 * 1024 * 1024
PDF_HEADER_WINDOW = 1024

app = FastAPI(title="Insight Forge API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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


class DocumentSummaryRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    extracted_text: str = Field(min_length=1, max_length=MAX_SUMMARY_SOURCE_CHARACTERS)
    summary_mode: Literal["brief", "detailed"] = "detailed"


def safe_filename(filename: str | None) -> str:
    name = (filename or "uploaded.pdf").replace("\\", "/").rsplit("/", 1)[-1]
    printable_name = "".join(character for character in name if character.isprintable())
    return printable_name[:255] or "uploaded.pdf"


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

        try:
            document = pymupdf.open(stream=content, filetype="pdf")
        except pymupdf.FileDataError as error:
            raise HTTPException(status_code=400, detail="PDF is corrupted or invalid.") from error

        try:
            page_count = document.page_count
            if page_count == 0:
                raise HTTPException(status_code=422, detail="PDF contains no pages.")

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
            filename=safe_filename(file.filename),
            page_count=page_count,
            extracted_text=extracted_text,
            pages=pages,
        )
    finally:
        await file.close()


@app.post(
    "/api/documents/summarize",
    response_model=DocumentSummaryResponse,
)
async def summarize_document(
    request: DocumentSummaryRequest,
) -> DocumentSummaryResponse:
    try:
        return await run_in_threadpool(
            get_gemini_service().summarize_document,
            safe_filename(request.filename),
            request.extracted_text,
            request.summary_mode,
        )
    except GeminiConfigurationError as error:
        raise HTTPException(
            status_code=503,
            detail="Research summarization is not configured.",
        ) from error
    except GeminiServiceError as error:
        raise HTTPException(
            status_code=502,
            detail="Research summarization failed. Please try again.",
        ) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
