type SourcePosition = {
  start?: { line?: number };
  end?: { line?: number };
};

type SourceNode = {
  type: string;
  value?: unknown;
  position?: SourcePosition;
  children?: SourceNode[];
  tagName?: string;
  properties?: Record<string, unknown>;
};

type RawNode = SourceNode & { type: "raw"; value: string };
type TextNode = SourceNode & { type: "text"; value: string };

export function rehypeMarkdownHtmlSource() {
  return (tree: unknown): void => {
    const root = asSourceNode(tree);

    if (!root) {
      return;
    }

    transformChildren(root);
  };
}

function asSourceNode(value: unknown): SourceNode | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return value as SourceNode;
}

function isRawNode(node: SourceNode | undefined): node is RawNode {
  return node?.type === "raw" && typeof node.value === "string";
}

function isWhitespaceText(node: SourceNode | undefined): node is TextNode {
  return (
    node?.type === "text" &&
    typeof node.value === "string" &&
    node.value.trim().length === 0
  );
}

function transformChildren(parent: SourceNode): void {
  if (!Array.isArray(parent.children)) {
    return;
  }

  const originalChildren = parent.children;
  const transformedChildren: SourceNode[] = [];

  for (let index = 0; index < originalChildren.length; ) {
    const current = originalChildren[index];

    if (!isRawNode(current)) {
      transformChildren(current);
      transformedChildren.push(current);
      index += 1;
      continue;
    }

    const rawNodes = [current];
    const gaps: string[] = [];
    let scanIndex = index + 1;

    while (scanIndex < originalChildren.length) {
      const next = originalChildren[scanIndex];

      if (isRawNode(next)) {
        gaps.push(sourceGap(currentRaw(rawNodes), next, ""));
        rawNodes.push(next);
        scanIndex += 1;
        continue;
      }

      let separatorIndex = scanIndex;
      let fallbackGap = "";

      while (
        separatorIndex < originalChildren.length &&
        isWhitespaceText(originalChildren[separatorIndex])
      ) {
        fallbackGap += originalChildren[separatorIndex].value;
        separatorIndex += 1;
      }

      const followingRaw = originalChildren[separatorIndex];

      if (!isRawNode(followingRaw)) {
        break;
      }

      gaps.push(sourceGap(currentRaw(rawNodes), followingRaw, fallbackGap));
      rawNodes.push(followingRaw);
      scanIndex = separatorIndex + 1;
    }

    transformedChildren.push(createSourceWrapper(rawNodes, gaps));
    index = scanIndex;
  }

  parent.children = transformedChildren;
}

function currentRaw(rawNodes: RawNode[]): RawNode {
  return rawNodes[rawNodes.length - 1];
}

function sourceGap(previous: RawNode, next: RawNode, fallback: string): string {
  const previousEndLine = previous.position?.end?.line;
  const nextStartLine = next.position?.start?.line;

  if (
    typeof previousEndLine !== "number" ||
    typeof nextStartLine !== "number" ||
    !Number.isInteger(previousEndLine) ||
    !Number.isInteger(nextStartLine)
  ) {
    return fallback;
  }

  const lineDelta = nextStartLine - previousEndLine;

  if (lineDelta <= 0) {
    return fallback;
  }

  return "\n".repeat(lineDelta);
}

function createSourceWrapper(rawNodes: RawNode[], gaps: string[]): SourceNode {
  let source = "";

  rawNodes.forEach((node, index) => {
    if (index > 0) {
      source += gaps[index - 1];
    }

    source += node.value;
  });

  return {
    type: "element",
    tagName: "span",
    properties: { className: ["markdown-html-source"] },
    children: [{ type: "text", value: source }]
  };
}
