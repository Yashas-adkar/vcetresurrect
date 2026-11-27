import re
import unicodedata
from pathlib import Path

import pymupdf
from pydantic import BaseModel

from services.gemini_service import (
    BriefResearchSummary,
    DocumentSummaryResponse,
    ExecutiveSummaryResult,
    KeyTakeawaysResult,
    ResearchSummary,
    TopicSkimmingResult,
)

PAGE_WIDTH = 595
PAGE_HEIGHT = 842
MARGIN_X = 54
CONTENT_TOP = 125
CONTENT_BOTTOM = 780
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
INK = (0.12, 0.16, 0.22)
MUTED = (0.36, 0.40, 0.46)
CYAN = (0.05, 0.55, 0.62)
PURPLE = (0.39, 0.30, 0.65)

SUMMARY_TYPES: dict[str, type[BaseModel]] = {
    "brief": BriefResearchSummary,
    "detailed": ResearchSummary,
    "topic_skimming": TopicSkimmingResult,
    "key_takeaways": KeyTakeawaysResult,
    "executive_summary": ExecutiveSummaryResult,
}
SUMMARY_TITLES = {
    "brief": "Brief Summary",
    "detailed": "Detailed Summary",
    "topic_skimming": "Topic Skimming",
    "key_takeaways": "Key Takeaways",
    "executive_summary": "Executive Summary",
}


def build_research_report_pdf(
    filename: str,
    summaries: list[DocumentSummaryResponse],
) -> bytes:
    """Create a paginated report from already generated summary responses."""
    summaries_by_mode = {result.summary_mode: result for result in summaries}
    expected_modes = tuple(SUMMARY_TYPES)
    if set(summaries_by_mode) != set(expected_modes):
        raise ValueError("A complete report requires all five summary modes.")

    validated = []
    for mode in expected_modes:
        result = summaries_by_mode[mode]
        try:
            summary = SUMMARY_TYPES[mode].model_validate(result.summary)
        except ValueError as error:
            raise ValueError(f"The {SUMMARY_TITLES[mode]} result is incomplete or invalid.") from error
        if not _has_nonempty_text_fields(summary):
            raise ValueError(f"The {SUMMARY_TITLES[mode]} result contains an empty required section.")
        validated.append((mode, summary))

    paper_title = _paper_title(validated[1][1], filename)
    document = pymupdf.open()
    try:
        for mode, summary in validated:
            renderer = _SectionRenderer(document, paper_title, filename)
            renderer.start_page(SUMMARY_TITLES[mode])
            for kind, text in _section_blocks(mode, summary):
                renderer.write_block(kind, text, SUMMARY_TITLES[mode])
        _add_page_numbers(document)
        return document.tobytes(garbage=4, deflate=True)
    finally:
        document.close()


def sanitize_report_stem(filename: str) -> str:
    stem = Path(filename).stem
    ascii_stem = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    safe_stem = re.sub(r"[^A-Za-z0-9_-]+", "_", ascii_stem).strip("_-")
    return safe_stem[:80] or "Research_Paper"


def _paper_title(summary: BaseModel, filename: str) -> str:
    if isinstance(summary, ResearchSummary) and summary.paper_title.strip():
        return summary.paper_title.strip()
    return Path(filename).name or "Research Paper"


def _section_blocks(mode: str, summary: BaseModel) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []

    def paragraph(title: str, text: str) -> None:
        blocks.extend((("subheading", title), ("paragraph", text)))

    def bullet(text: str) -> None:
        blocks.append(("bullet", text))

    def numbered(index: int, text: str) -> None:
        blocks.append(("numbered", f"{index}. {text}"))

    def missing_items(items: list[object]) -> None:
        if not items:
            bullet("Not reported in the paper.")

    if mode == "brief" and isinstance(summary, BriefResearchSummary):
        for title, text in (
            ("Research Overview", summary.research_overview),
            ("Problem Statement", summary.problem_statement),
            ("Methodology", summary.methodology),
        ):
            paragraph(title, text)
        blocks.append(("subheading", "Key Findings"))
        missing_items(summary.key_findings)
        for finding in summary.key_findings:
            bullet(f"{finding.finding}\nEvidence: {finding.evidence}")
        paragraph("Conclusion", summary.conclusion)
    elif mode == "detailed" and isinstance(summary, ResearchSummary):
        paragraph("Research Overview", summary.research_overview)
        paragraph("Problem Statement", summary.problem_statement)
        blocks.append(("subheading", "Research Objectives"))
        missing_items(summary.research_objectives)
        for index, item in enumerate(summary.research_objectives, 1):
            numbered(index, item)
        paragraph("Methodology", summary.methodology)
        blocks.append(("subheading", "Important Concepts"))
        missing_items(summary.important_concepts)
        for concept in summary.important_concepts:
            bullet(f"{concept.name}: {concept.explanation}")
        blocks.append(("subheading", "Key Findings"))
        missing_items(summary.key_findings)
        for finding in summary.key_findings:
            bullet(f"{finding.finding}\nEvidence: {finding.evidence}")
        paragraph("Results", summary.results)
        paragraph("Implications", summary.implications)
        blocks.append(("subheading", "Limitations"))
        missing_items(summary.limitations)
        for item in summary.limitations:
            bullet(item)
        paragraph("Conclusion", summary.conclusion)
    elif mode == "topic_skimming" and isinstance(summary, TopicSkimmingResult):
        paragraph("Paper Overview", summary.paper_overview)
        blocks.append(("subheading", "Main Topics"))
        missing_items(summary.main_topics)
        for topic in summary.main_topics:
            bullet(
                f"{topic.title}\n{topic.explanation}\nWhy it matters: {topic.importance}\n"
                f"{_format_pages(topic.page_numbers)}"
            )
        blocks.append(("subheading", "Research Structure"))
        missing_items(summary.research_structure)
        for item in summary.research_structure:
            topics = ", ".join(item.topics) if item.topics else "Topic details not reported in the paper."
            bullet(f"{item.section}: {topics}\n{_format_pages(item.page_numbers)}")
        blocks.append(("subheading", "Important Sections to Read"))
        missing_items(summary.important_sections_to_read)
        for item in summary.important_sections_to_read:
            bullet(f"{item.title}: {item.why_read}\n{_format_pages(item.page_numbers)}")
        blocks.append(("subheading", "Keywords"))
        missing_items(summary.keywords)
        for item in summary.keywords:
            bullet(f"{item.keyword}: {item.explanation}")
    elif mode == "key_takeaways" and isinstance(summary, KeyTakeawaysResult):
        paragraph("Core Message", summary.core_message)
        blocks.append(("subheading", "Key Takeaways"))
        missing_items(summary.key_takeaways)
        for index, item in enumerate(summary.key_takeaways, 1):
            numbered(index, f"{item.title}\n{item.explanation}\nWhy it matters: {item.why_it_matters}")
        blocks.append(("subheading", "Major Contributions"))
        missing_items(summary.major_contributions)
        for item in summary.major_contributions:
            bullet(f"{item.contribution}: {item.significance}")
        blocks.append(("subheading", "Practical Implications"))
        missing_items(summary.practical_implications)
        for item in summary.practical_implications:
            bullet(f"{item.implication}\nBasis: {item.basis}")
        blocks.append(("subheading", "What Should I Remember?"))
        missing_items(summary.what_to_remember)
        for index, item in enumerate(summary.what_to_remember, 1):
            numbered(index, item)
    elif mode == "executive_summary" and isinstance(summary, ExecutiveSummaryResult):
        paragraph("Research Context", summary.research_context)
        paragraph("Problem", summary.problem)
        paragraph("Approach", summary.approach)
        blocks.append(("subheading", "Key Findings"))
        missing_items(summary.key_findings)
        for finding in summary.key_findings:
            bullet(f"{finding.finding}\nEvidence: {finding.evidence}")
        paragraph("Significance", summary.significance)
        blocks.append(("subheading", "Limitations and Considerations"))
        missing_items(summary.limitations_and_considerations)
        for item in summary.limitations_and_considerations:
            bullet(item)
        blocks.append(("subheading", "Recommended Next Steps"))
        missing_items(summary.recommended_next_steps)
        for item in summary.recommended_next_steps:
            bullet(f"{item.recommendation}\nBasis: {item.basis}")
        paragraph("Final Verdict", summary.final_verdict)
    else:
        raise ValueError(f"The {SUMMARY_TITLES[mode]} result has an unexpected structure.")

    return blocks


def _format_pages(page_numbers: list[int]) -> str:
    return f"Pages {', '.join(map(str, page_numbers))}" if page_numbers else "Page references unavailable"


def _has_nonempty_text_fields(value: object) -> bool:
    if isinstance(value, BaseModel):
        return all(_has_nonempty_text_fields(item) for item in value.model_dump().values())
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return all(_has_nonempty_text_fields(item) for item in value)
    if isinstance(value, dict):
        return all(_has_nonempty_text_fields(item) for item in value.values())
    return True


def _safe_text(text: str) -> str:
    return text.encode("cp1252", errors="replace").decode("cp1252")


class _SectionRenderer:
    def __init__(self, document: pymupdf.Document, paper_title: str, source_filename: str) -> None:
        self.document = document
        self.paper_title = _safe_text(paper_title)
        self.source_filename = _safe_text(Path(source_filename).name)
        self.page: pymupdf.Page | None = None
        self.y = CONTENT_TOP

    def start_page(self, section_title: str, *, continued: bool = False) -> None:
        self.page = self.document.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        self.page.draw_line(
            (MARGIN_X, 36),
            (PAGE_WIDTH - MARGIN_X, 36),
            color=CYAN,
            width=2,
        )
        self.page.insert_text(
            (MARGIN_X, 56),
            "INSIGHT FORGE  |  RESEARCH ANALYSIS",
            fontname="hebo",
            fontsize=8,
            color=CYAN,
        )
        self.page.insert_text(
            (MARGIN_X, 74),
            self._fit_line(self.paper_title, CONTENT_WIDTH, "helv", 9),
            fontname="helv",
            fontsize=9,
            color=MUTED,
        )
        self.page.insert_text(
            (MARGIN_X, 88),
            self._fit_line(f"Source file: {self.source_filename}", CONTENT_WIDTH, "helv", 8),
            fontname="helv",
            fontsize=8,
            color=MUTED,
        )
        heading = f"{section_title}{' (continued)' if continued else ''}"
        self.page.insert_text(
            (MARGIN_X, 112),
            self._fit_line(heading, CONTENT_WIDTH, "hebo", 17),
            fontname="hebo",
            fontsize=17,
            color=INK,
        )
        self.y = CONTENT_TOP

    def write_block(self, kind: str, text: str, section_title: str) -> None:
        fontname, fontsize, color, line_height, indent = {
            "subheading": ("hebo", 11.5, PURPLE, 18, 0),
            "paragraph": ("helv", 10.5, INK, 15, 0),
            "bullet": ("helv", 10.5, INK, 15, 12),
            "numbered": ("helv", 10.5, INK, 15, 12),
        }[kind]
        if kind == "bullet":
            text = f"- {text}"
        lines = self._wrap(text, CONTENT_WIDTH - indent, fontname, fontsize)
        if not lines:
            lines = [""]
        if self.y + line_height * len(lines) + 10 > CONTENT_BOTTOM:
            self.start_page(section_title, continued=True)
        for line in lines:
            if self.y + line_height > CONTENT_BOTTOM:
                self.start_page(section_title, continued=True)
            assert self.page is not None
            self.page.insert_text(
                (MARGIN_X + indent, self.y),
                line,
                fontname=fontname,
                fontsize=fontsize,
                color=color,
            )
            self.y += line_height
        self.y += 8 if kind == "subheading" else 5

    @staticmethod
    def _fit_line(text: str, width: float, fontname: str, fontsize: float) -> str:
        safe = _safe_text(text)
        while safe and pymupdf.get_text_length(safe, fontname=fontname, fontsize=fontsize) > width:
            safe = safe[:-2] + "…" if len(safe) > 2 else safe[:-1]
        return safe

    @staticmethod
    def _wrap(text: str, width: float, fontname: str, fontsize: float) -> list[str]:
        safe = _safe_text(text)
        result: list[str] = []
        for paragraph in safe.splitlines() or [""]:
            words = paragraph.split()
            if not words:
                result.append("")
                continue
            line = ""
            for word in words:
                candidate = f"{line} {word}".strip()
                if line and pymupdf.get_text_length(
                    candidate,
                    fontname=fontname,
                    fontsize=fontsize,
                ) > width:
                    result.append(line)
                    line = word
                else:
                    line = candidate
                if pymupdf.get_text_length(line, fontname=fontname, fontsize=fontsize) > width:
                    fragment = ""
                    for character in line:
                        candidate_fragment = fragment + character
                        if fragment and pymupdf.get_text_length(
                            candidate_fragment,
                            fontname=fontname,
                            fontsize=fontsize,
                        ) > width:
                            result.append(fragment)
                            fragment = character
                        else:
                            fragment = candidate_fragment
                    line = fragment
            if line:
                result.append(line)
        return result


def _add_page_numbers(document: pymupdf.Document) -> None:
    for page_number, page in enumerate(document, start=1):
        page.draw_line(
            (MARGIN_X, 805),
            (PAGE_WIDTH - MARGIN_X, 805),
            color=(0.82, 0.84, 0.87),
            width=0.5,
        )
        page.insert_text(
            (MARGIN_X, 822),
            "Generated by Insight Forge",
            fontname="helv",
            fontsize=8,
            color=MUTED,
        )
        page.insert_text(
            (PAGE_WIDTH - MARGIN_X - 35, 822),
            f"{page_number} / {document.page_count}",
            fontname="helv",
            fontsize=8,
            color=MUTED,
        )
