import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

interface AssignmentRecord {
  id: string;

  teacherId: string;
  learnerId: string;

  activityId: string;
  activityTitle: string;

  topic: string;
  difficulty: string;

  minNumber: number;
  maxNumber: number;

  status: string;

  score: number | null;
  totalQuestions: number | null;
  masteryPercent: number | null;

  completedAt: Timestamp | null;
}

interface SessionResponse {
  questionNumber: number;
  attemptCount: number;
  isCorrect: boolean | null;
}

interface RecommendationDraft {
  sourceAssignmentId: string;

  topic: string;

  masteryPercent: number;
  masteryLevel: string;

  currentDifficulty: string;
  currentMinNumber: number;
  currentMaxNumber: number;

  recommendedDifficulty: string;
  recommendedMinNumber: number;
  recommendedMaxNumber: number;

  reason: string;
}

interface PreviewQuestion {
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

interface AttemptEvidence {
  text: string;

  firstAttemptPercent:
    | number
    | null;
}

const SUPPORTED_TOPICS = [
  "Number Sense",
  "Addition",
  "Subtraction",
];

const MAX_GENERATION_ATTEMPTS =
  5_000;

/*
 * =========================
 * ASSIGNMENT HELPERS
 * =========================
 */

function toNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function assignmentFromSnapshot(
  snapshot: {
    id: string;

    data: () =>
      DocumentData;
  }
): AssignmentRecord {
  const data =
    snapshot.data();

  return {
    id:
      snapshot.id,

    teacherId:
      data.teacherId ??
      "",

    learnerId:
      data.learnerId ??
      "",

    activityId:
      data.activityId ??
      "",

    activityTitle:
      data.activityTitle ??
      "",

    topic:
      data.topic ??
      "",

    difficulty:
      data.difficulty ??
      "easy",

    minNumber:
      Number(
        data.minNumber ??
          0
      ),

    maxNumber:
      Number(
        data.maxNumber ??
          10
      ),

    status:
      data.status ??
      "",

    score:
      toNullableNumber(
        data.score
      ),

    totalQuestions:
      toNullableNumber(
        data.totalQuestions
      ),

    masteryPercent:
      toNullableNumber(
        data.masteryPercent
      ),

    completedAt:
      data.completedAt ??
      null,
  };
}

function validCompletedResult(
  assignmentId: string,
  score: number,
  totalQuestions: number
): boolean {
  return (
    assignmentId.trim().length >
      0 &&
    Number.isInteger(
      score
    ) &&
    Number.isInteger(
      totalQuestions
    ) &&
    totalQuestions >
      0 &&
    score >=
      0 &&
    score <=
      totalQuestions
  );
}

/*
 * =========================
 * PERFORMANCE
 * =========================
 */

function masteryLevel(
  percentage: number
): string {
  if (
    percentage <
    60
  ) {
    return "Low";
  }

  if (
    percentage <
    80
  ) {
    return "Developing";
  }

  return "High";
}

function normalizeDifficulty(
  value: string
): string {
  switch (
    value
      .trim()
      .toLowerCase()
  ) {
    case "average":
      return "average";

    case "difficult":
      return "difficult";

    default:
      return "easy";
  }
}

function previousDifficulty(
  value: string
): string {
  if (
    value ===
    "difficult"
  ) {
    return "average";
  }

  return "easy";
}

function nextDifficulty(
  value: string
): string {
  if (
    value ===
    "easy"
  ) {
    return "average";
  }

  if (
    value ===
    "average"
  ) {
    return "difficult";
  }

  return "difficult";
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    Math.max(
      value,
      minimum
    ),
    maximum
  );
}

function timestampCompare(
  first:
    Timestamp | null,
  second:
    Timestamp | null
): number {
  const firstSeconds =
    first?.seconds ??
    0;

  const secondSeconds =
    second?.seconds ??
    0;

  if (
    firstSeconds !==
    secondSeconds
  ) {
    return (
      firstSeconds -
      secondSeconds
    );
  }

  const firstNanos =
    first?.nanoseconds ??
    0;

  const secondNanos =
    second?.nanoseconds ??
    0;

  return (
    firstNanos -
    secondNanos
  );
}

function topicAverage(
  assignments:
    AssignmentRecord[],
  topic: string
): number | null {
  const records =
    assignments.filter(
      (
        assignment
      ) =>
        assignment.status.toLowerCase() ===
          "completed" &&
        assignment.masteryPercent !==
          null &&
        assignment.topic.toLowerCase() ===
          topic.toLowerCase()
    );

  if (
    records.length ===
    0
  ) {
    return null;
  }

  const total =
    records.reduce(
      (
        sum,
        assignment
      ) =>
        sum +
        (
          assignment.masteryPercent ??
          0
        ),
      0
    );

  return Math.round(
    total /
      records.length
  );
}

/*
 * =========================
 * RECOMMENDATION ENGINE
 * =========================
 */

function recommendedRange(
  source:
    AssignmentRecord,
  difficulty:
    string,
  mastery:
    number
): [
  number,
  number,
] {
  const defaultMaximum =
    difficulty ===
    "average"
      ? 20
      : difficulty ===
          "difficult"
        ? 50
        : 10;

  if (
    mastery <
    60
  ) {
    return [
      0,

      Math.min(
        clamp(
          source.maxNumber,
          1,
          50
        ),
        defaultMaximum
      ),
    ];
  }

  if (
    mastery <
    80
  ) {
    return [
      clamp(
        source.minNumber,
        0,
        50
      ),

      clamp(
        source.maxNumber,
        0,
        50
      ),
    ];
  }

  return [
    0,

    Math.min(
      Math.max(
        clamp(
          source.maxNumber,
          1,
          50
        ),
        defaultMaximum
      ),
      50
    ),
  ];
}

function buildRecommendation(
  assignments:
    AssignmentRecord[],
  firstAttemptPercent:
    number | null
): RecommendationDraft | null {
  const completed =
    assignments
      .filter(
        (
          assignment
        ) =>
          assignment.status.toLowerCase() ===
            "completed" &&
          assignment.masteryPercent !==
            null
      )
      .sort(
        (
          first,
          second
        ) =>
          timestampCompare(
            second.completedAt,
            first.completedAt
          )
      );

  if (
    completed.length ===
    0
  ) {
    return null;
  }

  let weakestTopic:
    string | null =
    null;

  let weakestPercentage:
    number | null =
    null;

  /*
   * Android uses this order for
   * supported topics.
   */
  for (
    const topic
    of SUPPORTED_TOPICS
  ) {
    const percentage =
      topicAverage(
        completed,
        topic
      );

    if (
      percentage ===
      null
    ) {
      continue;
    }

    if (
      weakestPercentage ===
        null ||
      percentage <
        weakestPercentage
    ) {
      weakestTopic =
        topic;

      weakestPercentage =
        percentage;
    }
  }

  if (
    weakestTopic ===
      null ||
    weakestPercentage ===
      null
  ) {
    return null;
  }

  const candidates =
    completed.filter(
      (
        assignment
      ) =>
        assignment.topic.toLowerCase() ===
        weakestTopic?.toLowerCase()
    );

  let source =
    candidates[0];

  for (
    const candidate
    of candidates.slice(
      1
    )
  ) {
    const comparison =
      timestampCompare(
        candidate.completedAt,
        source.completedAt
      );

    if (
      comparison >
        0 ||
      (
        comparison ===
          0 &&
        candidate.id >
          source.id
      )
    ) {
      source =
        candidate;
    }
  }

  const current =
    normalizeDifficulty(
      source.difficulty
    );

  const mastery =
    weakestPercentage;

  const evidenceMap =
    new Map<
      string,
      AssignmentRecord
    >();

  for (
    const assignment
    of completed
  ) {
    if (
      assignment.topic.toLowerCase() !==
        source.topic.toLowerCase() ||
      normalizeDifficulty(
        assignment.difficulty
      ) !== current
    ) {
      continue;
    }

    if (
      assignment.totalQuestions ===
        null ||
      assignment.totalQuestions <=
        0 ||
      assignment.score ===
        null ||
      assignment.score <
        0 ||
      assignment.score >
        assignment.totalQuestions
    ) {
      continue;
    }

    evidenceMap.set(
      assignment.id,
      assignment
    );
  }

  const evidence =
    Array.from(
      evidenceMap.values()
    );

  const evidenceQuestions =
    evidence.reduce(
      (
        total,
        assignment
      ) =>
        total +
        (
          assignment.totalQuestions ??
          0
        ),
      0
    );

  const enoughPractice =
    evidence.length >=
      2 &&
    evidenceQuestions >=
      10 &&
    (
      source.totalQuestions ??
      0
    ) >=
      5;

  const canAdvance =
    enoughPractice &&
    firstAttemptPercent !==
      null &&
    firstAttemptPercent >=
      80 &&
    firstAttemptPercent <=
      100;

  const holdHigh =
    mastery >=
      80 &&
    !canAdvance;

  const level =
    masteryLevel(
      mastery
    );

  let recommended =
    current;

  if (
    level ===
    "Low"
  ) {
    recommended =
      previousDifficulty(
        current
      );
  } else if (
    level ===
    "High"
  ) {
    recommended =
      canAdvance
        ? nextDifficulty(
            current
          )
        : current;
  }

  let range:
    [
      number,
      number,
    ];

  if (holdHigh) {
    const minimum =
      clamp(
        source.minNumber,
        0,
        50
      );

    range = [
      minimum,

      clamp(
        source.maxNumber,
        minimum,
        50
      ),
    ];
  } else {
    range =
      recommendedRange(
        source,
        recommended,
        mastery
      );
  }

  let reason:
    string;

  if (
    level ===
    "Low"
  ) {
    reason =
      `Reinforce ${weakestTopic} with a smaller range and simpler practice.`;
  } else if (
    level ===
    "Developing"
  ) {
    reason =
      `Continue ${weakestTopic} at the current level to build consistency.`;
  } else if (
    holdHigh
  ) {
    let detail:
      string;

    if (
      !enoughPractice
    ) {
      detail =
        "More evidence is needed: at least two completed activities and ten scored questions at this difficulty, with at least five questions in the latest activity.";
    } else if (
      firstAttemptPercent ===
      null
    ) {
      detail =
        "Complete first-attempt records are unavailable; a high final score alone is not enough to increase difficulty.";
    } else {
      detail =
        `Latest-session first-attempt accuracy is ${firstAttemptPercent}%; aim for at least 80% before increasing difficulty.`;
    }

    reason =
      `Continue ${weakestTopic} at the current difficulty and number range. ${detail}`;
  } else if (
    recommended ===
    current
  ) {
    reason =
      `Provide more varied ${weakestTopic} practice within the 0–50 limit.`;
  } else {
    reason =
      `Increase the challenge after strong performance in ${weakestTopic}.`;
  }

  return {
    sourceAssignmentId:
      source.id,

    topic:
      weakestTopic,

    masteryPercent:
      mastery,

    masteryLevel:
      level,

    currentDifficulty:
      current,

    currentMinNumber:
      clamp(
        source.minNumber,
        0,
        50
      ),

    currentMaxNumber:
      clamp(
        source.maxNumber,
        0,
        50
      ),

    recommendedDifficulty:
      recommended,

    recommendedMinNumber:
      range[0],

    recommendedMaxNumber:
      range[1],

    reason,
  };
}

/*
 * =========================
 * ATTEMPT EVIDENCE
 * =========================
 */

function validResponses(
  responses:
    SessionResponse[],
  total: number
): boolean {
  if (
    total <=
      0 ||
    responses.length !==
      total
  ) {
    return false;
  }

  const numbers =
    new Set(
      responses.map(
        (
          response
        ) =>
          response.questionNumber
      )
    );

  if (
    numbers.size !==
    responses.length
  ) {
    return false;
  }

  return responses.every(
    (
      response
    ) =>
      response.questionNumber >=
        1 &&
      response.questionNumber <=
        total &&
      response.attemptCount >=
        1 &&
      response.attemptCount <=
        3 &&
      typeof response.isCorrect ===
        "boolean"
  );
}

function firstAttemptPercent(
  responses:
    SessionResponse[],
  total: number
): number | null {
  if (
    !validResponses(
      responses,
      total
    )
  ) {
    return null;
  }

  const firstAttemptCorrect =
    responses.filter(
      (
        response
      ) =>
        response.attemptCount ===
          1 &&
        response.isCorrect ===
          true
    ).length;

  return Math.trunc(
    (
      firstAttemptCorrect *
      100
    ) /
      total
  );
}

function attemptEvidenceText(
  responses:
    SessionResponse[],
  total: number
): string {
  if (
    !validResponses(
      responses,
      total
    )
  ) {
    return "Latest source session: attempt details unavailable or incomplete.";
  }

  const multipleAttempts =
    responses.filter(
      (
        response
      ) =>
        response.attemptCount >
        1
    ).length;

  const firstAttemptCorrect =
    responses.filter(
      (
        response
      ) =>
        response.attemptCount ===
          1 &&
        response.isCorrect ===
          true
    ).length;

  return `Latest source session: ${multipleAttempts} of ${total} questions needed multiple attempts; ${firstAttemptCorrect} were correct on the first attempt.`;
}

function scoreEvidence(
  topic: string,
  assignments:
    AssignmentRecord[]
): string {
  const scored =
    assignments.filter(
      (
        assignment
      ) =>
        assignment.status ===
          "completed" &&
        assignment.topic.toLowerCase() ===
          topic.toLowerCase() &&
        assignment.totalQuestions !==
          null &&
        assignment.totalQuestions >
          0 &&
        assignment.score !==
          null &&
        assignment.score >=
          0 &&
        assignment.score <=
          assignment.totalQuestions
    );

  if (
    scored.length ===
    0
  ) {
    return `${topic}: scored question totals unavailable.`;
  }

  const score =
    scored.reduce(
      (
        total,
        assignment
      ) =>
        total +
        (
          assignment.score ??
          0
        ),
      0
    );

  const questions =
    scored.reduce(
      (
        total,
        assignment
      ) =>
        total +
        (
          assignment.totalQuestions ??
          0
        ),
      0
    );

  return `${topic}: ${score} of ${questions} questions answered correctly across ${scored.length} completed activities. Correct includes answers reached after retries.`;
}

async function loadAttemptEvidence(
  teacherId: string,
  learnerId: string,
  assignmentId: string
): Promise<AttemptEvidence> {
  const sessionsSnapshot =
    await getDocsFromServer(
      query(
        collection(
          db,
          "liveSessions"
        ),
        where(
          "teacherId",
          "==",
          teacherId
        )
      )
    );

  let latest:
    | {
        id: string;
        endedAt:
          | Timestamp
          | null;
        totalQuestions:
          number;
      }
    | null =
    null;

  for (
    const sessionDocument
    of sessionsSnapshot.docs
  ) {
    const data =
      sessionDocument.data();

    if (
      data.learnerId !==
        learnerId ||
      data.assignmentId !==
        assignmentId ||
      data.status !==
        "completed"
    ) {
      continue;
    }

    const endedAt:
      | Timestamp
      | null =
      data.endedAt ??
      null;

    const candidate = {
      id:
        sessionDocument.id,

      endedAt,

      totalQuestions:
        Number(
          data.totalQuestions ??
            0
        ),
    };

    if (
      !latest ||
      (
        endedAt?.seconds ??
        0
      ) >
        (
          latest.endedAt
            ?.seconds ??
          0
        )
    ) {
      latest =
        candidate;
    }
  }

  if (!latest) {
    return {
      text:
        "Latest source session: attempt details unavailable.",

      firstAttemptPercent:
        null,
    };
  }

  const responsesSnapshot =
    await getDocsFromServer(
      query(
        collection(
          db,
          "liveSessions",
          latest.id,
          "responses"
        ),
        where(
          "sessionId",
          "==",
          latest.id
        )
      )
    );

  const responses:
    SessionResponse[] =
    responsesSnapshot.docs.map(
      (
        responseDocument
      ) => {
        const data =
          responseDocument.data();

        return {
          questionNumber:
            Number(
              data.questionNumber ??
                0
            ),

          attemptCount:
            Number(
              data.attemptCount ??
                0
            ),

          isCorrect:
            typeof data.isCorrect ===
            "boolean"
              ? data.isCorrect
              : null,
        };
      }
    );

  return {
    text:
      attemptEvidenceText(
        responses,
        latest.totalQuestions
      ),

    firstAttemptPercent:
      firstAttemptPercent(
        responses,
        latest.totalQuestions
      ),
  };
}

/*
 * =========================
 * DETERMINISTIC PREVIEW
 * =========================
 */

function javaStringHash(
  text: string
): number {
  let hash =
    0;

  for (
    let index =
      0;
    index <
    text.length;
    index +=
      1
  ) {
    hash =
      (
        Math.imul(
          hash,
          31
        ) +
        text.charCodeAt(
          index
        )
      ) |
      0;
  }

  return hash;
}

function seededRandom(
  seed: number
): () => number {
  let value =
    seed >>> 0;

  return () => {
    value +=
      0x6d2b79f5;

    let result =
      value;

    result =
      Math.imul(
        result ^
          (
            result >>>
            15
          ),
        result |
          1
      );

    result ^=
      result +
      Math.imul(
        result ^
          (
            result >>>
            7
          ),
        result |
          61
      );

    return (
      (
        result ^
        (
          result >>>
          14
        )
      ) >>>
      0
    ) /
      4294967296;
  };
}

function randomInteger(
  minimum: number,
  maximum: number,
  random:
    () => number
): number {
  return Math.floor(
    random() *
      (
        maximum -
        minimum +
        1
      )
  ) +
    minimum;
}

function difficultyMaximum(
  difficulty: string
): number {
  switch (
    difficulty
      .trim()
      .toLowerCase()
  ) {
    case "average":
      return 20;

    case "difficult":
      return 50;

    default:
      return 10;
  }
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

function generateAddition(
  minimum: number,
  maximum: number,
  random:
    () => number
): QuestionDraft | null {
  if (
    minimum +
      minimum >
    maximum
  ) {
    return null;
  }

  const first =
    randomInteger(
      minimum,
      maximum,
      random
    );

  const highestSecond =
    maximum -
    first;

  if (
    highestSecond <
    minimum
  ) {
    return null;
  }

  const second =
    randomInteger(
      minimum,
      highestSecond,
      random
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

function generateSubtraction(
  minimum: number,
  maximum: number,
  random:
    () => number
): QuestionDraft {
  const first =
    randomInteger(
      minimum,
      maximum,
      random
    );

  const second =
    randomInteger(
      minimum,
      first,
      random
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

function generateNumberSense(
  minimum: number,
  maximum: number,
  random:
    () => number
): QuestionDraft | null {
  const available:
    string[] = [];

  if (
    minimum <
    maximum
  ) {
    available.push(
      "greater",
      "smaller",
      "after",
      "before"
    );
  }

  if (
    maximum -
      minimum >=
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
    available[
      randomInteger(
        0,
        available.length -
          1,
        random
      )
    ];

  if (
    type ===
      "greater" ||
    type ===
      "smaller"
  ) {
    const first =
      randomInteger(
        minimum,
        maximum,
        random
      );

    let second =
      randomInteger(
        minimum,
        maximum,
        random
      );

    if (
      first ===
      second
    ) {
      second =
        second <
        maximum
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

    return {
      key:
        `${type}:${Math.min(first, second)}:${Math.max(first, second)}`,

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
      randomInteger(
        minimum,
        maximum -
          1,
        random
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
      randomInteger(
        minimum +
          1,
        maximum,
        random
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
    randomInteger(
      minimum,
      maximum -
        2,
      random
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

function createPreviewQuestions(
  topic: string,
  difficulty: string,
  source:
    AssignmentRecord
): PreviewQuestion[] {
  if (
    source.status !==
      "completed" ||
    source.topic.toLowerCase() !==
      topic.toLowerCase()
  ) {
    throw new Error(
      "Completed topic activity required."
    );
  }

  const count =
    source.totalQuestions;

  if (
    count ===
      null ||
    count <
      1 ||
    count >
      100
  ) {
    throw new Error(
      "Source question count must be between 1 and 100."
    );
  }

  const minimum =
    0;

  const maximum =
    difficultyMaximum(
      difficulty
    );

  const random =
    seededRandom(
      javaStringHash(
        source.id
      )
    );

  const questions =
    new Map<
      string,
      QuestionDraft
    >();

  let attempts =
    0;

  while (
    questions.size <
      count &&
    attempts <
      MAX_GENERATION_ATTEMPTS
  ) {
    attempts +=
      1;

    let draft:
      | QuestionDraft
      | null;

    const normalizedTopic =
      topic
        .trim()
        .toLowerCase();

    if (
      normalizedTopic ===
      "addition"
    ) {
      draft =
        generateAddition(
          minimum,
          maximum,
          random
        );
    } else if (
      normalizedTopic ===
      "subtraction"
    ) {
      draft =
        generateSubtraction(
          minimum,
          maximum,
          random
        );
    } else if (
      normalizedTopic ===
      "number sense"
    ) {
      draft =
        generateNumberSense(
          minimum,
          maximum,
          random
        );
    } else {
      throw new Error(
        "Unsupported recommendation topic."
      );
    }

    if (
      draft &&
      !questions.has(
        draft.key
      )
    ) {
      questions.set(
        draft.key,
        draft
      );
    }
  }

  if (
    questions.size <
    count
  ) {
    throw new Error(
      "Could not create enough unique recommendation questions."
    );
  }

  return Array.from(
    questions.values()
  )
    .slice(
      0,
      count
    )
    .map(
      (
        question,
        index
      ) => ({
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

function recommendationTopicId(
  topic: string
): string {
  switch (
    topic
  ) {
    case "Addition":
      return "addition";

    case "Subtraction":
      return "subtraction";

    case "Number Sense":
      return "number_sense";

    default:
      throw new Error(
        "Unsupported recommendation topic."
      );
  }
}

/*
 * =========================
 * SAVE / REFRESH RECOMMENDATION
 * =========================
 */

async function ensureTopicRecommendation(
  teacherId: string,
  learnerId: string,
  assignments:
    AssignmentRecord[]
): Promise<void> {
  const initial =
    buildRecommendation(
      assignments,
      null
    );

  if (!initial) {
    return;
  }

  const attemptEvidence =
    await loadAttemptEvidence(
      teacherId,
      learnerId,
      initial.sourceAssignmentId
    );

  const draft =
    buildRecommendation(
      assignments,
      attemptEvidence.firstAttemptPercent
    );

  if (!draft) {
    return;
  }

  /*
   * RecommendationEngine chooses
   * one weakest topic, so only
   * process the assignments passed
   * for this topic when appropriate.
   */
  const source =
    assignments.find(
      (
        assignment
      ) =>
        assignment.id ===
        draft.sourceAssignmentId
    );

  if (!source) {
    throw new Error(
      "Recommendation source assignment was not found."
    );
  }

  const evidence =
    `${scoreEvidence(
      draft.topic,
      assignments
    )}\n${attemptEvidence.text}`;

  const recommendationReference =
    doc(
      db,
      "recommendations",
      learnerId,
      "topics",
      recommendationTopicId(
        draft.topic
      )
    );

  const historyReference =
    doc(
      db,
      "recommendations",
      learnerId,
      "history",
      draft.sourceAssignmentId
    );

  await runTransaction(
    db,
    async (
      transaction
    ) => {
      if (
        auth.currentUser?.uid !==
        teacherId
      ) {
        throw new Error(
          "Teacher account changed."
        );
      }

      /*
       * ALL READS FIRST
       */

      const existing =
        await transaction.get(
          recommendationReference
        );

      const recorded =
        await transaction.get(
          historyReference
        );

      const existingData =
        existing.exists()
          ? existing.data()
          : null;

      const oldSource =
        existingData
          ?.sourceAssignmentId;

      const oldHistoryReference =
        oldSource &&
        oldSource !==
          draft.sourceAssignmentId
          ? doc(
              db,
              "recommendations",
              learnerId,
              "history",
              oldSource
            )
          : null;

      const oldHistory =
        oldHistoryReference
          ? await transaction.get(
              oldHistoryReference
            )
          : null;

      /*
       * Preserve the old current
       * recommendation in history.
       */

      if (
        oldHistoryReference &&
        oldHistory &&
        !oldHistory.exists() &&
        existingData
      ) {
        transaction.set(
          oldHistoryReference,
          existingData
        );
      }

      /*
       * SAME SOURCE ALREADY CURRENT
       */

      if (
        existingData &&
        existingData.sourceAssignmentId ===
          draft.sourceAssignmentId
      ) {
        const existingStatus =
          String(
            existingData.status ??
              ""
          );

        const previewExists =
          Array.isArray(
            existingData.previewQuestions
          ) &&
          existingData.previewQuestions.length >
            0;

        /*
         * Android preserves teacher
         * review state when enriching
         * the same recommendation.
         */

        if (
          !recorded.exists()
        ) {
          transaction.set(
            historyReference,
            existingData
          );
        }

        if (
          !String(
            existingData.evidence ??
              ""
          ).trim()
        ) {
          transaction.update(
            recommendationReference,
            {
              evidence,
            }
          );
        }

        if (
          existingStatus ===
            "pending" &&
          !previewExists
        ) {
          const existingDifficulty =
            String(
              existingData.recommendedDifficulty ??
                draft.recommendedDifficulty
            );

          const preview =
            createPreviewQuestions(
              draft.topic,
              existingDifficulty,
              source
            );

          const additions = {
            questionCount:
              preview.length,

            previewQuestions:
              preview,

            recommendedMinNumber:
              0,

            recommendedMaxNumber:
              difficultyMaximum(
                existingDifficulty
              ),
          };

          transaction.update(
            recommendationReference,
            additions
          );

          if (
            recorded.exists() &&
            recorded.data()
              .status ===
              "pending"
          ) {
            transaction.update(
              historyReference,
              additions
            );
          } else if (
            !recorded.exists()
          ) {
            transaction.set(
              historyReference,
              {
                ...existingData,

                ...additions,
              }
            );
          }
        }

        return;
      }

      /*
       * NEW RECOMMENDATION SOURCE
       */

      const preview =
        createPreviewQuestions(
          draft.topic,
          draft.recommendedDifficulty,
          source
        );

      const values = {
        questionCount:
          preview.length,

        previewQuestions:
          preview,

        teacherId,

        learnerId,

        sourceAssignmentId:
          draft.sourceAssignmentId,

        topic:
          draft.topic,

        masteryPercent:
          draft.masteryPercent,

        masteryLevel:
          draft.masteryLevel,

        currentDifficulty:
          draft.currentDifficulty,

        currentMinNumber:
          draft.currentMinNumber,

        currentMaxNumber:
          draft.currentMaxNumber,

        recommendedDifficulty:
          draft.recommendedDifficulty,

        recommendedMinNumber:
          0,

        recommendedMaxNumber:
          difficultyMaximum(
            draft.recommendedDifficulty
          ),

        reason:
          draft.reason,

        evidence,

        status:
          "pending",

        createdAt:
          serverTimestamp(),

        reviewedAt:
          null,

        updatedAt:
          serverTimestamp(),
      };

      transaction.set(
        recommendationReference,
        values
      );

      /*
       * Never overwrite an already
       * preserved history record.
       */

      if (
        !recorded.exists()
      ) {
        transaction.set(
          historyReference,
          values
        );
      }
    }
  );
}

async function refreshRecommendations(
  teacherId: string,
  learnerId: string,
  assignments:
    AssignmentRecord[]
): Promise<void> {
  /*
   * Android calls ensureCurrent()
   * across all supported topics.
   *
   * Each topic list may or may not
   * produce a recommendation.
   */

  for (
    const topic
    of SUPPORTED_TOPICS
  ) {
    const topicAssignments =
      assignments.filter(
        (
          assignment
        ) =>
          assignment.topic.toLowerCase() ===
          topic.toLowerCase()
      );

    if (
      topicAssignments.length ===
      0
    ) {
      continue;
    }

    /*
     * RecommendationEngine itself
     * chooses the weakest attempted
     * topic. With a topic-only list,
     * this produces that topic's
     * recommendation exactly like
     * Android ensureTopic().
     */

    await ensureTopicRecommendation(
      teacherId,
      learnerId,
      topicAssignments
    );
  }
}

/*
 * =========================
 * COMPLETE ASSIGNMENT
 * =========================
 */

async function completeAssignment(
  assignmentId: string,
  score: number,
  totalQuestions: number,
  teacherId: string
): Promise<AssignmentRecord> {
  if (
    !validCompletedResult(
      assignmentId,
      score,
      totalQuestions
    )
  ) {
    throw new Error(
      "Missing or invalid assignment, score, or total."
    );
  }

  const assignmentReference =
    doc(
      db,
      "assignments",
      assignmentId
    );

  const mastery =
    Math.round(
      (
        score /
        totalQuestions
      ) *
        100
    );

  await runTransaction(
    db,
    async (
      transaction
    ) => {
      if (
        auth.currentUser?.uid !==
        teacherId
      ) {
        throw new Error(
          "Teacher account changed."
        );
      }

      const existing =
        await transaction.get(
          assignmentReference
        );

      if (
        !existing.exists() ||
        existing.data()
          .teacherId !==
          teacherId
      ) {
        throw new Error(
          "Assignment ownership changed."
        );
      }

      const data =
        existing.data();

      /*
       * Recovery may run more than once.
       *
       * If the assignment already contains
       * this exact completed result, do not
       * rewrite its completion timestamp.
       */
      if (
        data.status !==
          "completed" ||
        Number(
          data.score
        ) !==
          score ||
        Number(
          data.totalQuestions
        ) !==
          totalQuestions
      ) {
        transaction.update(
          assignmentReference,
          {
            status:
              "completed",

            currentSessionId:
              null,

            score,

            totalQuestions,

            masteryPercent:
              mastery,

            completedAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );
      }
    }
  );

  const completedSnapshot =
    await getDocFromServer(
      assignmentReference
    );

  if (
    !completedSnapshot.exists()
  ) {
    throw new Error(
      "Completed assignment was not found."
    );
  }

  return assignmentFromSnapshot(
    completedSnapshot
  );
}

/*
 * =========================
 * FULL RESULT SYNC
 * =========================
 */

export async function synchronizeCompletedSession(
  sessionId: string,
  assignmentId: string,
  score: number,
  totalQuestions: number,
  teacherId: string
): Promise<void> {
  if (
    !validCompletedResult(
      assignmentId,
      score,
      totalQuestions
    )
  ) {
    throw new Error(
      "Missing or invalid assignment, score, or total."
    );
  }

  /*
   * STEP 1
   * Save assignment completion.
   */

  const completedAssignment =
    await completeAssignment(
      assignmentId,
      score,
      totalQuestions,
      teacherId
    );

  if (
    !completedAssignment.teacherId ||
    !completedAssignment.learnerId
  ) {
    throw new Error(
      "Completed assignment is missing its teacher or learner."
    );
  }

  /*
   * STEP 2
   * Load all learner assignment history.
   */

  const assignmentsSnapshot =
    await getDocsFromServer(
      query(
        collection(
          db,
          "assignments"
        ),
        where(
          "teacherId",
          "==",
          completedAssignment.teacherId
        ),
        where(
          "learnerId",
          "==",
          completedAssignment.learnerId
        )
      )
    );

  const assignments =
    assignmentsSnapshot.docs
      .map(
        assignmentFromSnapshot
      )
      .filter(
        (
          assignment
        ) =>
          assignment.teacherId ===
          completedAssignment.teacherId
      );

  /*
   * STEP 3
   * Refresh adaptive recommendations.
   *
   * resultSynced MUST NOT become true
   * until this succeeds.
   */

  await refreshRecommendations(
    completedAssignment.teacherId,
    completedAssignment.learnerId,
    assignments
  );

  /*
   * STEP 4
   * Mark the Live Session as synced.
   */

  if (
    auth.currentUser?.uid !==
    teacherId
  ) {
    throw new Error(
      "Teacher account changed."
    );
  }

  await updateDoc(
    doc(
      db,
      "liveSessions",
      sessionId
    ),
    {
      resultSynced:
        true,
    }
  );
}