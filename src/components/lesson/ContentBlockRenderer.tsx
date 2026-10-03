import React from "react";
import { BlockType } from "@prisma/client";
import { TextBlock } from "./blocks/TextBlock";
import { ImageBlock } from "./blocks/ImageBlock";
import { VideoBlock } from "./blocks/VideoBlock";
import { ExampleBlock } from "./blocks/ExampleBlock";
import { QuestionBlock } from "./blocks/QuestionBlock";
import { InteractiveBlock } from "./blocks/InteractiveBlock";
import { HintBlock } from "./blocks/HintBlock";
import { CheckpointBlock } from "./blocks/CheckpointBlock";
import { PracticeBlock } from "./blocks/PracticeBlock";
import { SummaryBlock } from "./blocks/SummaryBlock";

export interface LessonContentBlockData {
  id: string;
  lessonId: string;
  type: BlockType;
  sequenceOrder: number;
  title?: string;
  content: string;
  metadata?: string;
}

export interface ContentBlockRendererProps {
  block: LessonContentBlockData;
  isCompleted?: boolean;
  onComplete?: () => void;
  onAttemptCheckpoint?: (blockId: string, answer: string, isCorrect: boolean, feedback: string) => void;
  previousAttempt?: { answer: string; isCorrect: boolean; feedback?: string };
  onNavigate?: (path: string) => void;
  readOnly?: boolean;
}

export function ContentBlockRenderer({
  block,
  isCompleted,
  onComplete,
  onAttemptCheckpoint,
  previousAttempt,
  onNavigate,
  readOnly = false,
}: ContentBlockRendererProps) {
  switch (block.type) {
    case "TEXT":
      return <TextBlock title={block.title} content={block.content} />;

    case "IMAGE":
      return <ImageBlock title={block.title} content={block.content} metadata={block.metadata} />;

    case "VIDEO":
      return <VideoBlock title={block.title} content={block.content} metadata={block.metadata} />;

    case "EXAMPLE":
      return <ExampleBlock title={block.title} content={block.content} metadata={block.metadata} />;

    case "QUESTION":
      return (
        <QuestionBlock
          blockId={block.id}
          title={block.title}
          content={block.content}
          metadata={block.metadata}
          onAttempt={onAttemptCheckpoint}
          previousAttempt={previousAttempt}
          readOnly={readOnly}
        />
      );

    case "INTERACTIVE":
      return (
        <InteractiveBlock
          title={block.title}
          content={block.content}
          metadata={block.metadata}
          onComplete={onComplete}
          readOnly={readOnly}
        />
      );

    case "HINT":
      return <HintBlock title={block.title} content={block.content} />;

    case "CHECKPOINT":
      return (
        <CheckpointBlock
          blockId={block.id}
          title={block.title}
          content={block.content}
          metadata={block.metadata}
          onAttempt={onAttemptCheckpoint}
          previousAttempt={previousAttempt}
          readOnly={readOnly}
        />
      );

    case "PRACTICE":
      return (
        <PracticeBlock
          title={block.title}
          content={block.content}
          metadata={block.metadata}
          onComplete={onComplete}
          onNavigate={onNavigate}
          readOnly={readOnly}
        />
      );

    case "SUMMARY":
      return <SummaryBlock title={block.title} content={block.content} />;

    default:
      return (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
          Unsupported block type: {block.type}
        </div>
      );
  }
}
