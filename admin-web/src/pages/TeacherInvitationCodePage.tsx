import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherInvitationCodePage.css";

interface LearnerInfo {
  id: string;

  teacherId: string;

  firstName: string;
  lastName: string;

  grade: string;
}

interface InvitationInfo {
  code: string;

  expiresAt:
    Timestamp;
}

const INVITATION_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const INVITATION_LENGTH =
  8;

const INVITATION_DAYS =
  7;

function learnerName(
  learner:
    LearnerInfo | null
): string {
  if (!learner) {
    return "";
  }

  return [
    learner.firstName,
    learner.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function generateSecureCode():
  string {
  const values =
    new Uint32Array(
      INVITATION_LENGTH
    );

  crypto.getRandomValues(
    values
  );

  return Array.from(
    values
  )
    .map(
      (
        value
      ) =>
        INVITATION_ALPHABET[
          value %
            INVITATION_ALPHABET.length
        ]
    )
    .join("");
}

function displayCode(
  code: string
): string {
  if (
    code.length !==
    8
  ) {
    return code;
  }

  return `${code.slice(
    0,
    4
  )}-${code.slice(
    4
  )}`;
}

function formatExpiration(
  timestamp:
    Timestamp
): string {
  return timestamp
    .toDate()
    .toLocaleDateString(
      "en-US",
      {
        year:
          "numeric",

        month:
          "long",

        day:
          "numeric",
      }
    );
}

function TeacherInvitationCodePage() {
  const navigate =
    useNavigate();

  const {
    learnerId,
  } =
    useParams<{
      learnerId: string;
    }>();

  const [
    learner,
    setLearner,
  ] =
    useState<LearnerInfo | null>(
      null
    );

  const [
    invitation,
    setInvitation,
  ] =
    useState<InvitationInfo | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    generating,
    setGenerating,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  /*
   * =========================
   * GENERATE UNIQUE CODE
   * =========================
   */

  const createUniqueCode =
    async (
      teacherId:
        string,
      currentLearner:
        LearnerInfo,
      teacherName:
        string
    ) => {
      /*
       * Same idea as Android:
       * generate random codes until
       * one does not already exist.
       */

      for (
        let attempt =
          0;
        attempt <
          15;
        attempt +=
          1
      ) {
        const candidate =
          generateSecureCode();

        const invitationReference =
          doc(
            db,
            "invitations",
            candidate
          );

        const expirationDate =
          new Date(
            Date.now() +
              INVITATION_DAYS *
                24 *
                60 *
                60 *
                1000
          );

        const expiresAt =
          Timestamp.fromDate(
            expirationDate
          );

        try {
          await runTransaction(
            db,
            async (
              transaction
            ) => {
              const existing =
                await transaction.get(
                  invitationReference
                );

              if (
                existing.exists()
              ) {
                throw new Error(
                  "INVITATION_COLLISION"
                );
              }

              transaction.set(
                invitationReference,
                {
                  code:
                    candidate,

                  teacherId,

                  teacherName,

                  learnerId:
                    currentLearner.id,

                  learnerName:
                    learnerName(
                      currentLearner
                    ),

                  learnerGrade:
                    currentLearner.grade,

                  status:
                    "active",

                  expiresAt,

                  createdAt:
                    serverTimestamp(),
                }
              );
            }
          );

          setInvitation({
            code:
              candidate,

            expiresAt,
          });

          return;
        } catch (
          invitationError
        ) {
          if (
            invitationError instanceof
              Error &&
            invitationError.message ===
              "INVITATION_COLLISION"
          ) {
            continue;
          }

          throw invitationError;
        }
      }

      throw new Error(
        "Could not create a unique invitation code."
      );
    };

  /*
   * =========================
   * LOAD LEARNER + TEACHER
   * =========================
   */

  useEffect(() => {
    if (!learnerId) {
      navigate(
        "/teacher/learners"
      );

      return;
    }

    let active =
      true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          user
        ) => {
          if (!user) {
            navigate("/");
            return;
          }

          try {
            setLoading(
              true
            );

            setGenerating(
              true
            );

            setError(
              ""
            );

            setMessage(
              ""
            );

            /*
             * LEARNER
             */

            const learnerSnapshot =
              await getDoc(
                doc(
                  db,
                  "learners",
                  learnerId
                )
              );

            if (
              !learnerSnapshot.exists()
            ) {
              throw new Error(
                "Learner was not found."
              );
            }

            const learnerData =
              learnerSnapshot.data();

            if (
              learnerData.teacherId !==
              user.uid
            ) {
              throw new Error(
                "This learner does not belong to your account."
              );
            }

            const currentLearner:
              LearnerInfo = {
                id:
                  learnerSnapshot.id,

                teacherId:
                  learnerData.teacherId ??
                  "",

                firstName:
                  learnerData.firstName ??
                  "",

                lastName:
                  learnerData.lastName ??
                  "",

                grade:
                  learnerData.grade ??
                  "",
              };

            if (!active) {
              return;
            }

            setLearner(
              currentLearner
            );

            /*
             * TEACHER PROFILE
             */

            const teacherSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !teacherSnapshot.exists()
            ) {
              throw new Error(
                "Teacher profile was not found."
              );
            }

            const teacherData =
              teacherSnapshot.data();

            const firstName =
              String(
                teacherData.firstName ??
                  ""
              );

            const lastName =
              String(
                teacherData.lastName ??
                  ""
              );

            const title =
              String(
                teacherData.title ??
                  ""
              );

            const displayName =
              String(
                teacherData.displayName ??
                  ""
              ).trim();

            const fullName =
              String(
                teacherData.fullName ??
                  ""
              ).trim();

            /*
             * Same fallback order
             * used by Android.
             */

            const fallbackName =
              [
                title,

                lastName ||
                  firstName,
              ]
                .filter(
                  Boolean
                )
                .join(" ")
                .trim();

            const teacherName =
              displayName ||
              fullName ||
              fallbackName;

            /*
             * Android generates a new
             * invitation whenever this
             * screen is opened.
             */

            await createUniqueCode(
              user.uid,
              currentLearner,
              teacherName
            );
          } catch (
            loadError
          ) {
            console.error(
              "Could not generate invitation code:",
              loadError
            );

            if (active) {
              setError(
                loadError instanceof
                Error
                  ? loadError.message
                  : "Could not generate invitation code."
              );
            }
          } finally {
            if (active) {
              setGenerating(
                false
              );

              setLoading(
                false
              );
            }
          }
        }
      );

    return () => {
      active =
        false;

      unsubscribe();
    };
  }, [
    learnerId,
    navigate,
  ]);

  /*
   * =========================
   * COPY CODE
   * =========================
   */

  const handleCopy =
    async () => {
      if (
        !invitation
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          invitation.code
        );

        setMessage(
          "Invitation code copied."
        );
      } catch (
        copyError
      ) {
        console.error(
          "Could not copy invitation code:",
          copyError
        );

        setError(
          "Could not copy the invitation code."
        );
      }
    };

  /*
   * =========================
   * SHARE CODE
   * =========================
   */

  const handleShare =
    async () => {
      if (
        !invitation
      ) {
        return;
      }

      const text =
        `Use Mathalino invitation code: ${invitation.code}`;

      try {
        if (
          navigator.share
        ) {
          await navigator.share({
            title:
              "Mathalino Invitation",

            text,
          });

          return;
        }

        /*
         * Desktop browsers may not
         * support the Web Share API.
         */

        await navigator.clipboard.writeText(
          text
        );

        setMessage(
          "Sharing is not available in this browser, so the invitation message was copied instead."
        );
      } catch (
        shareError
      ) {
        /*
         * User cancelling the share
         * sheet is not an actual error.
         */

        if (
          shareError instanceof
            DOMException &&
          shareError.name ===
            "AbortError"
        ) {
          return;
        }

        console.error(
          "Could not share invitation:",
          shareError
        );

        setError(
          "Could not share the invitation code."
        );
      }
    };

  return (
    <TeacherLayout>

      <div className="teacher-invitation-heading">

        <button
          type="button"
          className="teacher-invitation-back"
          onClick={() =>
            navigate(
              `/teacher/learners/${learnerId}`
            )
          }
        >
          ← Learner Details
        </button>

        <span className="teacher-invitation-eyebrow">
          GUARDIAN ACCESS
        </span>

        <h2>
          Invitation Code
        </h2>

        <p>
          Share this code with the
          learner's guardian so they
          can request access.
        </p>

      </div>

      {error && (
        <div
          className="teacher-invitation-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="teacher-invitation-success"
          role="status"
        >
          {message}
        </div>
      )}

      {loading && (
        <div className="teacher-invitation-loading">
          Generating invitation code...
        </div>
      )}

      {!loading &&
        learner && (
          <div className="teacher-invitation-layout">

            {/* LEARNER */}

            <section className="teacher-invitation-card">

              <span className="teacher-invitation-section-label">
                LEARNER
              </span>

              <h3>
                {learnerName(
                  learner
                ) ||
                  "Learner"}
              </h3>

              {learner.grade && (
                <p>
                  Grade{" "}
                  {
                    learner.grade
                  }
                </p>
              )}

            </section>

            {/* INVITATION */}

            <section className="teacher-invitation-card teacher-invitation-code-card">

              <span className="teacher-invitation-section-label">
                ACTIVE INVITATION
              </span>

              {generating && (
                <div className="teacher-invitation-generating">
                  Generating code...
                </div>
              )}

              {!generating &&
                invitation && (
                  <>

                    <div className="teacher-invitation-code">

                      {displayCode(
                        invitation.code
                      )}

                    </div>

                    <div className="teacher-invitation-status">

                      <span className="teacher-invitation-active">
                        Active
                      </span>

                      <span>
                        Expires{" "}
                        {formatExpiration(
                          invitation.expiresAt
                        )}
                      </span>

                    </div>

                    <p className="teacher-invitation-help">
                      The guardian enters
                      this code in the
                      Mathalino mobile app,
                      confirms the learner,
                      chooses their
                      relationship, and
                      submits a request for
                      your approval.
                    </p>

                    <div className="teacher-invitation-actions">

                      <button
                        type="button"
                        className="teacher-invitation-copy"
                        onClick={() => {
                          void handleCopy();
                        }}
                      >
                        Copy Code
                      </button>

                      <button
                        type="button"
                        className="teacher-invitation-share"
                        onClick={() => {
                          void handleShare();
                        }}
                      >
                        Share Code
                      </button>

                    </div>

                  </>
                )}

            </section>

            {/* REQUESTS */}

            <section className="teacher-invitation-card teacher-invitation-requests">

              <div>

                <span className="teacher-invitation-section-label">
                  GUARDIAN REQUESTS
                </span>

                <h3>
                  Review Link Requests
                </h3>

                <p>
                  After a guardian uses
                  this code, their request
                  appears in Guardian
                  Requests for your
                  approval.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/teacher/guardian-requests"
                  )
                }
              >
                View Guardian Requests
              </button>

            </section>

          </div>
        )}

    </TeacherLayout>
  );
}

export default TeacherInvitationCodePage;