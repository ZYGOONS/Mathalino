export interface GeneratedQuestion {
  number: number;
  prompt: string;
  correctAnswer: number;

  firstOperand:
    | number
    | null;

  operator: string;

  secondOperand:
    | number
    | null;

  questionType: string;
}

export interface QuestionActivity {
  title: string;
  topic: string;
  difficulty: string;

  questionCount: number;
  minNumber: number;
  maxNumber: number;

  savedQuestions:
    GeneratedQuestion[];
}

interface QuestionDraft {
  key: string;
  prompt: string;
  answer: number;

  first:
    | number
    | null;

  operator: string;

  second:
    | number
    | null;

  type: string;
}

const SYSTEM_MIN = 0;
const SYSTEM_MAX = 50;

const MAX_ATTEMPTS =
  5_000;

function randomInt(
  min: number,
  max: number
): number {
  if (
    max < min
  ) {
    throw new Error(
      "Invalid random number range."
    );
  }

  return Math.floor(
    Math.random() *
      (
        max -
        min +
        1
      )
  ) + min;
}

function randomItem<T>(
  items: T[]
): T {
  const index =
    randomInt(
      0,
      items.length - 1
    );

  return items[index];
}

function addition(
  min: number,
  max: number
): QuestionDraft | null {
  if (
    min + min >
    max
  ) {
    return null;
  }

  const first =
    randomInt(
      min,
      max
    );

  const highestSecond =
    max - first;

  if (
    highestSecond <
    min
  ) {
    return null;
  }

  const second =
    randomInt(
      min,
      highestSecond
    );

  return {
    key:
      `addition:${first}:${second}`,

    prompt:
      `${first} + ${second} = ?`,

    answer:
      first + second,

    first,

    operator:
      "+",

    second,

    type:
      "addition",
  };
}

function subtraction(
  min: number,
  max: number
): QuestionDraft {
  const first =
    randomInt(
      min,
      max
    );

  const second =
    randomInt(
      min,
      first
    );

  return {
    key:
      `subtraction:${first}:${second}`,

    prompt:
      `${first} − ${second} = ?`,

    answer:
      first - second,

    first,

    operator:
      "−",

    second,

    type:
      "subtraction",
  };
}

function numberSense(
  min: number,
  max: number
): QuestionDraft | null {
  const available:
    string[] = [];

  if (
    min < max
  ) {
    available.push(
      "greater",
      "smaller",
      "after",
      "before"
    );
  }

  if (
    max - min >=
    2
  ) {
    available.push(
      "missing"
    );
  }

  if (
    available.length ===
    0
  ) {
    return null;
  }

  const type =
    randomItem(
      available
    );

  if (
    type ===
      "greater" ||
    type ===
      "smaller"
  ) {
    const first =
      randomInt(
        min,
        max
      );

    let second =
      randomInt(
        min,
        max
      );

    if (
      first === second
    ) {
      second =
        second < max
          ? second + 1
          : second - 1;
    }

    const greater =
      type ===
      "greater";

    const answer =
      greater
        ? Math.max(
            first,
            second
          )
        : Math.min(
            first,
            second
          );

    const smallest =
      Math.min(
        first,
        second
      );

    const largest =
      Math.max(
        first,
        second
      );

    return {
      key:
        `${type}:${smallest}:${largest}`,

      prompt:
        `Which number is ${type}: ${first} or ${second}?`,

      answer,

      first,

      operator:
        type,

      second,

      type,
    };
  }

  if (
    type ===
    "after"
  ) {
    const value =
      randomInt(
        min,
        max - 1
      );

    return {
      key:
        `after:${value}`,

      prompt:
        `What number comes after ${value}?`,

      answer:
        value + 1,

      first:
        value,

      operator:
        "after",

      second:
        null,

      type:
        "after",
    };
  }

  if (
    type ===
    "before"
  ) {
    const value =
      randomInt(
        min + 1,
        max
      );

    return {
      key:
        `before:${value}`,

      prompt:
        `What number comes before ${value}?`,

      answer:
        value - 1,

      first:
        value,

      operator:
        "before",

      second:
        null,

      type:
        "before",
    };
  }

  const start =
    randomInt(
      min,
      max - 2
    );

  return {
    key:
      `missing:${start}`,

    prompt:
      `What is missing: ${start}, __, ${start + 2}?`,

    answer:
      start + 1,

    first:
      start,

    operator:
      "sequence",

    second:
      start + 2,

    type:
      "missing",
  };
}

function rebuildSavedQuestion(
  activity:
    QuestionActivity,
  original:
    GeneratedQuestion
): GeneratedQuestion {
  const first =
    original.firstOperand;

  if (
    first === null ||
    !Number.isInteger(
      first
    )
  ) {
    throw new Error(
      "Enter the first number."
    );
  }

  if (
    first <
      activity.minNumber ||
    first >
      activity.maxNumber ||
    first < 0 ||
    first > 50
  ) {
    throw new Error(
      "Number is outside the activity range."
    );
  }

  const type =
    original.questionType;

  const topic =
    activity.topic
      .trim()
      .toLowerCase();

  const arithmetic =
    topic ===
      "addition" ||
    topic ===
      "subtraction";

  if (
    arithmetic
  ) {
    if (
      type !== topic
    ) {
      throw new Error(
        "Question type does not match the topic."
      );
    }
  } else {
    const validNumberSense =
      [
        "greater",
        "smaller",
        "after",
        "before",
        "missing",
      ].includes(
        type
      );

    if (
      topic !==
        "number sense" ||
      !validNumberSense
    ) {
      throw new Error(
        "Question type does not match the topic."
      );
    }
  }

  const needsSecond =
    ![
      "after",
      "before",
    ].includes(
      type
    );

  const second =
    needsSecond
      ? original.secondOperand
      : null;

  if (
    needsSecond &&
    (
      second === null ||
      !Number.isInteger(
        second
      )
    )
  ) {
    throw new Error(
      "Enter the second number."
    );
  }

  if (
    second !== null &&
    (
      second <
        activity.minNumber ||
      second >
        activity.maxNumber ||
      second < 0 ||
      second > 50
    )
  ) {
    throw new Error(
      "Number is outside the activity range."
    );
  }

  let expected:
    number;

  switch (
    type
  ) {
    case "addition":
      expected =
        first +
        (
          second as number
        );
      break;

    case "subtraction":
      expected =
        first -
        (
          second as number
        );
      break;

    case "greater":
      expected =
        Math.max(
          first,
          second as number
        );
      break;

    case "smaller":
      expected =
        Math.min(
          first,
          second as number
        );
      break;

    case "after":
    case "missing":
      expected =
        first + 1;
      break;

    default:
      expected =
        first - 1;
  }

  if (
    expected < 0 ||
    expected > 50
  ) {
    throw new Error(
      "Answer must be between 0 and 50."
    );
  }

  if (
    type !==
      "subtraction" &&
    (
      expected <
        activity.minNumber ||
      expected >
        activity.maxNumber
    )
  ) {
    throw new Error(
      "Answer is outside the activity range."
    );
  }

  if (
    type ===
      "missing" &&
    second !==
      first + 2
  ) {
    throw new Error(
      "The last number must be two more than the first."
    );
  }

  if (
    (
      type ===
        "greater" ||
      type ===
        "smaller"
    ) &&
    first ===
      second
  ) {
    throw new Error(
      "Choose two different numbers."
    );
  }

  if (
    original.correctAnswer !==
    expected
  ) {
    throw new Error(
      `The correct answer is ${expected}.`
    );
  }

  let operator =
    type;

  if (
    type ===
    "addition"
  ) {
    operator =
      "+";
  }

  if (
    type ===
    "subtraction"
  ) {
    operator =
      "−";
  }

  if (
    type ===
    "missing"
  ) {
    operator =
      "sequence";
  }

  let prompt =
    "";

  if (
    type ===
      "addition" ||
    type ===
      "subtraction"
  ) {
    prompt =
      `${first} ${operator} ${second} = ?`;
  } else if (
    type ===
      "greater" ||
    type ===
      "smaller"
  ) {
    prompt =
      `Which number is ${type}: ${first} or ${second}?`;
  } else if (
    type ===
      "after" ||
    type ===
      "before"
  ) {
    prompt =
      `What number comes ${type} ${first}?`;
  } else {
    prompt =
      `What is missing: ${first}, __, ${second}?`;
  }

  return {
    ...original,

    prompt,

    correctAnswer:
      expected,

    firstOperand:
      first,

    secondOperand:
      second,

    operator,
  };
}

function sameQuestion(
  first:
    GeneratedQuestion,
  second:
    GeneratedQuestion
): boolean {
  return (
    first.number ===
      second.number &&
    first.prompt ===
      second.prompt &&
    first.correctAnswer ===
      second.correctAnswer &&
    first.firstOperand ===
      second.firstOperand &&
    first.operator ===
      second.operator &&
    first.secondOperand ===
      second.secondOperand &&
    first.questionType ===
      second.questionType
  );
}

export function generateActivityQuestions(
  activity:
    QuestionActivity,
  requestedCount =
    activity.questionCount
): GeneratedQuestion[] {
  /*
   * =========================
   * SAVED QUESTIONS
   * =========================
   */

  if (
    activity.savedQuestions.length >
    0
  ) {
    if (
      activity.savedQuestions.length !==
      activity.questionCount
    ) {
      throw new Error(
        "Question count changed. Regenerate and save the questions first."
      );
    }

    if (
      requestedCount < 1 ||
      requestedCount >
        activity.savedQuestions.length
    ) {
      throw new Error(
        "Invalid requested question count."
      );
    }

    activity.savedQuestions.forEach(
      (
        question,
        index
      ) => {
        if (
          question.number !==
          index + 1
        ) {
          throw new Error(
            "Saved questions no longer match this activity. Regenerate and save them first."
          );
        }

        const rebuilt =
          rebuildSavedQuestion(
            activity,
            question
          );

        if (
          !sameQuestion(
            question,
            rebuilt
          )
        ) {
          throw new Error(
            "Saved questions no longer match this activity. Regenerate and save them first."
          );
        }
      }
    );

    return activity.savedQuestions.slice(
      0,
      requestedCount
    );
  }

  /*
   * =========================
   * GENERATED QUESTIONS
   * =========================
   */

  if (
    activity.minNumber <
      SYSTEM_MIN ||
    activity.minNumber >
      SYSTEM_MAX ||
    activity.maxNumber <
      SYSTEM_MIN ||
    activity.maxNumber >
      SYSTEM_MAX ||
    activity.minNumber >
      activity.maxNumber
  ) {
    throw new Error(
      "The activity number range must be between 0 and 50."
    );
  }

  if (
    requestedCount < 1 ||
    requestedCount > 100
  ) {
    throw new Error(
      "Question count must be between 1 and 100."
    );
  }

  const min =
    activity.minNumber;

  const max =
    activity.maxNumber;

  const unique =
    new Map<
      string,
      QuestionDraft
    >();

  let attempts =
    0;

  while (
    unique.size <
      requestedCount &&
    attempts <
      MAX_ATTEMPTS
  ) {
    attempts +=
      1;

    const topic =
      activity.topic
        .trim()
        .toLowerCase();

    let draft:
      | QuestionDraft
      | null;

    if (
      topic ===
      "addition"
    ) {
      draft =
        addition(
          min,
          max
        );
    } else if (
      topic ===
      "subtraction"
    ) {
      draft =
        subtraction(
          min,
          max
        );
    } else if (
      topic ===
      "number sense"
    ) {
      draft =
        numberSense(
          min,
          max
        );
    } else {
      throw new Error(
        "Select Number Sense, Addition, or Subtraction."
      );
    }

    if (!draft) {
      continue;
    }

    if (
      !unique.has(
        draft.key
      )
    ) {
      unique.set(
        draft.key,
        draft
      );
    }
  }

  if (
    unique.size <
    requestedCount
  ) {
    throw new Error(
      `This range can create only ${unique.size} unique ${activity.topic} questions. Increase the number range or reduce the question count.`
    );
  }

  return Array.from(
    unique.values()
  )
    .slice(
      0,
      requestedCount
    )
    .map(
      (
        question,
        index
      ): GeneratedQuestion => ({
        number:
          index + 1,

        prompt:
          question.prompt,

        correctAnswer:
          question.answer,

        firstOperand:
          question.first,

        operator:
          question.operator,

        secondOperand:
          question.second,

        questionType:
          question.type,
      })
    );
}