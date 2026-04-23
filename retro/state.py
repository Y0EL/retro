from typing import TypedDict, Annotated, Optional
import operator


class PipelineState(TypedDict):
    # Input
    companies_input: list          # list[dict] dari CSV/Excel

    # Crawling
    crawl_results: list            # list[CrawlResult.model_dump()]

    # NLP Extraction
    extracted_entities: list       # list[ExtractedEntities.model_dump()]

    # LLM Profiling
    company_profiles: list         # list[CompanyProfileCard.model_dump()]

    # LLM Synthesis
    synthesis_result: dict         # SynthesisResult.model_dump()

    # LLM Proposal Generation
    proposal_sections: dict        # ProposalSections.model_dump()

    # Output
    output_paths: dict             # {outbound_pdf, internal_pdf, db_path}

    # Meta
    error_log: Annotated[list, operator.add]   # Append-only error log
    run_metadata: dict             # {start_time, author, theme, input_file}
