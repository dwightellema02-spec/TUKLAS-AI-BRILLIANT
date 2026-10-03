import React from "react";
import { QuestionType } from "@prisma/client";
import { MathText } from "@/components/ui/MathText";
import { MultipleChoiceQuestion } from "./MultipleChoiceQuestion";
import { NumericInputQuestion } from "./NumericInputQuestion";
import { TextInputQuestion } from "./TextInputQuestion";
import { TrueFalseQuestion } from "./TrueFalseQuestion";
import { EquationQuestion } from "./EquationQuestion";
import { MatchingQuestion } from "./MatchingQuestion";
import { OrderingQuestion } from "./OrderingQuestion";

export interface QuestionRendererProps {
  question: {
    id: string;
    type: QuestionType;
    prompt: string;
    questionData?: string | Record<string, any>;
  };
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
}

export function QuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
}: QuestionRendererProps) {
  let parsedData: any = {};
  if (typeof question.questionData === "string") {
    try {
      parsedData = JSON.parse(question.questionData);
    } catch {
      parsedData = {};
    }
  } else if (question.questionData) {
    parsedData = question.questionData;
  }

  const renderInput = () => {
    switch (question.type) {
      case "MULTIPLE_CHOICE": {
        const choices = parsedData.choices || [];
        return (
          <MultipleChoiceQuestion
            choices={choices}
            value={value || ""}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }

      case "NUMERIC_INPUT": {
        return (
          <NumericInputQuestion
            value={value ?? ""}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }

      case "TEXT_INPUT": {
        return (
          <TextInputQuestion
            value={value ?? ""}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }

      case "TRUE_FALSE": {
        return (
          <TrueFalseQuestion
            value={typeof value === "boolean" ? value : null}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }

      case "EQUATION": {
        return (
          <EquationQuestion
            value={value ?? ""}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }

      case "MATCHING": {
        const leftItems = parsedData.leftItems || (parsedData.matchingPairs ? parsedData.matchingPairs.map((p: any) => p.left) : []);
        const rightOptions = parsedData.rightOptions || (parsedData.matchingPairs ? parsedData.matchingPairs.map((p: any) => p.right) : []);
        return (
          <MatchingQuestion
            leftItems={leftItems}
            rightOptions={rightOptions}
            value={value || {}}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }

      case "ORDERING": {
        const items = parsedData.itemsToOrder || parsedData.orderingItems || [];
        return (
          <OrderingQuestion
            items={items}
            value={Array.isArray(value) ? value : items}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }

      default:
        return (
          <TextInputQuestion
            value={value ?? ""}
            onChange={onChange}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Prompt Card */}
      <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
        <MathText content={question.prompt} />
      </div>

      {/* Answer Input */}
      <div>{renderInput()}</div>
    </div>
  );
}
