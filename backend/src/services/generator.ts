type GeneratorSource = {
  title: string;
  source_type: string;
  content: string;
};

type GeneratorResult = {
  body: string;
  promptHead: string;
};

const PROMPT_HEAD_LIMIT = 160;

function buildPromptHead(source: GeneratorSource | null): string {
  if (!source) {
    return "mock-generate: no source";
  }

  const contentSnippet = source.content.replace(/\s+/g, " ").trim().slice(0, PROMPT_HEAD_LIMIT);
  return `mock-generate: ${source.title} | ${source.source_type} | ${contentSnippet}`;
}

function buildBody(source: GeneratorSource | null): string {
  if (!source) {
    return [
      "未找到关联的 Source，本次生成仅基于 Document 标题。",
      "",
      "请补充 Source 内容后重新生成。"
    ].join("\n");
  }

  const trimmedContent = source.content.trim();
  const intro = `《${source.title}》`;
  const headline = trimmedContent ? "正文" : "正文（暂无内容）";
  const contentSection = trimmedContent || "Source 内容为空，请补充素材后再次生成。";

  return [intro, "", headline, contentSection].join("\n");
}

export function generateDocumentBody(source: GeneratorSource | null): GeneratorResult {
  return {
    body: buildBody(source),
    promptHead: buildPromptHead(source)
  };
}
