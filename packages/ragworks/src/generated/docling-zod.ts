import { z } from "zod";
const HealthCheckResponse = z
  .object({ status: z.string().default("ok") })
  .partial()
  .passthrough();
const ReadinessResponse = z
  .object({ status: z.string().default("ok") })
  .partial()
  .passthrough();
const InputFormat = z.enum([
  "docx",
  "pptx",
  "html",
  "image",
  "pdf",
  "asciidoc",
  "md",
  "csv",
  "xlsx",
  "xml_uspto",
  "xml_jats",
  "xml_xbrl",
  "xml_doclang",
  "mets_gbs",
  "json_docling",
  "audio",
  "vtt",
  "latex",
  "email",
  "epub",
]);
const OutputFormat = z.enum([
  "md",
  "json",
  "yaml",
  "html",
  "html_split_page",
  "text",
  "doctags",
  "vtt",
  "doclang",
]);
const ImageRefMode = z.enum(["placeholder", "embedded", "referenced"]);
const PdfBackend = z.enum([
  "pypdfium2",
  "docling_parse",
  "threaded_docling_parse",
  "dlparse_v1",
  "dlparse_v2",
  "dlparse_v4",
]);
const TableFormerMode = z.enum(["fast", "accurate"]);
const ProcessingPipeline = z.enum(["legacy", "standard", "vlm", "asr"]);
const PictureClassificationLabel = z.enum([
  "bar_chart",
  "box_plot",
  "flow_chart",
  "line_chart",
  "pie_chart",
  "scatter_plot",
  "table",
  "full_page_image",
  "page_thumbnail",
  "photograph",
  "chemistry_structure",
  "bar_code",
  "icon",
  "logo",
  "qr_code",
  "signature",
  "stamp",
  "engineering_drawing",
  "screenshot_from_computer",
  "screenshot_from_manual",
  "geographical_map",
  "topographical_map",
  "calendar",
  "crossword_puzzle",
  "music",
  "other",
  "cad_drawing",
  "electrical_diagram",
  "map",
  "heatmap",
  "chemistry_markush_structure",
  "chemistry_molecular_structure",
  "natural_image",
  "picture_group",
  "remote_sensing",
  "scatter_chart",
  "screenshot",
  "stacked_bar_chart",
  "stratigraphic_chart",
]);
const PictureDescriptionLocal = z
  .object({
    repo_id: z.string(),
    prompt: z
      .string()
      .optional()
      .default("Describe this image in a few sentences."),
    generation_config: z
      .object({})
      .partial()
      .passthrough()
      .optional()
      .default({ max_new_tokens: 200, do_sample: false }),
    classification_allow: z
      .union([z.array(PictureClassificationLabel), z.null()])
      .optional(),
    classification_deny: z
      .union([z.array(PictureClassificationLabel), z.null()])
      .optional(),
    classification_min_confidence: z
      .number()
      .gte(0)
      .lte(1)
      .optional()
      .default(0),
  })
  .passthrough();
const PictureDescriptionApi = z
  .object({
    url: z.string().min(1).url(),
    headers: z.record(z.string(), z.string()).optional().default({}),
    params: z.object({}).partial().passthrough().optional().default({}),
    timeout: z.number().optional().default(20),
    concurrency: z.number().int().gt(0).optional().default(1),
    prompt: z
      .string()
      .optional()
      .default("Describe this image in a few sentences."),
    classification_allow: z
      .union([z.array(PictureClassificationLabel), z.null()])
      .optional(),
    classification_deny: z
      .union([z.array(PictureClassificationLabel), z.null()])
      .optional(),
    classification_min_confidence: z
      .number()
      .gte(0)
      .lte(1)
      .optional()
      .default(0),
  })
  .passthrough();
const VlmModelType = z.enum([
  "smoldocling",
  "smoldocling_vllm",
  "granite_vision",
  "granite_vision_vllm",
  "granite_vision_ollama",
  "got_ocr_2",
  "granite_docling",
  "granite_docling_vllm",
  "nanonets_ocr2",
  "nanonets_ocr2_vllm",
  "nanonets_ocr2_lmstudio",
  "glm_ocr",
  "glm_ocr_vllm",
  "lightonocr",
  "lightonocr_vllm",
  "deepseekocr_ollama",
]);
const ResponseFormat = z.enum([
  "doctags",
  "doclang",
  "markdown",
  "deepseekocr_markdown",
  "html",
  "otsl",
  "plaintext",
]);
const InferenceFramework = z.enum(["mlx", "transformers", "vllm"]);
const TransformersModelType = z.enum([
  "automodel",
  "automodel-causallm",
  "automodel-imagetexttotext",
]);
const VlmModelLocal = z
  .object({
    repo_id: z.string(),
    prompt: z.string().optional().default("Convert this page to docling."),
    scale: z.number().optional().default(2),
    response_format: ResponseFormat,
    inference_framework: InferenceFramework,
    transformers_model_type: TransformersModelType.optional(),
    extra_generation_config: z
      .object({})
      .partial()
      .passthrough()
      .optional()
      .default({ max_new_tokens: 800, do_sample: false }),
    temperature: z.number().optional().default(0),
  })
  .passthrough();
const VlmModelApi = z
  .object({
    url: z.string().min(1).url(),
    headers: z.record(z.string(), z.string()).optional().default({}),
    params: z.object({}).partial().passthrough().optional().default({}),
    timeout: z.number().optional().default(60),
    concurrency: z.number().int().gt(0).optional().default(1),
    prompt: z.string().optional().default("Convert this page to docling."),
    scale: z.number().optional().default(2),
    response_format: ResponseFormat,
    temperature: z.number().optional().default(0),
  })
  .passthrough();
const VlmEngineType = z.enum([
  "transformers",
  "mlx",
  "vllm",
  "api",
  "api_ollama",
  "api_lmstudio",
  "api_openai",
  "auto_inline",
]);
const BaseVlmEngineOptions = z
  .object({ engine_type: VlmEngineType })
  .passthrough();
const EngineModelConfig = z
  .object({
    repo_id: z.union([z.string(), z.null()]),
    revision: z.union([z.string(), z.null()]),
    torch_dtype: z.union([z.string(), z.null()]),
    extra_config: z.object({}).partial().passthrough(),
  })
  .partial()
  .passthrough();
const ApiModelConfig = z
  .object({ params: z.object({}).partial().passthrough() })
  .partial()
  .passthrough();
const VlmModelSpec = z
  .object({
    name: z.string(),
    default_repo_id: z.string(),
    revision: z.string().optional().default("main"),
    prompt: z.string(),
    response_format: ResponseFormat,
    supported_engines: z.union([z.array(VlmEngineType), z.null()]).optional(),
    engine_overrides: z.record(z.string(), EngineModelConfig).optional(),
    api_overrides: z.record(z.string(), ApiModelConfig).optional(),
    trust_remote_code: z.boolean().optional().default(false),
    stop_strings: z.array(z.string()).optional(),
    max_new_tokens: z.number().int().optional().default(4096),
  })
  .passthrough();
const VlmConvertOptions = z
  .object({
    engine_options: BaseVlmEngineOptions,
    model_spec: VlmModelSpec,
    scale: z.number().optional().default(2),
    max_size: z.union([z.number(), z.null()]).optional(),
    batch_size: z.number().int().optional().default(1),
    force_backend_text: z.boolean().optional().default(false),
  })
  .passthrough();
const PictureDescriptionVlmEngineOptions = z
  .object({
    batch_size: z.number().int().gte(1).optional().default(8),
    scale: z.number().gt(0).optional().default(2),
    picture_area_threshold: z.number().optional().default(0.05),
    classification_allow: z
      .union([z.array(PictureClassificationLabel), z.null()])
      .optional(),
    classification_deny: z
      .union([z.array(PictureClassificationLabel), z.null()])
      .optional(),
    classification_min_confidence: z.number().optional().default(0),
    engine_options: BaseVlmEngineOptions,
    model_spec: VlmModelSpec,
    prompt: z
      .string()
      .optional()
      .default("Describe this image in a few sentences."),
    generation_config: z
      .object({})
      .partial()
      .passthrough()
      .optional()
      .default({ max_new_tokens: 200, do_sample: false }),
  })
  .passthrough();
const CodeFormulaVlmOptions = z
  .object({
    engine_options: BaseVlmEngineOptions,
    model_spec: VlmModelSpec,
    scale: z.number().optional().default(2),
    max_size: z.union([z.number(), z.null()]).optional(),
    extract_code: z.boolean().optional().default(true),
    extract_formulas: z.boolean().optional().default(true),
  })
  .passthrough();
const ConvertDocumentsOptions = z
  .object({
    from_formats: z
      .array(InputFormat)
      .default([
        "docx",
        "pptx",
        "html",
        "image",
        "pdf",
        "asciidoc",
        "md",
        "csv",
        "xlsx",
        "xml_uspto",
        "xml_jats",
        "xml_xbrl",
        "xml_doclang",
        "mets_gbs",
        "json_docling",
        "audio",
        "vtt",
        "latex",
        "email",
        "epub",
      ]),
    to_formats: z.array(OutputFormat).default(["md"]),
    image_export_mode: ImageRefMode,
    do_ocr: z.boolean().default(true),
    force_ocr: z.boolean().default(false),
    ocr_engine: z.string().default("auto"),
    ocr_lang: z.union([z.array(z.string()), z.null()]),
    ocr_preset: z.string().default("auto"),
    ocr_custom_config: z.union([
      z.object({}).partial().passthrough(),
      z.null(),
    ]),
    pdf_backend: PdfBackend,
    table_mode: TableFormerMode,
    table_cell_matching: z.boolean().default(true),
    pipeline: ProcessingPipeline,
    page_range: z
      .array(z.any())
      .min(2)
      .max(2)
      .default([1, 9223372036854776000]),
    document_timeout: z.union([z.number(), z.null()]),
    abort_on_error: z.boolean().default(false),
    do_table_structure: z.boolean().default(true),
    include_images: z.boolean().default(true),
    include_page_images: z.boolean().default(false),
    images_scale: z.number().default(2),
    md_page_break_placeholder: z.string().default(""),
    do_code_enrichment: z.boolean().default(false),
    do_formula_enrichment: z.boolean().default(false),
    do_picture_classification: z.boolean().default(false),
    do_chart_extraction: z.boolean().default(false),
    do_picture_description: z.boolean().default(false),
    picture_description_area_threshold: z.number().default(0.05),
    picture_description_local: z.union([PictureDescriptionLocal, z.null()]),
    picture_description_api: z.union([PictureDescriptionApi, z.null()]),
    vlm_pipeline_model: z.union([VlmModelType, z.null()]),
    vlm_pipeline_model_local: z.union([VlmModelLocal, z.null()]),
    vlm_pipeline_model_api: z.union([VlmModelApi, z.null()]),
    vlm_pipeline_preset: z.union([z.string(), z.null()]),
    picture_description_preset: z.union([z.string(), z.null()]),
    code_formula_preset: z.union([z.string(), z.null()]),
    vlm_pipeline_custom_config: z.union([
      VlmConvertOptions,
      z.object({}).partial().passthrough(),
      z.null(),
    ]),
    picture_description_custom_config: z.union([
      PictureDescriptionVlmEngineOptions,
      z.object({}).partial().passthrough(),
      z.null(),
    ]),
    code_formula_custom_config: z.union([
      CodeFormulaVlmOptions,
      z.object({}).partial().passthrough(),
      z.null(),
    ]),
    table_structure_preset: z.union([z.string(), z.null()]),
    table_structure_custom_config: z.union([
      z.object({}).partial().passthrough(),
      z.null(),
    ]),
    layout_custom_config: z.union([
      z.object({}).partial().passthrough(),
      z.null(),
    ]),
    layout_preset: z.union([z.string(), z.null()]),
    picture_classification_preset: z.union([z.string(), z.null()]),
    picture_classification_custom_config: z.union([
      z.object({}).partial().passthrough(),
      z.null(),
    ]),
  })
  .partial()
  .passthrough();
const FileSourceRequest = z
  .object({
    base64_string: z.string(),
    filename: z.string(),
    kind: z.string().optional().default("file"),
  })
  .passthrough();
const HttpSourceRequest = z
  .object({
    url: z.string().min(1).url(),
    headers: z.object({}).partial().passthrough().optional().default({}),
    kind: z.string().optional().default("http"),
  })
  .passthrough();
const InBodyTarget = z
  .object({ kind: z.string().default("inbody") })
  .partial()
  .passthrough();
const ZipTarget = z
  .object({ kind: z.string().default("zip") })
  .partial()
  .passthrough();
const S3Target = z
  .object({
    endpoint: z.string(),
    verify_ssl: z.boolean().optional().default(true),
    access_key: z.string(),
    secret_key: z.string(),
    bucket: z.string(),
    key_prefix: z.string().optional().default(""),
    max_num_elements: z.union([z.number(), z.null()]).optional(),
    kind: z.string().optional().default("s3"),
  })
  .passthrough();
const PutTarget = z
  .object({
    kind: z.string().optional().default("put"),
    url: z.string().min(1).url(),
  })
  .passthrough();
const PresignedUrlTarget = z
  .object({ kind: z.string().default("presigned_url") })
  .partial()
  .passthrough();
const CallbackSpec = z
  .object({
    url: z.string().min(1).url(),
    headers: z.record(z.string(), z.string()).optional().default({}),
    ca_cert: z.string().optional().default(""),
  })
  .passthrough();
const ConvertSourcesRequest = z
  .object({
    options: ConvertDocumentsOptions.optional(),
    sources: z.array(
      z.discriminatedUnion("kind", [FileSourceRequest, HttpSourceRequest])
    ),
    target: z
      .discriminatedUnion("kind", [
        InBodyTarget,
        ZipTarget,
        S3Target,
        PutTarget,
        PresignedUrlTarget,
      ])
      .optional()
      .default({ kind: "inbody" }),
    callbacks: z.array(CallbackSpec).optional().default([]),
  })
  .passthrough();
const X_Tenant_Id = z.union([z.string(), z.null()]).optional();
const DoclingDocument = z.object({}).partial().passthrough();
const ExportDocumentResponse = z
  .object({
    filename: z.string(),
    md_content: z.union([z.string(), z.null()]).optional(),
    json_content: z.union([DoclingDocument, z.null()]).optional(),
    html_content: z.union([z.string(), z.null()]).optional(),
    text_content: z.union([z.string(), z.null()]).optional(),
    doctags_content: z.union([z.string(), z.null()]).optional(),
    doclang_content: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();
const ConversionStatus = z.enum([
  "pending",
  "started",
  "failure",
  "success",
  "partial_success",
  "skipped",
]);
const DoclingComponentType = z.enum([
  "document_backend",
  "model",
  "doc_assembler",
  "user_input",
  "pipeline",
]);
const ErrorItem = z
  .object({
    component_type: DoclingComponentType,
    module_name: z.string(),
    error_message: z.string(),
  })
  .passthrough();
const ProfilingScope = z.enum(["page", "document"]);
const ProfilingItem = z
  .object({
    scope: ProfilingScope,
    count: z.number().int().optional().default(0),
    times: z.array(z.number()).optional().default([]),
    start_timestamps: z
      .array(z.string().datetime({ offset: true }))
      .optional()
      .default([]),
  })
  .passthrough();
const ConvertDocumentResponse = z
  .object({
    document: ExportDocumentResponse,
    status: ConversionStatus,
    errors: z.array(ErrorItem).optional().default([]),
    processing_time: z.number(),
    timings: z.record(z.string(), ProfilingItem).optional().default({}),
  })
  .passthrough();
const PresignedUrlConvertDocumentResponse = z
  .object({
    num_converted: z.number().int(),
    num_succeeded: z.number().int(),
    num_partially_succeeded: z.number().int().optional().default(0),
    num_failed: z.number().int(),
    processing_time: z.number(),
  })
  .passthrough();
const ArtifactRef = z
  .object({
    artifact_type: z.enum([
      "json",
      "html",
      "markdown",
      "text",
      "doctags",
      "doclang",
      "resource_bundle",
    ]),
    mime_type: z.string(),
    uri: z.string().min(1).url(),
    url_expires_at: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();
const DocumentArtifactItem = z
  .object({
    source_index: z.number().int(),
    source_uri: z.string(),
    filename: z.string(),
    status: ConversionStatus,
    errors: z.array(ErrorItem).optional().default([]),
    timings: z.record(z.string(), ProfilingItem).optional().default({}),
    artifacts: z.array(ArtifactRef).optional().default([]),
  })
  .passthrough();
const PresignedUrlConvertResponse = z
  .object({
    num_converted: z.number().int(),
    num_succeeded: z.number().int(),
    num_partially_succeeded: z.number().int().optional().default(0),
    num_failed: z.number().int(),
    processing_time: z.number(),
    documents: z.array(DocumentArtifactItem),
  })
  .passthrough();
const ValidationError = z
  .object({
    loc: z.array(z.union([z.string(), z.number()])),
    msg: z.string(),
    type: z.string(),
    input: z.unknown().optional(),
    ctx: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();
const HTTPValidationError = z
  .object({ detail: z.array(ValidationError) })
  .partial()
  .passthrough();
const TargetName = z.enum(["inbody", "presigned_url", "zip"]);
const Body_process_file_v1_convert_file_post = z
  .object({
    files: z.array(z.string()),
    target_type: TargetName.optional(),
    from_formats: z
      .array(InputFormat)
      .optional()
      .default([
        "docx",
        "pptx",
        "html",
        "image",
        "pdf",
        "asciidoc",
        "md",
        "csv",
        "xlsx",
        "xml_uspto",
        "xml_jats",
        "xml_xbrl",
        "xml_doclang",
        "mets_gbs",
        "json_docling",
        "audio",
        "vtt",
        "latex",
        "email",
        "epub",
      ]),
    to_formats: z.array(OutputFormat).optional().default(["md"]),
    image_export_mode: ImageRefMode.optional(),
    do_ocr: z.boolean().optional().default(true),
    force_ocr: z.boolean().optional().default(false),
    ocr_engine: z.string().optional().default("auto"),
    ocr_lang: z.union([z.array(z.string()), z.null()]).optional(),
    ocr_preset: z.string().optional().default("auto"),
    ocr_custom_config: z.string().optional(),
    pdf_backend: PdfBackend.optional(),
    table_mode: TableFormerMode.optional(),
    table_cell_matching: z.boolean().optional().default(true),
    pipeline: ProcessingPipeline.optional(),
    page_range: z
      .array(z.any())
      .min(2)
      .max(2)
      .optional()
      .default([1, 9223372036854776000]),
    document_timeout: z.union([z.number(), z.null()]).optional(),
    abort_on_error: z.boolean().optional().default(false),
    do_table_structure: z.boolean().optional().default(true),
    include_images: z.boolean().optional().default(true),
    include_page_images: z.boolean().optional().default(false),
    images_scale: z.number().optional().default(2),
    md_page_break_placeholder: z.string().optional().default(""),
    do_code_enrichment: z.boolean().optional().default(false),
    do_formula_enrichment: z.boolean().optional().default(false),
    do_picture_classification: z.boolean().optional().default(false),
    do_chart_extraction: z.boolean().optional().default(false),
    do_picture_description: z.boolean().optional().default(false),
    picture_description_area_threshold: z.number().optional().default(0.05),
    picture_description_local: z.string().optional(),
    picture_description_api: z.string().optional(),
    vlm_pipeline_model: z.union([VlmModelType, z.null()]).optional(),
    vlm_pipeline_model_local: z.string().optional(),
    vlm_pipeline_model_api: z.string().optional(),
    vlm_pipeline_preset: z.union([z.string(), z.null()]).optional(),
    picture_description_preset: z.union([z.string(), z.null()]).optional(),
    code_formula_preset: z.union([z.string(), z.null()]).optional(),
    vlm_pipeline_custom_config: z.string().optional(),
    picture_description_custom_config: z.string().optional(),
    code_formula_custom_config: z.string().optional(),
    table_structure_preset: z.union([z.string(), z.null()]).optional(),
    table_structure_custom_config: z.string().optional(),
    layout_custom_config: z.string().optional(),
    layout_preset: z.union([z.string(), z.null()]).optional(),
    picture_classification_preset: z.union([z.string(), z.null()]).optional(),
    picture_classification_custom_config: z.string().optional(),
  })
  .passthrough();
const TaskType = z.enum(["convert", "chunk"]);
const TaskProcessingMeta = z
  .object({
    num_docs: z.number().int(),
    num_processed: z.number().int().optional().default(0),
    num_succeeded: z.number().int().optional().default(0),
    num_partially_succeeded: z.number().int().optional().default(0),
    num_failed: z.number().int().optional().default(0),
  })
  .passthrough();
const FailureCategory = z.enum([
  "policy",
  "capacity",
  "source_unavailable",
  "target_unavailable",
  "timeout",
  "internal",
]);
const FailurePhase = z.enum([
  "admission",
  "source_enumeration",
  "execution",
  "orchestration",
]);
const PublicFailureInfo = z
  .object({
    category: FailureCategory,
    message: z.string(),
    retryable: z.boolean(),
    phase: FailurePhase,
    details: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();
const TaskStatusResponse = z
  .object({
    task_id: z.string(),
    task_type: TaskType,
    task_status: ConversionStatus,
    task_position: z.union([z.number(), z.null()]).optional(),
    task_meta: z.union([TaskProcessingMeta, z.null()]).optional(),
    error_message: z.union([z.string(), z.null()]).optional(),
    failure: z.union([PublicFailureInfo, z.null()]).optional(),
  })
  .passthrough();
const AnyHttpSourceRequest = z
  .object({
    url: z.string().min(1).url(),
    headers: z.object({}).partial().passthrough().optional().default({}),
    kind: z.string().optional().default("http"),
  })
  .passthrough();
const S3SourceRequest = z
  .object({
    endpoint: z.string(),
    verify_ssl: z.boolean().optional().default(true),
    access_key: z.string(),
    secret_key: z.string(),
    bucket: z.string(),
    key_prefix: z.string().optional().default(""),
    max_num_elements: z.union([z.number(), z.null()]).optional(),
    kind: z.string().optional().default("s3"),
  })
  .passthrough();
const BatchConvertSourcesRequest = z
  .object({
    options: ConvertDocumentsOptions.optional(),
    sources: z
      .array(
        z.discriminatedUnion("kind", [AnyHttpSourceRequest, S3SourceRequest])
      )
      .min(1),
    target: z.discriminatedUnion("kind", [S3Target, PresignedUrlTarget]),
    callbacks: z.array(CallbackSpec).optional().default([]),
  })
  .passthrough();
const Body_process_file_async_v1_convert_file_async_post = z
  .object({
    files: z.array(z.string()),
    target_type: TargetName.optional(),
    from_formats: z
      .array(InputFormat)
      .optional()
      .default([
        "docx",
        "pptx",
        "html",
        "image",
        "pdf",
        "asciidoc",
        "md",
        "csv",
        "xlsx",
        "xml_uspto",
        "xml_jats",
        "xml_xbrl",
        "xml_doclang",
        "mets_gbs",
        "json_docling",
        "audio",
        "vtt",
        "latex",
        "email",
        "epub",
      ]),
    to_formats: z.array(OutputFormat).optional().default(["md"]),
    image_export_mode: ImageRefMode.optional(),
    do_ocr: z.boolean().optional().default(true),
    force_ocr: z.boolean().optional().default(false),
    ocr_engine: z.string().optional().default("auto"),
    ocr_lang: z.union([z.array(z.string()), z.null()]).optional(),
    ocr_preset: z.string().optional().default("auto"),
    ocr_custom_config: z.string().optional(),
    pdf_backend: PdfBackend.optional(),
    table_mode: TableFormerMode.optional(),
    table_cell_matching: z.boolean().optional().default(true),
    pipeline: ProcessingPipeline.optional(),
    page_range: z
      .array(z.any())
      .min(2)
      .max(2)
      .optional()
      .default([1, 9223372036854776000]),
    document_timeout: z.union([z.number(), z.null()]).optional(),
    abort_on_error: z.boolean().optional().default(false),
    do_table_structure: z.boolean().optional().default(true),
    include_images: z.boolean().optional().default(true),
    include_page_images: z.boolean().optional().default(false),
    images_scale: z.number().optional().default(2),
    md_page_break_placeholder: z.string().optional().default(""),
    do_code_enrichment: z.boolean().optional().default(false),
    do_formula_enrichment: z.boolean().optional().default(false),
    do_picture_classification: z.boolean().optional().default(false),
    do_chart_extraction: z.boolean().optional().default(false),
    do_picture_description: z.boolean().optional().default(false),
    picture_description_area_threshold: z.number().optional().default(0.05),
    picture_description_local: z.string().optional(),
    picture_description_api: z.string().optional(),
    vlm_pipeline_model: z.union([VlmModelType, z.null()]).optional(),
    vlm_pipeline_model_local: z.string().optional(),
    vlm_pipeline_model_api: z.string().optional(),
    vlm_pipeline_preset: z.union([z.string(), z.null()]).optional(),
    picture_description_preset: z.union([z.string(), z.null()]).optional(),
    code_formula_preset: z.union([z.string(), z.null()]).optional(),
    vlm_pipeline_custom_config: z.string().optional(),
    picture_description_custom_config: z.string().optional(),
    code_formula_custom_config: z.string().optional(),
    table_structure_preset: z.union([z.string(), z.null()]).optional(),
    table_structure_custom_config: z.string().optional(),
    layout_custom_config: z.string().optional(),
    layout_preset: z.union([z.string(), z.null()]).optional(),
    picture_classification_preset: z.union([z.string(), z.null()]).optional(),
    picture_classification_custom_config: z.string().optional(),
  })
  .passthrough();
const HybridChunkerOptions = z
  .object({
    chunker: z.string().default("hybrid"),
    use_markdown_tables: z.boolean().default(false),
    use_markdown_images: z.boolean().default(false),
    image_placeholder: z.string().default("![IMAGE]"),
    include_raw_text: z.boolean().default(false),
    max_tokens: z.union([z.number(), z.null()]),
    tokenizer: z.string().default("sentence-transformers/all-MiniLM-L6-v2"),
    merge_peers: z.boolean().default(true),
  })
  .partial()
  .passthrough();
const HybridChunkerOptionsDocumentsRequest = z
  .object({
    convert_options: ConvertDocumentsOptions.optional(),
    sources: z.array(
      z.discriminatedUnion("kind", [FileSourceRequest, HttpSourceRequest])
    ),
    include_converted_doc: z.boolean().optional().default(false),
    target: z
      .discriminatedUnion("kind", [
        InBodyTarget,
        ZipTarget,
        S3Target,
        PutTarget,
        PresignedUrlTarget,
      ])
      .optional()
      .default({ kind: "inbody" }),
    callbacks: z.array(CallbackSpec).optional().default([]),
    chunking_options: HybridChunkerOptions.optional(),
  })
  .passthrough();
const Body_Chunk_files_with_HybridChunker_as_async_task_v1_chunk_hybrid_file_async_post =
  z
    .object({
      files: z.array(z.string()),
      include_converted_doc: z.boolean().optional().default(false),
      target_type: TargetName.optional(),
      convert_from_formats: z
        .array(InputFormat)
        .optional()
        .default([
          "docx",
          "pptx",
          "html",
          "image",
          "pdf",
          "asciidoc",
          "md",
          "csv",
          "xlsx",
          "xml_uspto",
          "xml_jats",
          "xml_xbrl",
          "xml_doclang",
          "mets_gbs",
          "json_docling",
          "audio",
          "vtt",
          "latex",
          "email",
          "epub",
        ]),
      convert_image_export_mode: ImageRefMode.optional(),
      convert_do_ocr: z.boolean().optional().default(true),
      convert_force_ocr: z.boolean().optional().default(false),
      convert_ocr_engine: z.string().optional().default("auto"),
      convert_ocr_lang: z.union([z.array(z.string()), z.null()]).optional(),
      convert_ocr_preset: z.string().optional().default("auto"),
      convert_ocr_custom_config: z.string().optional(),
      convert_pdf_backend: PdfBackend.optional(),
      convert_table_mode: TableFormerMode.optional(),
      convert_table_cell_matching: z.boolean().optional().default(true),
      convert_pipeline: ProcessingPipeline.optional(),
      convert_page_range: z
        .array(z.any())
        .min(2)
        .max(2)
        .optional()
        .default([1, 9223372036854776000]),
      convert_document_timeout: z.union([z.number(), z.null()]).optional(),
      convert_abort_on_error: z.boolean().optional().default(false),
      convert_do_table_structure: z.boolean().optional().default(true),
      convert_include_images: z.boolean().optional().default(true),
      convert_include_page_images: z.boolean().optional().default(false),
      convert_images_scale: z.number().optional().default(2),
      convert_md_page_break_placeholder: z.string().optional().default(""),
      convert_do_code_enrichment: z.boolean().optional().default(false),
      convert_do_formula_enrichment: z.boolean().optional().default(false),
      convert_do_picture_classification: z.boolean().optional().default(false),
      convert_do_chart_extraction: z.boolean().optional().default(false),
      convert_do_picture_description: z.boolean().optional().default(false),
      convert_picture_description_area_threshold: z
        .number()
        .optional()
        .default(0.05),
      convert_picture_description_local: z.string().optional(),
      convert_picture_description_api: z.string().optional(),
      convert_vlm_pipeline_model: z.union([VlmModelType, z.null()]).optional(),
      convert_vlm_pipeline_model_local: z.string().optional(),
      convert_vlm_pipeline_model_api: z.string().optional(),
      convert_vlm_pipeline_preset: z.union([z.string(), z.null()]).optional(),
      convert_picture_description_preset: z
        .union([z.string(), z.null()])
        .optional(),
      convert_code_formula_preset: z.union([z.string(), z.null()]).optional(),
      convert_vlm_pipeline_custom_config: z.string().optional(),
      convert_picture_description_custom_config: z.string().optional(),
      convert_code_formula_custom_config: z.string().optional(),
      convert_table_structure_preset: z
        .union([z.string(), z.null()])
        .optional(),
      convert_table_structure_custom_config: z.string().optional(),
      convert_layout_custom_config: z.string().optional(),
      convert_layout_preset: z.union([z.string(), z.null()]).optional(),
      convert_picture_classification_preset: z
        .union([z.string(), z.null()])
        .optional(),
      convert_picture_classification_custom_config: z.string().optional(),
      chunking_use_markdown_tables: z.boolean().optional().default(false),
      chunking_use_markdown_images: z.boolean().optional().default(false),
      chunking_image_placeholder: z.string().optional().default("![IMAGE]"),
      chunking_include_raw_text: z.boolean().optional().default(false),
      chunking_max_tokens: z.union([z.number(), z.null()]).optional(),
      chunking_tokenizer: z
        .string()
        .optional()
        .default("sentence-transformers/all-MiniLM-L6-v2"),
      chunking_merge_peers: z.boolean().optional().default(true),
    })
    .passthrough();
const ChunkedDocumentResultItem = z
  .object({
    filename: z.string(),
    chunk_index: z.number().int(),
    text: z.string(),
    raw_text: z.union([z.string(), z.null()]).optional(),
    num_tokens: z.union([z.number(), z.null()]).optional(),
    headings: z.union([z.array(z.string()), z.null()]).optional(),
    captions: z.union([z.array(z.string()), z.null()]).optional(),
    doc_items: z.array(z.string()),
    page_numbers: z.union([z.array(z.number().int()), z.null()]).optional(),
    metadata: z
      .union([z.object({}).partial().passthrough(), z.null()])
      .optional(),
  })
  .passthrough();
const DocumentResultItem = z
  .object({
    kind: z.string().optional().default("ExportResult"),
    content: ExportDocumentResponse,
    status: ConversionStatus,
    errors: z.array(ErrorItem).optional().default([]),
    timings: z.record(z.string(), ProfilingItem).optional().default({}),
  })
  .passthrough();
const ChunkDocumentResponse = z
  .object({
    chunks: z.array(ChunkedDocumentResultItem),
    documents: z.array(DocumentResultItem),
    processing_time: z.number(),
  })
  .passthrough();
const Body_Chunk_files_with_HybridChunker_v1_chunk_hybrid_file_post = z
  .object({
    files: z.array(z.string()),
    include_converted_doc: z.boolean().optional().default(false),
    target_type: TargetName.optional(),
    convert_from_formats: z
      .array(InputFormat)
      .optional()
      .default([
        "docx",
        "pptx",
        "html",
        "image",
        "pdf",
        "asciidoc",
        "md",
        "csv",
        "xlsx",
        "xml_uspto",
        "xml_jats",
        "xml_xbrl",
        "xml_doclang",
        "mets_gbs",
        "json_docling",
        "audio",
        "vtt",
        "latex",
        "email",
        "epub",
      ]),
    convert_image_export_mode: ImageRefMode.optional(),
    convert_do_ocr: z.boolean().optional().default(true),
    convert_force_ocr: z.boolean().optional().default(false),
    convert_ocr_engine: z.string().optional().default("auto"),
    convert_ocr_lang: z.union([z.array(z.string()), z.null()]).optional(),
    convert_ocr_preset: z.string().optional().default("auto"),
    convert_ocr_custom_config: z.string().optional(),
    convert_pdf_backend: PdfBackend.optional(),
    convert_table_mode: TableFormerMode.optional(),
    convert_table_cell_matching: z.boolean().optional().default(true),
    convert_pipeline: ProcessingPipeline.optional(),
    convert_page_range: z
      .array(z.any())
      .min(2)
      .max(2)
      .optional()
      .default([1, 9223372036854776000]),
    convert_document_timeout: z.union([z.number(), z.null()]).optional(),
    convert_abort_on_error: z.boolean().optional().default(false),
    convert_do_table_structure: z.boolean().optional().default(true),
    convert_include_images: z.boolean().optional().default(true),
    convert_include_page_images: z.boolean().optional().default(false),
    convert_images_scale: z.number().optional().default(2),
    convert_md_page_break_placeholder: z.string().optional().default(""),
    convert_do_code_enrichment: z.boolean().optional().default(false),
    convert_do_formula_enrichment: z.boolean().optional().default(false),
    convert_do_picture_classification: z.boolean().optional().default(false),
    convert_do_chart_extraction: z.boolean().optional().default(false),
    convert_do_picture_description: z.boolean().optional().default(false),
    convert_picture_description_area_threshold: z
      .number()
      .optional()
      .default(0.05),
    convert_picture_description_local: z.string().optional(),
    convert_picture_description_api: z.string().optional(),
    convert_vlm_pipeline_model: z.union([VlmModelType, z.null()]).optional(),
    convert_vlm_pipeline_model_local: z.string().optional(),
    convert_vlm_pipeline_model_api: z.string().optional(),
    convert_vlm_pipeline_preset: z.union([z.string(), z.null()]).optional(),
    convert_picture_description_preset: z
      .union([z.string(), z.null()])
      .optional(),
    convert_code_formula_preset: z.union([z.string(), z.null()]).optional(),
    convert_vlm_pipeline_custom_config: z.string().optional(),
    convert_picture_description_custom_config: z.string().optional(),
    convert_code_formula_custom_config: z.string().optional(),
    convert_table_structure_preset: z.union([z.string(), z.null()]).optional(),
    convert_table_structure_custom_config: z.string().optional(),
    convert_layout_custom_config: z.string().optional(),
    convert_layout_preset: z.union([z.string(), z.null()]).optional(),
    convert_picture_classification_preset: z
      .union([z.string(), z.null()])
      .optional(),
    convert_picture_classification_custom_config: z.string().optional(),
    chunking_use_markdown_tables: z.boolean().optional().default(false),
    chunking_use_markdown_images: z.boolean().optional().default(false),
    chunking_image_placeholder: z.string().optional().default("![IMAGE]"),
    chunking_include_raw_text: z.boolean().optional().default(false),
    chunking_max_tokens: z.union([z.number(), z.null()]).optional(),
    chunking_tokenizer: z
      .string()
      .optional()
      .default("sentence-transformers/all-MiniLM-L6-v2"),
    chunking_merge_peers: z.boolean().optional().default(true),
  })
  .passthrough();
const HierarchicalChunkerOptions = z
  .object({
    chunker: z.string().default("hierarchical"),
    use_markdown_tables: z.boolean().default(false),
    use_markdown_images: z.boolean().default(false),
    image_placeholder: z.string().default("![IMAGE]"),
    include_raw_text: z.boolean().default(false),
  })
  .partial()
  .passthrough();
const HierarchicalChunkerOptionsDocumentsRequest = z
  .object({
    convert_options: ConvertDocumentsOptions.optional(),
    sources: z.array(
      z.discriminatedUnion("kind", [FileSourceRequest, HttpSourceRequest])
    ),
    include_converted_doc: z.boolean().optional().default(false),
    target: z
      .discriminatedUnion("kind", [
        InBodyTarget,
        ZipTarget,
        S3Target,
        PutTarget,
        PresignedUrlTarget,
      ])
      .optional()
      .default({ kind: "inbody" }),
    callbacks: z.array(CallbackSpec).optional().default([]),
    chunking_options: HierarchicalChunkerOptions.optional(),
  })
  .passthrough();
const Body_Chunk_files_with_HierarchicalChunker_as_async_task_v1_chunk_hierarchical_file_async_post =
  z
    .object({
      files: z.array(z.string()),
      include_converted_doc: z.boolean().optional().default(false),
      target_type: TargetName.optional(),
      convert_from_formats: z
        .array(InputFormat)
        .optional()
        .default([
          "docx",
          "pptx",
          "html",
          "image",
          "pdf",
          "asciidoc",
          "md",
          "csv",
          "xlsx",
          "xml_uspto",
          "xml_jats",
          "xml_xbrl",
          "xml_doclang",
          "mets_gbs",
          "json_docling",
          "audio",
          "vtt",
          "latex",
          "email",
          "epub",
        ]),
      convert_image_export_mode: ImageRefMode.optional(),
      convert_do_ocr: z.boolean().optional().default(true),
      convert_force_ocr: z.boolean().optional().default(false),
      convert_ocr_engine: z.string().optional().default("auto"),
      convert_ocr_lang: z.union([z.array(z.string()), z.null()]).optional(),
      convert_ocr_preset: z.string().optional().default("auto"),
      convert_ocr_custom_config: z.string().optional(),
      convert_pdf_backend: PdfBackend.optional(),
      convert_table_mode: TableFormerMode.optional(),
      convert_table_cell_matching: z.boolean().optional().default(true),
      convert_pipeline: ProcessingPipeline.optional(),
      convert_page_range: z
        .array(z.any())
        .min(2)
        .max(2)
        .optional()
        .default([1, 9223372036854776000]),
      convert_document_timeout: z.union([z.number(), z.null()]).optional(),
      convert_abort_on_error: z.boolean().optional().default(false),
      convert_do_table_structure: z.boolean().optional().default(true),
      convert_include_images: z.boolean().optional().default(true),
      convert_include_page_images: z.boolean().optional().default(false),
      convert_images_scale: z.number().optional().default(2),
      convert_md_page_break_placeholder: z.string().optional().default(""),
      convert_do_code_enrichment: z.boolean().optional().default(false),
      convert_do_formula_enrichment: z.boolean().optional().default(false),
      convert_do_picture_classification: z.boolean().optional().default(false),
      convert_do_chart_extraction: z.boolean().optional().default(false),
      convert_do_picture_description: z.boolean().optional().default(false),
      convert_picture_description_area_threshold: z
        .number()
        .optional()
        .default(0.05),
      convert_picture_description_local: z.string().optional(),
      convert_picture_description_api: z.string().optional(),
      convert_vlm_pipeline_model: z.union([VlmModelType, z.null()]).optional(),
      convert_vlm_pipeline_model_local: z.string().optional(),
      convert_vlm_pipeline_model_api: z.string().optional(),
      convert_vlm_pipeline_preset: z.union([z.string(), z.null()]).optional(),
      convert_picture_description_preset: z
        .union([z.string(), z.null()])
        .optional(),
      convert_code_formula_preset: z.union([z.string(), z.null()]).optional(),
      convert_vlm_pipeline_custom_config: z.string().optional(),
      convert_picture_description_custom_config: z.string().optional(),
      convert_code_formula_custom_config: z.string().optional(),
      convert_table_structure_preset: z
        .union([z.string(), z.null()])
        .optional(),
      convert_table_structure_custom_config: z.string().optional(),
      convert_layout_custom_config: z.string().optional(),
      convert_layout_preset: z.union([z.string(), z.null()]).optional(),
      convert_picture_classification_preset: z
        .union([z.string(), z.null()])
        .optional(),
      convert_picture_classification_custom_config: z.string().optional(),
      chunking_use_markdown_tables: z.boolean().optional().default(false),
      chunking_use_markdown_images: z.boolean().optional().default(false),
      chunking_image_placeholder: z.string().optional().default("![IMAGE]"),
      chunking_include_raw_text: z.boolean().optional().default(false),
    })
    .passthrough();
const Body_Chunk_files_with_HierarchicalChunker_v1_chunk_hierarchical_file_post =
  z
    .object({
      files: z.array(z.string()),
      include_converted_doc: z.boolean().optional().default(false),
      target_type: TargetName.optional(),
      convert_from_formats: z
        .array(InputFormat)
        .optional()
        .default([
          "docx",
          "pptx",
          "html",
          "image",
          "pdf",
          "asciidoc",
          "md",
          "csv",
          "xlsx",
          "xml_uspto",
          "xml_jats",
          "xml_xbrl",
          "xml_doclang",
          "mets_gbs",
          "json_docling",
          "audio",
          "vtt",
          "latex",
          "email",
          "epub",
        ]),
      convert_image_export_mode: ImageRefMode.optional(),
      convert_do_ocr: z.boolean().optional().default(true),
      convert_force_ocr: z.boolean().optional().default(false),
      convert_ocr_engine: z.string().optional().default("auto"),
      convert_ocr_lang: z.union([z.array(z.string()), z.null()]).optional(),
      convert_ocr_preset: z.string().optional().default("auto"),
      convert_ocr_custom_config: z.string().optional(),
      convert_pdf_backend: PdfBackend.optional(),
      convert_table_mode: TableFormerMode.optional(),
      convert_table_cell_matching: z.boolean().optional().default(true),
      convert_pipeline: ProcessingPipeline.optional(),
      convert_page_range: z
        .array(z.any())
        .min(2)
        .max(2)
        .optional()
        .default([1, 9223372036854776000]),
      convert_document_timeout: z.union([z.number(), z.null()]).optional(),
      convert_abort_on_error: z.boolean().optional().default(false),
      convert_do_table_structure: z.boolean().optional().default(true),
      convert_include_images: z.boolean().optional().default(true),
      convert_include_page_images: z.boolean().optional().default(false),
      convert_images_scale: z.number().optional().default(2),
      convert_md_page_break_placeholder: z.string().optional().default(""),
      convert_do_code_enrichment: z.boolean().optional().default(false),
      convert_do_formula_enrichment: z.boolean().optional().default(false),
      convert_do_picture_classification: z.boolean().optional().default(false),
      convert_do_chart_extraction: z.boolean().optional().default(false),
      convert_do_picture_description: z.boolean().optional().default(false),
      convert_picture_description_area_threshold: z
        .number()
        .optional()
        .default(0.05),
      convert_picture_description_local: z.string().optional(),
      convert_picture_description_api: z.string().optional(),
      convert_vlm_pipeline_model: z.union([VlmModelType, z.null()]).optional(),
      convert_vlm_pipeline_model_local: z.string().optional(),
      convert_vlm_pipeline_model_api: z.string().optional(),
      convert_vlm_pipeline_preset: z.union([z.string(), z.null()]).optional(),
      convert_picture_description_preset: z
        .union([z.string(), z.null()])
        .optional(),
      convert_code_formula_preset: z.union([z.string(), z.null()]).optional(),
      convert_vlm_pipeline_custom_config: z.string().optional(),
      convert_picture_description_custom_config: z.string().optional(),
      convert_code_formula_custom_config: z.string().optional(),
      convert_table_structure_preset: z
        .union([z.string(), z.null()])
        .optional(),
      convert_table_structure_custom_config: z.string().optional(),
      convert_layout_custom_config: z.string().optional(),
      convert_layout_preset: z.union([z.string(), z.null()]).optional(),
      convert_picture_classification_preset: z
        .union([z.string(), z.null()])
        .optional(),
      convert_picture_classification_custom_config: z.string().optional(),
      chunking_use_markdown_tables: z.boolean().optional().default(false),
      chunking_use_markdown_images: z.boolean().optional().default(false),
      chunking_image_placeholder: z.string().optional().default("![IMAGE]"),
      chunking_include_raw_text: z.boolean().optional().default(false),
    })
    .passthrough();
const TaskFailureResult = z
  .object({
    kind: z.string().optional().default("TaskFailureResult"),
    failure: PublicFailureInfo,
  })
  .passthrough();
const ClearResponse = z
  .object({ status: z.string().default("ok") })
  .partial()
  .passthrough();
const SummaryMetaField = z
  .object({
    confidence: z.number().optional(),
    created_by: z.union([z.string(), z.null()]).optional(),
    text: z.string(),
  })
  .passthrough();
const HumanLanguageLabel = z.enum([
  "aa",
  "ab",
  "ae",
  "af",
  "ak",
  "am",
  "an",
  "ar",
  "as",
  "av",
  "ay",
  "az",
  "ba",
  "be",
  "bg",
  "bh",
  "bi",
  "bm",
  "bn",
  "bo",
  "br",
  "bs",
  "ca",
  "ce",
  "ch",
  "co",
  "cr",
  "cs",
  "cu",
  "cv",
  "cy",
  "da",
  "de",
  "dv",
  "dz",
  "ee",
  "el",
  "en",
  "eo",
  "es",
  "et",
  "eu",
  "fa",
  "ff",
  "fi",
  "fj",
  "fo",
  "fr",
  "fy",
  "ga",
  "gd",
  "gl",
  "gn",
  "gu",
  "gv",
  "ha",
  "he",
  "hi",
  "ho",
  "hr",
  "ht",
  "hu",
  "hy",
  "hz",
  "ia",
  "id",
  "ie",
  "ig",
  "ii",
  "ik",
  "io",
  "is",
  "it",
  "iu",
  "ja",
  "jv",
  "ka",
  "kg",
  "ki",
  "kj",
  "kk",
  "kl",
  "km",
  "kn",
  "ko",
  "kr",
  "ks",
  "ku",
  "kv",
  "kw",
  "ky",
  "la",
  "lb",
  "lg",
  "li",
  "ln",
  "lo",
  "lt",
  "lu",
  "lv",
  "mg",
  "mh",
  "mi",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms",
  "mt",
  "my",
  "na",
  "nb",
  "nd",
  "ne",
  "ng",
  "nl",
  "nn",
  "no",
  "nr",
  "nv",
  "ny",
  "oc",
  "oj",
  "om",
  "or",
  "os",
  "pa",
  "pi",
  "pl",
  "ps",
  "pt",
  "qu",
  "rm",
  "rn",
  "ro",
  "ru",
  "rw",
  "sa",
  "sc",
  "sd",
  "se",
  "sg",
  "sh",
  "si",
  "sk",
  "sl",
  "sm",
  "sn",
  "so",
  "sq",
  "sr",
  "ss",
  "st",
  "su",
  "sv",
  "sw",
  "ta",
  "te",
  "tg",
  "th",
  "ti",
  "tk",
  "tl",
  "tn",
  "to",
  "tr",
  "ts",
  "tt",
  "tw",
  "ty",
  "ug",
  "uk",
  "ur",
  "uz",
  "ve",
  "vi",
  "vo",
  "wa",
  "wo",
  "xh",
  "yi",
  "yo",
  "za",
  "zh",
  "zu",
]);
const LanguageMetaField = z
  .object({
    confidence: z.number().optional(),
    created_by: z.union([z.string(), z.null()]).optional(),
    code: HumanLanguageLabel,
  })
  .passthrough();
const EntityMention = z
  .object({
    confidence: z.number().optional(),
    created_by: z.union([z.string(), z.null()]).optional(),
    text: z.string(),
    orig: z.union([z.string(), z.null()]).optional(),
    label: z.union([z.string(), z.null()]).optional(),
    charspan: z.union([z.array(z.any()), z.null()]).optional(),
  })
  .passthrough();
const EntitiesMetaField = z
  .object({ mentions: z.array(EntityMention).min(1) })
  .passthrough();
const KeywordsMetaField = z
  .object({ values: z.array(z.string()).min(1) })
  .passthrough();
const TopicsMetaField = z
  .object({ values: z.array(z.string()).min(1) })
  .passthrough();
const BaseMeta = z
  .object({
    summary: z.union([SummaryMetaField, z.null()]),
    language: z.union([LanguageMetaField, z.null()]),
    entities: z.union([EntitiesMetaField, z.null()]),
    keywords: z.union([KeywordsMetaField, z.null()]),
    topics: z.union([TopicsMetaField, z.null()]),
  })
  .partial()
  .passthrough();
const CoordOrigin = z.enum(["TOPLEFT", "BOTTOMLEFT"]);
const BoundingBox = z
  .object({
    l: z.number(),
    t: z.number(),
    r: z.number(),
    b: z.number(),
    coord_origin: CoordOrigin.optional(),
  })
  .passthrough();
const ChartBar = z
  .object({ label: z.string(), values: z.number() })
  .passthrough();
const ChartLine = z
  .object({
    label: z.string(),
    values: z.array(z.array(z.any()).min(2).max(2)),
  })
  .passthrough();
const ChartPoint = z
  .object({ value: z.array(z.any()).min(2).max(2) })
  .passthrough();
const ChartSlice = z
  .object({ label: z.string(), value: z.number() })
  .passthrough();
const ChartStackedBar = z
  .object({
    label: z.array(z.string()),
    values: z.array(z.array(z.any()).min(2).max(2)),
  })
  .passthrough();
const CodeItem = z.object({}).partial().passthrough();
const CodeLanguageLabel = z.enum([
  "Ada",
  "Awk",
  "Bash",
  "bc",
  "C",
  "C#",
  "C++",
  "CMake",
  "COBOL",
  "CSS",
  "Ceylon",
  "Clojure",
  "Crystal",
  "Cuda",
  "Cython",
  "D",
  "Dart",
  "dc",
  "Dockerfile",
  "DocLang",
  "Elixir",
  "Erlang",
  "FORTRAN",
  "Forth",
  "Go",
  "HTML",
  "Haskell",
  "Haxe",
  "Java",
  "JavaScript",
  "JSON",
  "Julia",
  "Kotlin",
  "Latex",
  "Lisp",
  "Lua",
  "Matlab",
  "MoonScript",
  "Nim",
  "OCaml",
  "ObjectiveC",
  "Octave",
  "PHP",
  "Pascal",
  "Perl",
  "Prolog",
  "Python",
  "Racket",
  "Ruby",
  "Rust",
  "SML",
  "SQL",
  "Scala",
  "Scheme",
  "Swift",
  "Tikz",
  "TypeScript",
  "unknown",
  "VisualBasic",
  "XML",
  "YAML",
]);
const CodeMetaField = z
  .object({
    confidence: z.number().optional(),
    created_by: z.union([z.string(), z.null()]).optional(),
    text: z.string(),
    language: z.union([CodeLanguageLabel, z.null()]).optional(),
  })
  .passthrough();
const ContentLayer = z.enum([
  "body",
  "furniture",
  "background",
  "invisible",
  "notes",
]);
const DescriptionAnnotation = z
  .object({
    kind: z.string().optional().default("description"),
    text: z.string(),
    provenance: z.string(),
  })
  .passthrough();
const DescriptionMetaField = z
  .object({
    confidence: z.number().optional(),
    created_by: z.union([z.string(), z.null()]).optional(),
    text: z.string(),
  })
  .passthrough();
const DocumentOrigin = z
  .object({
    mimetype: z.string(),
    binary_hash: z.number().int().gte(0).lte(18446744073709552000),
    filename: z.string(),
    uri: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();
const FieldHeadingItem = z.object({}).partial().passthrough();
const FieldItem = z.object({}).partial().passthrough();
const FieldRegionItem = z.object({}).partial().passthrough();
const FieldValueItem = z.object({}).partial().passthrough();
const FineRef = z
  .object({
    $ref: z.string().regex(/^#(?:\/([\w-]+)(?:\/(\d+))?)?$/),
    range: z.union([z.array(z.any()), z.null()]).optional(),
  })
  .passthrough();
const FloatingMeta = z
  .object({
    summary: z.union([SummaryMetaField, z.null()]),
    language: z.union([LanguageMetaField, z.null()]),
    entities: z.union([EntitiesMetaField, z.null()]),
    keywords: z.union([KeywordsMetaField, z.null()]),
    topics: z.union([TopicsMetaField, z.null()]),
    description: z.union([DescriptionMetaField, z.null()]),
  })
  .partial()
  .passthrough();
const FormItem = z.object({}).partial().passthrough();
const Script = z.enum(["baseline", "sub", "super"]);
const Formatting = z
  .object({
    bold: z.boolean().default(false),
    italic: z.boolean().default(false),
    underline: z.boolean().default(false),
    strikethrough: z.boolean().default(false),
    script: Script,
  })
  .partial()
  .passthrough();
const FormulaItem = z.object({}).partial().passthrough();
const GraphCellLabel = z.enum(["unspecified", "key", "value", "checkbox"]);
const ProvenanceItem = z
  .object({
    page_no: z.number().int(),
    bbox: BoundingBox,
    charspan: z.array(z.any()).min(2).max(2),
  })
  .passthrough();
const RefItem = z
  .object({ $ref: z.string().regex(/^#(?:\/([\w-]+)(?:\/(\d+))?)?$/) })
  .passthrough();
const GraphCell = z
  .object({
    label: GraphCellLabel,
    cell_id: z.number().int(),
    text: z.string(),
    orig: z.string(),
    prov: z.union([ProvenanceItem, z.null()]).optional(),
    item_ref: z.union([RefItem, z.null()]).optional(),
  })
  .passthrough();
const GraphLinkLabel = z.enum([
  "unspecified",
  "to_value",
  "to_key",
  "to_parent",
  "to_child",
]);
const GraphLink = z
  .object({
    label: GraphLinkLabel,
    source_cell_id: z.number().int(),
    target_cell_id: z.number().int(),
  })
  .passthrough();
const GraphData = z
  .object({ cells: z.array(GraphCell), links: z.array(GraphLink) })
  .partial()
  .passthrough();
const GroupLabel = z.enum([
  "unspecified",
  "list",
  "ordered_list",
  "chapter",
  "section",
  "sheet",
  "slide",
  "form_area",
  "key_value_area",
  "comment_section",
  "inline",
  "picture_area",
]);
const GroupItem = z.object({
  self_ref: z.string().regex(/^#(?:\/([\w-]+)(?:\/(\d+))?)?$/),
  parent: z.union([RefItem, z.null()]).optional(),
  children: z.array(RefItem).optional().default([]),
  content_layer: ContentLayer.optional(),
  meta: z.union([BaseMeta, z.null()]).optional(),
  name: z.string().optional().default("group"),
  label: GroupLabel.optional(),
});
const Size = z
  .object({ width: z.number(), height: z.number() })
  .partial()
  .passthrough();
const ImageRef = z
  .object({
    mimetype: z.string(),
    dpi: z.number().int(),
    size: Size,
    uri: z.union([z.string(), z.string()]),
  })
  .passthrough();
const InlineGroup = z.object({
  self_ref: z.string().regex(/^#(?:\/([\w-]+)(?:\/(\d+))?)?$/),
  parent: z.union([RefItem, z.null()]).optional(),
  children: z.array(RefItem).optional().default([]),
  content_layer: ContentLayer.optional(),
  meta: z.union([BaseMeta, z.null()]).optional(),
  name: z.string().optional().default("group"),
  label: z.string().optional().default("inline"),
});
const KeyValueItem = z.object({}).partial().passthrough();
const ListGroup = z.object({
  self_ref: z.string().regex(/^#(?:\/([\w-]+)(?:\/(\d+))?)?$/),
  parent: z.union([RefItem, z.null()]).optional(),
  children: z.array(RefItem).optional().default([]),
  content_layer: ContentLayer.optional(),
  meta: z.union([BaseMeta, z.null()]).optional(),
  name: z.string().optional().default("group"),
  label: z.string().optional().default("list"),
});
const ListItem = z.object({}).partial().passthrough();
const MiscAnnotation = z
  .object({
    kind: z.string().optional().default("misc"),
    content: z.object({}).partial().passthrough(),
  })
  .passthrough();
const MoleculeMetaField = z
  .object({
    confidence: z.number().optional(),
    created_by: z.union([z.string(), z.null()]).optional(),
    smi: z.string(),
  })
  .passthrough();
const Orientation = z.enum(["rot_0", "rot_90", "rot_180", "rot_270"]);
const PageItem = z
  .object({
    size: Size,
    image: z.union([ImageRef, z.null()]).optional(),
    page_no: z.number().int(),
  })
  .passthrough();
const PictureBarChartData = z
  .object({
    kind: z.string().optional().default("bar_chart_data"),
    title: z.string(),
    x_axis_label: z.string(),
    y_axis_label: z.string(),
    bars: z.array(ChartBar),
  })
  .passthrough();
const PictureClassificationClass = z
  .object({ class_name: z.string(), confidence: z.number() })
  .passthrough();
const PictureClassificationData = z
  .object({
    kind: z.string().optional().default("classification"),
    provenance: z.string(),
    predicted_classes: z.array(PictureClassificationClass),
  })
  .passthrough();
const PictureClassificationPrediction = z
  .object({
    confidence: z.number().optional(),
    created_by: z.union([z.string(), z.null()]).optional(),
    class_name: z.string(),
  })
  .passthrough();
const PictureClassificationMetaField = z
  .object({ predictions: z.array(PictureClassificationPrediction).min(1) })
  .partial()
  .passthrough();
const PictureItem = z.object({}).partial().passthrough();
const PictureLineChartData = z
  .object({
    kind: z.string().optional().default("line_chart_data"),
    title: z.string(),
    x_axis_label: z.string(),
    y_axis_label: z.string(),
    lines: z.array(ChartLine),
  })
  .passthrough();
const RichTableCell = z
  .object({
    bbox: z.union([BoundingBox, z.null()]).optional(),
    row_span: z.number().int().optional().default(1),
    col_span: z.number().int().optional().default(1),
    start_row_offset_idx: z.number().int(),
    end_row_offset_idx: z.number().int(),
    start_col_offset_idx: z.number().int(),
    end_col_offset_idx: z.number().int(),
    text: z.string(),
    column_header: z.boolean().optional().default(false),
    row_header: z.boolean().optional().default(false),
    row_section: z.boolean().optional().default(false),
    fillable: z.boolean().optional().default(false),
    ref: RefItem,
  })
  .passthrough();
const TableCell = z
  .object({
    bbox: z.union([BoundingBox, z.null()]).optional(),
    row_span: z.number().int().optional().default(1),
    col_span: z.number().int().optional().default(1),
    start_row_offset_idx: z.number().int(),
    end_row_offset_idx: z.number().int(),
    start_col_offset_idx: z.number().int(),
    end_col_offset_idx: z.number().int(),
    text: z.string(),
    column_header: z.boolean().optional().default(false),
    row_header: z.boolean().optional().default(false),
    row_section: z.boolean().optional().default(false),
    fillable: z.boolean().optional().default(false),
  })
  .passthrough();
const TableData = z
  .object({
    table_cells: z
      .array(z.union([RichTableCell, TableCell]))
      .optional()
      .default([]),
    num_rows: z.number().int().optional().default(0),
    num_cols: z.number().int().optional().default(0),
    orientation: Orientation.optional(),
    grid: z.array(z.array(TableCell)),
  })
  .passthrough();
const TabularChartMetaField = z
  .object({
    confidence: z.number().optional(),
    created_by: z.union([z.string(), z.null()]).optional(),
    title: z.union([z.string(), z.null()]).optional(),
    chart_data: TableData,
  })
  .passthrough();
const PictureMeta = z
  .object({
    summary: z.union([SummaryMetaField, z.null()]),
    language: z.union([LanguageMetaField, z.null()]),
    entities: z.union([EntitiesMetaField, z.null()]),
    keywords: z.union([KeywordsMetaField, z.null()]),
    topics: z.union([TopicsMetaField, z.null()]),
    description: z.union([DescriptionMetaField, z.null()]),
    classification: z.union([PictureClassificationMetaField, z.null()]),
    molecule: z.union([MoleculeMetaField, z.null()]),
    tabular_chart: z.union([TabularChartMetaField, z.null()]),
    code: z.union([CodeMetaField, z.null()]),
  })
  .partial()
  .passthrough();
const PictureMoleculeData = z
  .object({
    kind: z.string().optional().default("molecule_data"),
    smi: z.string(),
    confidence: z.number(),
    class_name: z.string(),
    segmentation: z.array(z.array(z.any()).min(2).max(2)),
    provenance: z.string(),
  })
  .passthrough();
const PicturePieChartData = z
  .object({
    kind: z.string().optional().default("pie_chart_data"),
    title: z.string(),
    slices: z.array(ChartSlice),
  })
  .passthrough();
const PictureScatterChartData = z
  .object({
    kind: z.string().optional().default("scatter_chart_data"),
    title: z.string(),
    x_axis_label: z.string(),
    y_axis_label: z.string(),
    points: z.array(ChartPoint),
  })
  .passthrough();
const PictureStackedBarChartData = z
  .object({
    kind: z.string().optional().default("stacked_bar_chart_data"),
    title: z.string(),
    x_axis_label: z.string(),
    y_axis_label: z.string(),
    stacked_bars: z.array(ChartStackedBar),
  })
  .passthrough();
const PictureTabularChartData = z
  .object({
    kind: z.string().optional().default("tabular_chart_data"),
    title: z.string(),
    chart_data: TableData,
  })
  .passthrough();
const SectionHeaderItem = z.object({}).partial().passthrough();
const TableItem = z.object({}).partial().passthrough();
const TextItem = z.object({}).partial().passthrough();
const TitleItem = z.object({}).partial().passthrough();
const TrackSource = z
  .object({
    kind: z.string().optional().default("track"),
    start_time: z.number(),
    end_time: z.number(),
    identifier: z.union([z.string(), z.null()]).optional(),
    voice: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();
export const schemas = {
  HealthCheckResponse,
  ReadinessResponse,
  InputFormat,
  OutputFormat,
  ImageRefMode,
  PdfBackend,
  TableFormerMode,
  ProcessingPipeline,
  PictureClassificationLabel,
  PictureDescriptionLocal,
  PictureDescriptionApi,
  VlmModelType,
  ResponseFormat,
  InferenceFramework,
  TransformersModelType,
  VlmModelLocal,
  VlmModelApi,
  VlmEngineType,
  BaseVlmEngineOptions,
  EngineModelConfig,
  ApiModelConfig,
  VlmModelSpec,
  VlmConvertOptions,
  PictureDescriptionVlmEngineOptions,
  CodeFormulaVlmOptions,
  ConvertDocumentsOptions,
  FileSourceRequest,
  HttpSourceRequest,
  InBodyTarget,
  ZipTarget,
  S3Target,
  PutTarget,
  PresignedUrlTarget,
  CallbackSpec,
  ConvertSourcesRequest,
  X_Tenant_Id,
  DoclingDocument,
  ExportDocumentResponse,
  ConversionStatus,
  DoclingComponentType,
  ErrorItem,
  ProfilingScope,
  ProfilingItem,
  ConvertDocumentResponse,
  PresignedUrlConvertDocumentResponse,
  ArtifactRef,
  DocumentArtifactItem,
  PresignedUrlConvertResponse,
  ValidationError,
  HTTPValidationError,
  TargetName,
  Body_process_file_v1_convert_file_post,
  TaskType,
  TaskProcessingMeta,
  FailureCategory,
  FailurePhase,
  PublicFailureInfo,
  TaskStatusResponse,
  AnyHttpSourceRequest,
  S3SourceRequest,
  BatchConvertSourcesRequest,
  Body_process_file_async_v1_convert_file_async_post,
  HybridChunkerOptions,
  HybridChunkerOptionsDocumentsRequest,
  Body_Chunk_files_with_HybridChunker_as_async_task_v1_chunk_hybrid_file_async_post,
  ChunkedDocumentResultItem,
  DocumentResultItem,
  ChunkDocumentResponse,
  Body_Chunk_files_with_HybridChunker_v1_chunk_hybrid_file_post,
  HierarchicalChunkerOptions,
  HierarchicalChunkerOptionsDocumentsRequest,
  Body_Chunk_files_with_HierarchicalChunker_as_async_task_v1_chunk_hierarchical_file_async_post,
  Body_Chunk_files_with_HierarchicalChunker_v1_chunk_hierarchical_file_post,
  TaskFailureResult,
  ClearResponse,
  SummaryMetaField,
  HumanLanguageLabel,
  LanguageMetaField,
  EntityMention,
  EntitiesMetaField,
  KeywordsMetaField,
  TopicsMetaField,
  BaseMeta,
  CoordOrigin,
  BoundingBox,
  ChartBar,
  ChartLine,
  ChartPoint,
  ChartSlice,
  ChartStackedBar,
  CodeItem,
  CodeLanguageLabel,
  CodeMetaField,
  ContentLayer,
  DescriptionAnnotation,
  DescriptionMetaField,
  DocumentOrigin,
  FieldHeadingItem,
  FieldItem,
  FieldRegionItem,
  FieldValueItem,
  FineRef,
  FloatingMeta,
  FormItem,
  Script,
  Formatting,
  FormulaItem,
  GraphCellLabel,
  ProvenanceItem,
  RefItem,
  GraphCell,
  GraphLinkLabel,
  GraphLink,
  GraphData,
  GroupLabel,
  GroupItem,
  Size,
  ImageRef,
  InlineGroup,
  KeyValueItem,
  ListGroup,
  ListItem,
  MiscAnnotation,
  MoleculeMetaField,
  Orientation,
  PageItem,
  PictureBarChartData,
  PictureClassificationClass,
  PictureClassificationData,
  PictureClassificationPrediction,
  PictureClassificationMetaField,
  PictureItem,
  PictureLineChartData,
  RichTableCell,
  TableCell,
  TableData,
  TabularChartMetaField,
  PictureMeta,
  PictureMoleculeData,
  PicturePieChartData,
  PictureScatterChartData,
  PictureStackedBarChartData,
  PictureTabularChartData,
  SectionHeaderItem,
  TableItem,
  TextItem,
  TitleItem,
  TrackSource,
};
