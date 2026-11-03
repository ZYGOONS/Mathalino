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

export interface TeacherMadeQuestionInput {
  number: number;

  questionType: string;

  firstOperand:
    | number
    | null;

  secondOperand:
    | number
    | null;
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

const SYSTEM_MIN =
  0;

const SYSTEM_MAX =
  50;

const MAX_ATTEMPTS =
  5_000;

function randomInt(
  min: number,
  max: number
): number {
  if (
    max <
    min
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
      items.length -
        1
    );

  return items[
    index
  ];
}

function addition(
  min: number,
  max: number
):
  | QuestionDraft
  | null {
  if (
    min +
      min >
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
    max -
    first;

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
      first +
      second,

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
      first -
      second,

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
):
  | QuestionDraft
  | null {
  const available:
    string[] = [];

  if (
    min <
    max
  ) {
    available.push(
      "greater",
      "smaller",
      "after",
      "before"
    );
  }

  if (
    max -
      min >=
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
      first ===
      second
    ) {
      second =
        second <
        max
          ? second +
            1
          : second -
            1;
    }

    const answer =
      type ===
      "greater"
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
        max -
          1
      );

    return {
      key:
        `after:${value}`,

      prompt:
        `What number comes after ${value}?`,

      answer:
        value +
        1,

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
        min +
          1,
        max
      );

    return {
      key:
        `before:${value}`,

      prompt:
        `What number comes before ${value}?`,

      answer:
        value -
        1,

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
      max -
        2
    );

  return {
    key:
      `missing:${start}`,

    prompt:
      `What is missing: ${start}, __, ${start + 2}?`,

    answer:
      start +
      1,

    first:
      start,

    operator:
      "sequence",

    second:
      start +
      2,

    type:
      "missing",
  };
}

function validateNumberRange(
  activity:
    QuestionActivity
) {
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
}

export function buildTeacherMadeQuestion(
  activity:
    QuestionActivity,
  input:
    TeacherMadeQuestionInput
): GeneratedQuestion {
  validateNumberRange(
    activity
  );

  const topic =
    activity.topic
      .trim()
      .toLowerCase();

  let type =
    input.questionType
      .trim()
      .toLowerCase();

  if (
    topic ===
    "addition"
  ) {
    type =
      "addition";
  }

  if (
    topic ===
    "subtraction"
  ) {
    type =
      "subtraction";
  }

  if (
    topic ===
      "number sense" &&
    ![
      "greater",
      "smaller",
      "after",
      "before",
      "missing",
    ].includes(
      type
    )
  ) {
    throw new Error(
      "Select a valid Number Sense question type."
    );
  }

  if (
    topic !==
      "number sense" &&
    type !==
      topic
  ) {
    throw new Error(
      "Question type does not match the activity topic."
    );
  }

  const first =
    input.firstOperand;

  if (
    first ===
      null ||
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
    first <
      SYSTEM_MIN ||
    first >
      SYSTEM_MAX
  ) {
    throw new Error(
      `First number must be from ${activity.minNumber} to ${activity.maxNumber}.`
    );
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
      ? input.secondOperand
      : null;

  if (
    needsSecond &&
    (
      second ===
        null ||
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
    second !==
      null &&
    (
      second <
        activity.minNumber ||
      second >
        activity.maxNumber ||
      second <
        SYSTEM_MIN ||
      second >
        SYSTEM_MAX
    )
  ) {
    throw new Error(
      `Second number must be from ${activity.minNumber} to ${activity.maxNumber}.`
    );
  }

  let correctAnswer =
    0;

  let operator =
    "";

  let prompt =
    "";

  switch (
    type
  ) {
    case "addition": {
      correctAnswer =
        first +
        (
          second as number
        );

      operator =
        "+";

      prompt =
        `${first} + ${second} = ?`;

      if (
        correctAnswer >
        activity.maxNumber
      ) {
        throw new Error(
          `The answer must not exceed ${activity.maxNumber}.`
        );
      }

      break;
    }

    case "subtraction": {
      if (
        (
          second as number
        ) >
        first
      ) {
        throw new Error(
          "For subtraction, the second number cannot be greater than the first number."
        );
      }

      correctAnswer =
        first -
        (
          second as number
        );

      operator =
        "−";

      prompt =
        `${first} − ${second} = ?`;

      break;
    }

    case "greater": {
      if (
        first ===
        second
      ) {
        throw new Error(
          "Choose two different numbers."
        );
      }

      correctAnswer =
        Math.max(
          first,
          second as number
        );

      operator =
        "greater";

      prompt =
        `Which number is greater: ${first} or ${second}?`;

      break;
    }

    case "smaller": {
      if (
        first ===
        second
      ) {
        throw new Error(
          "Choose two different numbers."
        );
      }

      correctAnswer =
        Math.min(
          first,
          second as number
        );

      operator =
        "smaller";

      prompt =
        `Which number is smaller: ${first} or ${second}?`;

      break;
    }

    case "after": {
      correctAnswer =
        first +
        1;

      if (
        correctAnswer >
        activity.maxNumber
      ) {
        throw new Error(
          `Choose a number below ${activity.maxNumber}.`
        );
      }

      operator =
        "after";

      prompt =
        `What number comes after ${first}?`;

      break;
    }

    case "before": {
      correctAnswer =
        first -
        1;

      if (
        correctAnswer <
        activity.minNumber
      ) {
        throw new Error(
          `Choose a number above ${activity.minNumber}.`
        );
      }

      operator =
        "before";

      prompt =
        `What number comes before ${first}?`;

      break;
    }

    case "missing": {
      if (
        second !==
        first +
          2
      ) {
        throw new Error(
          "For a missing-number question, the last number must be two more than the first."
        );
      }

      correctAnswer =
        first +
        1;

      operator =
        "sequence";

      prompt =
        `What is missing: ${first}, __, ${second}?`;

      break;
    }

    default:
      throw new Error(
        "Unsupported question type."
      );
  }

  if (
    correctAnswer <
      SYSTEM_MIN ||
    correctAnswer >
      SYSTEM_MAX
  ) {
    throw new Error(
      "The answer must be between 0 and 50."
    );
  }

  return {
    number:
      input.number,

    prompt,

    correctAnswer,

    firstOperand:
      first,

    operator,

    secondOperand:
      second,

    questionType:
      type,
  };
}

function rebuildSavedQuestion(
  activity:
    QuestionActivity,
  original:
    GeneratedQuestion
): GeneratedQuestion {
  const rebuilt =
    buildTeacherMadeQuestion(
      activity,
      {
        number:
          original.number,

        questionType:
          original.questionType,

        firstOperand:
          original.firstOperand,

        secondOperand:
          original.secondOperand,
      }
    );

  if (
    original.prompt !==
      rebuilt.prompt ||
    original.correctAnswer !==
      rebuilt.correctAnswer ||
    original.operator !==
      rebuilt.operator
  ) {
    throw new Error(
      "Saved questions no longer match this activity. Regenerate or rebuild the questions first."
    );
  }

  return rebuilt;
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
      requestedCount <
        1 ||
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
          index +
            1
        ) {
          throw new Error(
            "Saved questions no longer match this activity."
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
            "Saved questions no longer match this activity."
          );
        }
      }
    );

    return activity.savedQuestions.slice(
      0,
      requestedCount
    );
  }

  validateNumberRange(
    activity
  );

  if (
    requestedCount <
      1 ||
    requestedCount >
      100
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

    if (
      !draft
    ) {
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
          index +
          1,

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