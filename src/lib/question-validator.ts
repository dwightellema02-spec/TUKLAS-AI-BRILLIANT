/**
 * Tuklas AI - Dedicated Question Validation Service
 * Server-side deterministic mathematical answer checking, normalization, and feedback.
 */

import { QuestionType } from "@prisma/client";

export interface ValidationResult {
  isCorrect: boolean;
  feedback: string;
  explanation?: string;
  expectedAnswerDisplay?: string;
}

export interface QuestionValidationConfig {
  type: QuestionType;
  prompt: string;
  explanation?: string | null;
  correctFeedback?: string | null;
  incorrectFeedback?: string | null;
  questionData: string | Record<string, any>;
}

export class QuestionValidator {
  /**
   * Main entry point for server-side question validation.
   */
  public static validate(
    config: QuestionValidationConfig,
    studentAnswer: any
  ): ValidationResult {
    let data: any = {};
    if (typeof config.questionData === "string") {
      try {
        data = JSON.parse(config.questionData);
      } catch {
        data = {};
      }
    } else if (config.questionData) {
      data = config.questionData;
    }

    let isCorrect = false;
    let expectedDisplay = "";

    switch (config.type) {
      case "MULTIPLE_CHOICE": {
        const res = this.validateMultipleChoice(data, studentAnswer);
        isCorrect = res.isCorrect;
        expectedDisplay = res.expectedDisplay;
        break;
      }

      case "NUMERIC_INPUT": {
        const res = this.validateNumericInput(data, studentAnswer);
        isCorrect = res.isCorrect;
        expectedDisplay = res.expectedDisplay;
        break;
      }

      case "TEXT_INPUT": {
        const res = this.validateTextInput(data, studentAnswer);
        isCorrect = res.isCorrect;
        expectedDisplay = res.expectedDisplay;
        break;
      }

      case "TRUE_FALSE": {
        const res = this.validateTrueFalse(data, studentAnswer);
        isCorrect = res.isCorrect;
        expectedDisplay = res.expectedDisplay;
        break;
      }

      case "EQUATION": {
        const res = this.validateEquation(data, studentAnswer);
        isCorrect = res.isCorrect;
        expectedDisplay = res.expectedDisplay;
        break;
      }

      case "MATCHING": {
        const res = this.validateMatching(data, studentAnswer);
        isCorrect = res.isCorrect;
        expectedDisplay = res.expectedDisplay;
        break;
      }

      case "ORDERING": {
        const res = this.validateOrdering(data, studentAnswer);
        isCorrect = res.isCorrect;
        expectedDisplay = res.expectedDisplay;
        break;
      }

      default: {
        // Fallback for future/unimplemented question types
        const expected = String(data.correctAnswer ?? "").trim();
        const submitted = String(studentAnswer ?? "").trim();
        isCorrect = expected.toLowerCase() === submitted.toLowerCase();
        expectedDisplay = expected;
      }
    }

    const defaultCorrectFeedback = "Correct! Well done.";
    const defaultIncorrectFeedback = "Not quite. Check your steps and try again.";

    return {
      isCorrect,
      feedback: isCorrect
        ? config.correctFeedback || defaultCorrectFeedback
        : config.incorrectFeedback || defaultIncorrectFeedback,
      explanation: config.explanation || undefined,
      expectedAnswerDisplay: expectedDisplay,
    };
  }

  // 1. MULTIPLE CHOICE
  public static validateMultipleChoice(
    data: any,
    studentAnswer: any
  ): { isCorrect: boolean; expectedDisplay: string } {
    const rawExpected = data.correctAnswer;
    const choices = Array.isArray(data.choices) ? data.choices : [];
    
    // Normalization: studentAnswer might be choice ID or index or choice text
    const submitted = String(studentAnswer ?? "").trim();
    const expected = String(rawExpected ?? "").trim();

    let isCorrect = submitted.toLowerCase() === expected.toLowerCase();

    // Check if expected matches an option ID or text
    if (!isCorrect && choices.length > 0) {
      const matchChoice = choices.find(
        (c: any) =>
          c.id === expected ||
          c.text?.trim().toLowerCase() === expected.toLowerCase()
      );
      if (matchChoice) {
        isCorrect =
          submitted.toLowerCase() === matchChoice.id?.toLowerCase() ||
          submitted.toLowerCase() === matchChoice.text?.trim().toLowerCase();
      }
    }

    // Expected answer display string
    let expectedDisplay = expected;
    const found = choices.find((c: any) => c.id === expected);
    if (found && found.text) {
      expectedDisplay = found.text;
    }

    return { isCorrect, expectedDisplay };
  }

  // 2. NUMERIC INPUT
  public static validateNumericInput(
    data: any,
    studentAnswer: any
  ): { isCorrect: boolean; expectedDisplay: string } {
    if (studentAnswer === undefined || studentAnswer === null || studentAnswer === "") {
      return { isCorrect: false, expectedDisplay: String(data.correctAnswer ?? "") };
    }

    const expectedStr = String(data.correctAnswer ?? "").trim();
    const submittedStr = String(studentAnswer).trim();

    const expectedNum = parseFloat(expectedStr);
    const submittedNum = parseFloat(submittedStr);

    if (isNaN(expectedNum) || isNaN(submittedNum)) {
      return {
        isCorrect: expectedStr.toLowerCase() === submittedStr.toLowerCase(),
        expectedDisplay: expectedStr,
      };
    }

    const tolerance = typeof data.tolerance === "number" ? Math.abs(data.tolerance) : 0;

    let isCorrect = false;
    if (tolerance > 0) {
      isCorrect = Math.abs(submittedNum - expectedNum) <= tolerance;
    } else {
      isCorrect = submittedNum === expectedNum;
    }

    return { isCorrect, expectedDisplay: expectedStr };
  }

  // 3. TEXT INPUT
  public static validateTextInput(
    data: any,
    studentAnswer: any
  ): { isCorrect: boolean; expectedDisplay: string } {
    const submitted = String(studentAnswer ?? "");
    const caseSensitive = Boolean(data.caseSensitive);
    const trimWhitespace = data.trimWhitespace !== false;
    const normalizeSpaces = data.normalizeSpaces !== false;

    const normalize = (str: string): string => {
      let s = str;
      if (trimWhitespace) s = s.trim();
      if (normalizeSpaces) s = s.replace(/\s+/g, " ");
      if (!caseSensitive) s = s.toLowerCase();
      return s;
    };

    const targetList: string[] = [];
    if (data.correctAnswer !== undefined) {
      targetList.push(String(data.correctAnswer));
    }
    if (Array.isArray(data.acceptableAnswers)) {
      data.acceptableAnswers.forEach((a: any) => targetList.push(String(a)));
    }

    const normalizedSubmitted = normalize(submitted);
    const isCorrect = targetList.some((target) => normalize(target) === normalizedSubmitted);

    return {
      isCorrect,
      expectedDisplay: String(data.correctAnswer ?? targetList[0] ?? ""),
    };
  }

  // 4. TRUE / FALSE
  public static validateTrueFalse(
    data: any,
    studentAnswer: any
  ): { isCorrect: boolean; expectedDisplay: string } {
    const normalizeBool = (val: any): boolean | null => {
      if (typeof val === "boolean") return val;
      const s = String(val).trim().toLowerCase();
      if (s === "true" || s === "t" || s === "1" || s === "yes") return true;
      if (s === "false" || s === "f" || s === "0" || s === "no") return false;
      return null;
    };

    const expectedBool = normalizeBool(data.correctAnswer);
    const submittedBool = normalizeBool(studentAnswer);

    const isCorrect = expectedBool !== null && expectedBool === submittedBool;
    const expectedDisplay = expectedBool !== null ? (expectedBool ? "True" : "False") : "";

    return { isCorrect, expectedDisplay };
  }

  // 5. EQUATION
  public static validateEquation(
    data: any,
    studentAnswer: any
  ): { isCorrect: boolean; expectedDisplay: string } {
    const submitted = String(studentAnswer ?? "").trim();
    const expected = String(data.correctAnswer ?? "").trim();

    const normalizeEq = (eq: string): string => {
      return eq
        .toLowerCase()
        .replace(/\s+/g, "") // remove all spaces
        .replace(/^\+/, ""); // remove leading +
    };

    const normSub = normalizeEq(submitted);
    const normExp = normalizeEq(expected);

    let isCorrect = normSub === normExp;

    // Check variable flipped: e.g. "x=7" vs "7=x"
    if (!isCorrect && normExp.includes("=")) {
      const [expL, expR] = normExp.split("=");
      const flippedExp = `${expR}=${expL}`;
      if (normSub === flippedExp) {
        isCorrect = true;
      }
      // Also allow just the numeric value if e.g. prompt was "Solve for x:"
      if (!isCorrect && (normSub === expL || normSub === expR)) {
        isCorrect = true;
      }
    }

    // Check acceptable answers if configured
    if (!isCorrect && Array.isArray(data.acceptableAnswers)) {
      isCorrect = data.acceptableAnswers.some(
        (acc: string) => normalizeEq(acc) === normSub
      );
    }

    return { isCorrect, expectedDisplay: expected };
  }

  // 6. MATCHING
  public static validateMatching(
    data: any,
    studentAnswer: any
  ): { isCorrect: boolean; expectedDisplay: string } {
    // Expected pairs: array of { left: string, right: string } or object { [left]: right }
    const pairs: { left: string; right: string }[] = [];
    if (Array.isArray(data.matchingPairs)) {
      data.matchingPairs.forEach((p: any) => {
        pairs.push({ left: String(p.left).trim(), right: String(p.right).trim() });
      });
    } else if (data.matchingPairs && typeof data.matchingPairs === "object") {
      Object.entries(data.matchingPairs).forEach(([k, v]) => {
        pairs.push({ left: String(k).trim(), right: String(v).trim() });
      });
    }

    if (pairs.length === 0) {
      return { isCorrect: false, expectedDisplay: "No matching pairs configured" };
    }

    // Student answer can be object { [left]: right } or array of { left, right }
    let submittedMap: Record<string, string> = {};
    if (Array.isArray(studentAnswer)) {
      studentAnswer.forEach((p: any) => {
        if (p && p.left !== undefined) {
          submittedMap[String(p.left).trim()] = String(p.right ?? "").trim();
        }
      });
    } else if (studentAnswer && typeof studentAnswer === "object") {
      Object.entries(studentAnswer).forEach(([k, v]) => {
        submittedMap[String(k).trim()] = String(v ?? "").trim();
      });
    }

    let isCorrect = true;
    for (const pair of pairs) {
      const match = submittedMap[pair.left];
      if (
        !match ||
        match.toLowerCase().trim() !== pair.right.toLowerCase().trim()
      ) {
        isCorrect = false;
        break;
      }
    }

    const expectedDisplay = pairs.map((p) => `${p.left} → ${p.right}`).join(", ");
    return { isCorrect, expectedDisplay };
  }

  // 7. ORDERING
  public static validateOrdering(
    data: any,
    studentAnswer: any
  ): { isCorrect: boolean; expectedDisplay: string } {
    // Expected order: array of strings/numbers
    const expectedList: string[] = Array.isArray(data.orderingItems)
      ? data.orderingItems.map((item: any) => String(item).trim())
      : [];

    if (expectedList.length === 0) {
      return { isCorrect: false, expectedDisplay: "No ordering items configured" };
    }

    const submittedList: string[] = Array.isArray(studentAnswer)
      ? studentAnswer.map((item: any) => String(item).trim())
      : [];

    if (submittedList.length !== expectedList.length) {
      return {
        isCorrect: false,
        expectedDisplay: expectedList.join(", "),
      };
    }

    let isCorrect = true;
    for (let i = 0; i < expectedList.length; i++) {
      if (
        submittedList[i].toLowerCase() !== expectedList[i].toLowerCase()
      ) {
        isCorrect = false;
        break;
      }
    }

    return {
      isCorrect,
      expectedDisplay: expectedList.join(", "),
    };
  }

  /**
   * Helper to redact sensitive answers before sending questions to students
   */
  public static redactQuestionForStudent(question: any): any {
    if (!question) return question;
    const cloned = { ...question };
    let qData: any = {};
    if (typeof cloned.questionData === "string") {
      try {
        qData = JSON.parse(cloned.questionData);
      } catch {
        qData = {};
      }
    } else if (cloned.questionData) {
      qData = { ...cloned.questionData };
    }

    // Strip answer keys from qData
    const sanitizedData = { ...qData };
    delete sanitizedData.correctAnswer;
    delete sanitizedData.acceptableAnswers;

    // For matching, provide left and shuffled rights without mapping
    if (Array.isArray(sanitizedData.matchingPairs)) {
      sanitizedData.leftItems = sanitizedData.matchingPairs.map((p: any) => p.left);
      sanitizedData.rightOptions = [...sanitizedData.matchingPairs.map((p: any) => p.right)].sort(
        () => Math.random() - 0.5
      );
      delete sanitizedData.matchingPairs;
    }

    // For ordering, provide initial shuffled items
    if (Array.isArray(sanitizedData.orderingItems)) {
      sanitizedData.itemsToOrder = [...sanitizedData.orderingItems].sort(
        () => Math.random() - 0.5
      );
      delete sanitizedData.orderingItems;
    }

    // Hide answers from choices
    if (Array.isArray(sanitizedData.choices)) {
      sanitizedData.choices = sanitizedData.choices.map((c: any) => ({
        id: c.id,
        text: c.text,
      }));
    }

    cloned.questionData = JSON.stringify(sanitizedData);
    delete cloned.explanation;
    return cloned;
  }
}
