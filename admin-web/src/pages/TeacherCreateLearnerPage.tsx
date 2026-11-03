import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherCreateLearnerPage.css";

interface LearnerForm {
  firstName: string;
  lastName: string;

  grade: string;
  section: string;

  age: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;

  grade?: string;
  section?: string;

  age?: string;
}

interface CsvLearnerRow {
  rowNumber: number;

  firstName: string;
  lastName: string;

  grade: string;
  section: string;

  age: string;

  errors: string[];
}

/* =========================
   CSV
   ========================= */

function normalizeHeader(
  value: string
): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

function parseCsv(
  text: string
): string[][] {
  const rows:
    string[][] = [];

  let row:
    string[] = [];

  let field = "";

  let insideQuotes =
    false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const character =
      text[index];

    const nextCharacter =
      text[index + 1];

    if (
      character ===
      '"'
    ) {
      if (
        insideQuotes &&
        nextCharacter ===
          '"'
      ) {
        field += '"';

        index += 1;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }

    if (
      character ===
        "," &&
      !insideQuotes
    ) {
      row.push(
        field.trim()
      );

      field = "";

      continue;
    }

    if (
      (
        character ===
          "\n" ||
        character ===
          "\r"
      ) &&
      !insideQuotes
    ) {
      if (
        character ===
          "\r" &&
        nextCharacter ===
          "\n"
      ) {
        index += 1;
      }

      row.push(
        field.trim()
      );

      const containsData =
        row.some(
          (
            value
          ) =>
            value.trim() !==
            ""
        );

      if (
        containsData
      ) {
        rows.push(
          row
        );
      }

      row = [];

      field = "";

      continue;
    }

    field +=
      character;
  }

  row.push(
    field.trim()
  );

  if (
    row.some(
      (
        value
      ) =>
        value.trim() !==
        ""
    )
  ) {
    rows.push(
      row
    );
  }

  return rows;
}

function validateCsvRow(
  row:
    Omit<
      CsvLearnerRow,
      "errors"
    >
): string[] {
  const errors:
    string[] = [];

  if (
    !row.firstName.trim()
  ) {
    errors.push(
      "First name required"
    );
  }

  if (
    !row.lastName.trim()
  ) {
    errors.push(
      "Last name required"
    );
  }

  if (
    !row.grade.trim()
  ) {
    errors.push(
      "Grade required"
    );
  }

  if (
    !row.section.trim()
  ) {
    errors.push(
      "Section required"
    );
  }

  const age =
    Number(
      row.age
    );

  if (
    !Number.isInteger(
      age
    ) ||
    age < 3 ||
    age > 25
  ) {
    errors.push(
      "Age must be 3–25"
    );
  }

  return errors;
}

function TeacherCreateLearnerPage() {
  const navigate =
    useNavigate();

  const [
    teacherId,
    setTeacherId,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState<LearnerForm>({
      firstName: "",
      lastName: "",

      grade: "",
      section: "",

      age: "",
    });

  const [
    errors,
    setErrors,
  ] =
    useState<FormErrors>(
      {}
    );

  const [
    loadingAuth,
    setLoadingAuth,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  /* =========================
     CSV STATE
     ========================= */

  const [
    importOpen,
    setImportOpen,
  ] =
    useState(false);

  const [
    csvRows,
    setCsvRows,
  ] =
    useState<
      CsvLearnerRow[]
    >(
      []
    );

  const [
    csvFileName,
    setCsvFileName,
  ] =
    useState("");

  const [
    csvError,
    setCsvError,
  ] =
    useState("");

  const [
    importing,
    setImporting,
  ] =
    useState(false);

  const [
    importSuccess,
    setImportSuccess,
  ] =
    useState("");

  /* =========================
     AUTH
     ========================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (
          user
        ) => {
          if (!user) {
            navigate("/");

            return;
          }

          setTeacherId(
            user.uid
          );

          setLoadingAuth(
            false
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    navigate,
  ]);

  /* =========================
     INPUT
     ========================= */

  const handleChange = (
    field:
      keyof LearnerForm,
    value: string
  ) => {
    setForm(
      (
        current
      ) => ({
        ...current,

        [field]:
          value,
      })
    );

    setErrors(
      (
        current
      ) => ({
        ...current,

        [field]:
          undefined,
      })
    );

    setError(
      ""
    );
  };

  /* =========================
     VALIDATION
     ========================= */

  const validate =
    (): boolean => {
      const nextErrors:
        FormErrors = {};

      const firstName =
        form.firstName.trim();

      const lastName =
        form.lastName.trim();

      const grade =
        form.grade.trim();

      const section =
        form.section.trim();

      const age =
        Number(
          form.age
        );

      if (!firstName) {
        nextErrors.firstName =
          "First name is required.";
      }

      if (!lastName) {
        nextErrors.lastName =
          "Last name is required.";
      }

      if (!grade) {
        nextErrors.grade =
          "Grade is required.";
      }

      if (!section) {
        nextErrors.section =
          "Section is required.";
      }

      if (
        !Number.isInteger(
          age
        ) ||
        age < 3 ||
        age > 25
      ) {
        nextErrors.age =
          "Enter a valid age from 3 to 25.";
      }

      setErrors(
        nextErrors
      );

      return (
        Object.keys(
          nextErrors
        ).length ===
        0
      );
    };

  /* =========================
     SAVE SINGLE LEARNER
     ========================= */

  const handleSave =
    async () => {
      if (
        !teacherId ||
        !validate()
      ) {
        return;
      }

      const user =
        auth.currentUser;

      if (
        !user ||
        user.uid !==
          teacherId
      ) {
        navigate("/");

        return;
      }

      try {
        setSaving(
          true
        );

        setError(
          ""
        );

        await addDoc(
          collection(
            db,
            "learners"
          ),
          {
            teacherId:
              user.uid,

            firstName:
              form.firstName.trim(),

            lastName:
              form.lastName.trim(),

            grade:
              form.grade.trim(),

            section:
              form.section.trim(),

            age:
              Number(
                form.age
              ),

            status:
              "active",

            rfidUid:
              null,

            guardianIds:
              [],

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        navigate(
          "/teacher/learners"
        );
      } catch (
        saveError
      ) {
        console.error(
          "Could not create learner:",
          saveError
        );

        setError(
          saveError instanceof
          Error
            ? saveError.message
            : "Could not create learner."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =========================
     CSV TEMPLATE
     ========================= */

  const handleDownloadTemplate =
    () => {
      const template = [
        "firstName,lastName,grade,section,age",
        "Juan,Dela Cruz,1,A,7",
        "Maria,Santos,2,B,8",
      ].join(
        "\n"
      );

      const blob =
        new Blob(
          [
            template,
          ],
          {
            type:
              "text/csv;charset=utf-8",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        "mathalino-learner-import-template.csv";

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );
    };

  /* =========================
     CSV OPEN / CLOSE
     ========================= */

  const openImport =
    () => {
      setCsvRows(
        []
      );

      setCsvFileName(
        ""
      );

      setCsvError(
        ""
      );

      setImportSuccess(
        ""
      );

      setImportOpen(
        true
      );
    };

  const closeImport =
    () => {
      if (
        importing
      ) {
        return;
      }

      setImportOpen(
        false
      );

      setCsvRows(
        []
      );

      setCsvFileName(
        ""
      );

      setCsvError(
        ""
      );

      setImportSuccess(
        ""
      );
    };

  /* =========================
     READ CSV
     ========================= */

  const handleCsvFile =
    async (
      file:
        File | null
    ) => {
      setCsvRows(
        []
      );

      setCsvError(
        ""
      );

      setImportSuccess(
        ""
      );

      setCsvFileName(
        file?.name ??
          ""
      );

      if (!file) {
        return;
      }

      if (
        !file.name
          .toLowerCase()
          .endsWith(
            ".csv"
          )
      ) {
        setCsvError(
          "Select a CSV file."
        );

        return;
      }

      if (
        file.size >
        1024 *
          1024
      ) {
        setCsvError(
          "CSV file must be 1 MB or smaller."
        );

        return;
      }

      try {
        const text =
          await file.text();

        const parsed =
          parseCsv(
            text
          );

        if (
          parsed.length <
          2
        ) {
          setCsvError(
            "The CSV does not contain any learner records."
          );

          return;
        }

        const header =
          parsed[0].map(
            normalizeHeader
          );

        const requiredHeaders = {
          firstName:
            "firstname",

          lastName:
            "lastname",

          grade:
            "grade",

          section:
            "section",

          age:
            "age",
        };

        const firstNameIndex =
          header.indexOf(
            requiredHeaders.firstName
          );

        const lastNameIndex =
          header.indexOf(
            requiredHeaders.lastName
          );

        const gradeIndex =
          header.indexOf(
            requiredHeaders.grade
          );

        const sectionIndex =
          header.indexOf(
            requiredHeaders.section
          );

        const ageIndex =
          header.indexOf(
            requiredHeaders.age
          );

        const missing:
          string[] = [];

        if (
          firstNameIndex ===
          -1
        ) {
          missing.push(
            "firstName"
          );
        }

        if (
          lastNameIndex ===
          -1
        ) {
          missing.push(
            "lastName"
          );
        }

        if (
          gradeIndex ===
          -1
        ) {
          missing.push(
            "grade"
          );
        }

        if (
          sectionIndex ===
          -1
        ) {
          missing.push(
            "section"
          );
        }

        if (
          ageIndex ===
          -1
        ) {
          missing.push(
            "age"
          );
        }

        if (
          missing.length >
          0
        ) {
          setCsvError(
            `Missing required column${
              missing.length >
              1
                ? "s"
                : ""
            }: ${missing.join(
              ", "
            )}.`
          );

          return;
        }

        const dataRows =
          parsed
            .slice(
              1
            )
            .filter(
              (
                values
              ) =>
                values.some(
                  (
                    value
                  ) =>
                    value.trim() !==
                    ""
                )
            );

        if (
          dataRows.length ===
          0
        ) {
          setCsvError(
            "The CSV does not contain any learner records."
          );

          return;
        }

        if (
          dataRows.length >
          100
        ) {
          setCsvError(
            "Import a maximum of 100 learners at a time."
          );

          return;
        }

        const nextRows =
          dataRows.map(
            (
              values,
              index
            ): CsvLearnerRow => {
              const basicRow = {
                rowNumber:
                  index +
                  2,

                firstName:
                  values[
                    firstNameIndex
                  ]?.trim() ??
                  "",

                lastName:
                  values[
                    lastNameIndex
                  ]?.trim() ??
                  "",

                grade:
                  values[
                    gradeIndex
                  ]?.trim() ??
                  "",

                section:
                  values[
                    sectionIndex
                  ]?.trim() ??
                  "",

                age:
                  values[
                    ageIndex
                  ]?.trim() ??
                  "",
              };

              return {
                ...basicRow,

                errors:
                  validateCsvRow(
                    basicRow
                  ),
              };
            }
          );

        setCsvRows(
          nextRows
        );
      } catch (
        fileError
      ) {
        console.error(
          "Could not read CSV:",
          fileError
        );

        setCsvError(
          "Could not read the CSV file."
        );
      }
    };

  /* =========================
     IMPORT CSV
     ========================= */

  const handleImportCsv =
    async () => {
      const user =
        auth.currentUser;

      if (
        !user ||
        !teacherId ||
        user.uid !==
          teacherId
      ) {
        navigate("/");

        return;
      }

      if (
        csvRows.length ===
        0
      ) {
        setCsvError(
          "Upload a CSV file first."
        );

        return;
      }

      const invalidRows =
        csvRows.filter(
          (
            row
          ) =>
            row.errors.length >
            0
        );

      if (
        invalidRows.length >
        0
      ) {
        setCsvError(
          "Fix the invalid rows in the CSV before importing."
        );

        return;
      }

      try {
        setImporting(
          true
        );

        setCsvError(
          ""
        );

        setImportSuccess(
          ""
        );

        const batch =
          writeBatch(
            db
          );

        csvRows.forEach(
          (
            row
          ) => {
            const learnerReference =
              doc(
                collection(
                  db,
                  "learners"
                )
              );

            batch.set(
              learnerReference,
              {
                teacherId:
                  user.uid,

                firstName:
                  row.firstName.trim(),

                lastName:
                  row.lastName.trim(),

                grade:
                  row.grade.trim(),

                section:
                  row.section.trim(),

                age:
                  Number(
                    row.age
                  ),

                status:
                  "active",

                rfidUid:
                  null,

                guardianIds:
                  [],

                createdAt:
                  serverTimestamp(),

                updatedAt:
                  serverTimestamp(),
              }
            );
          }
        );

        await batch.commit();

        setImportSuccess(
          `${csvRows.length} learner${
            csvRows.length ===
            1
              ? ""
              : "s"
          } imported successfully.`
        );
      } catch (
        importError
      ) {
        console.error(
          "Could not import learners:",
          importError
        );

        setCsvError(
          importError instanceof
          Error
            ? importError.message
            : "Could not import learners."
        );
      } finally {
        setImporting(
          false
        );
      }
    };

  const csvInvalidCount =
    csvRows.filter(
      (
        row
      ) =>
        row.errors.length >
        0
    ).length;

  const csvValidCount =
    csvRows.length -
    csvInvalidCount;

  /* =========================
     LOADING
     ========================= */

  if (
    loadingAuth
  ) {
    return (
      <TeacherLayout>

        <div className="teacher-create-learner-loading">
          Loading...
        </div>

      </TeacherLayout>
    );
  }

  /* =========================
     UI
     ========================= */

  return (
    <TeacherLayout>

      <div className="teacher-create-learner-heading">

        <div>

          <button
            type="button"
            className="teacher-create-learner-back"
            onClick={() =>
              navigate(
                "/teacher/learners"
              )
            }
          >
            ← My Learners
          </button>

          <span className="teacher-create-learner-eyebrow">
            LEARNER MANAGEMENT
          </span>

          <h2>
            Create Learner
          </h2>

          <p>
            Add a learner to your
            Mathalino teacher account.
          </p>

        </div>

        <button
          type="button"
          className="teacher-create-learner-import"
          disabled={
            saving
          }
          onClick={
            openImport
          }
        >
          Import CSV
        </button>

      </div>

      {error && (
        <div
          className="teacher-create-learner-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="teacher-create-learner-card">

        <div className="teacher-create-learner-section-heading">

          <span>
            LEARNER INFORMATION
          </span>

          <h3>
            Learner Profile
          </h3>

          <p>
            Enter the learner's basic
            classroom information.
          </p>

        </div>

        <div className="teacher-create-learner-grid">

          <div className="teacher-create-learner-field">

            <label htmlFor="learner-first-name">
              FIRST NAME
            </label>

            <input
              id="learner-first-name"
              type="text"
              autoComplete="off"
              placeholder="First name"
              value={
                form.firstName
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "firstName",
                  event.target.value
                )
              }
            />

            {errors.firstName && (
              <small className="error">
                {
                  errors.firstName
                }
              </small>
            )}

          </div>

          <div className="teacher-create-learner-field">

            <label htmlFor="learner-last-name">
              LAST NAME
            </label>

            <input
              id="learner-last-name"
              type="text"
              autoComplete="off"
              placeholder="Last name"
              value={
                form.lastName
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "lastName",
                  event.target.value
                )
              }
            />

            {errors.lastName && (
              <small className="error">
                {
                  errors.lastName
                }
              </small>
            )}

          </div>

          <div className="teacher-create-learner-field">

            <label htmlFor="learner-grade">
              GRADE
            </label>

            <input
              id="learner-grade"
              type="text"
              autoComplete="off"
              placeholder="Example: 1"
              value={
                form.grade
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "grade",
                  event.target.value
                )
              }
            />

            {errors.grade ? (
              <small className="error">
                {
                  errors.grade
                }
              </small>
            ) : (
              <small>
                Example: 1 or 2
              </small>
            )}

          </div>

          <div className="teacher-create-learner-field">

            <label htmlFor="learner-section">
              SECTION
            </label>

            <input
              id="learner-section"
              type="text"
              autoComplete="off"
              placeholder="Example: A"
              value={
                form.section
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "section",
                  event.target.value
                )
              }
            />

            {errors.section && (
              <small className="error">
                {
                  errors.section
                }
              </small>
            )}

          </div>

          <div className="teacher-create-learner-field full">

            <label htmlFor="learner-age">
              AGE
            </label>

            <input
              id="learner-age"
              type="number"
              min="3"
              max="25"
              placeholder="Age"
              value={
                form.age
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "age",
                  event.target.value
                )
              }
            />

            {errors.age ? (
              <small className="error">
                {
                  errors.age
                }
              </small>
            ) : (
              <small>
                Valid age: 3–25
              </small>
            )}

          </div>

        </div>

        <div className="teacher-create-learner-initial">

          <span>
            INITIAL LEARNER SETTINGS
          </span>

          <div className="teacher-create-learner-initial-grid">

            <div>

              <small>
                STATUS
              </small>

              <strong>
                Active
              </strong>

            </div>

            <div>

              <small>
                RFID CARD
              </small>

              <strong>
                Not linked
              </strong>

            </div>

            <div>

              <small>
                GUARDIAN ACCESS
              </small>

              <strong>
                None
              </strong>

            </div>

          </div>

          <p>
            After creating the learner,
            you can link an RFID card,
            generate a guardian
            invitation code, and assign
            activities from the learner's
            profile.
          </p>

        </div>

        <div className="teacher-create-learner-actions">

          <button
            type="button"
            className="teacher-create-learner-cancel"
            disabled={
              saving
            }
            onClick={() =>
              navigate(
                "/teacher/learners"
              )
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="teacher-create-learner-save"
            disabled={
              saving
            }
            onClick={() => {
              void handleSave();
            }}
          >
            {saving
              ? "Saving..."
              : "Save Learner"}
          </button>

        </div>

      </section>

      {/* =========================
          CSV IMPORT MODAL
          ========================= */}

      {importOpen && (
        <div
          className="teacher-csv-backdrop"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeImport();
            }
          }}
        >

          <section
            className="teacher-csv-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="csv-import-title"
          >

            {!importSuccess ? (
              <>

                <div className="teacher-csv-header">

                  <div>

                    <span>
                      BULK LEARNER IMPORT
                    </span>

                    <h3 id="csv-import-title">
                      Import Learners from CSV
                    </h3>

                    <p>
                      Upload learner records
                      and review them before
                      adding them to Mathalino.
                    </p>

                  </div>

                  <button
                    type="button"
                    className="teacher-csv-close"
                    aria-label="Close CSV import"
                    disabled={
                      importing
                    }
                    onClick={
                      closeImport
                    }
                  >
                    ×
                  </button>

                </div>

                <div className="teacher-csv-body">

                  <div className="teacher-csv-template">

                    <div>

                      <strong>
                        CSV Template
                      </strong>

                      <span>
                        Required columns:
                        firstName, lastName,
                        grade, section, age
                      </span>

                    </div>

                    <button
                      type="button"
                      disabled={
                        importing
                      }
                      onClick={
                        handleDownloadTemplate
                      }
                    >
                      Download Template
                    </button>

                  </div>

                  <div className="teacher-csv-upload">

                    <label htmlFor="learner-csv-file">
                      CSV FILE
                    </label>

                    <input
                      id="learner-csv-file"
                      type="file"
                      accept=".csv,text/csv"
                      disabled={
                        importing
                      }
                      onClick={(
                        event
                      ) => {
                        event.currentTarget.value =
                          "";
                      }}
                      onChange={(
                        event
                      ) => {
                        void handleCsvFile(
                          event.target.files?.[
                            0
                          ] ??
                            null
                        );
                      }}
                    />

                    {csvFileName && (
                      <small>
                        Selected:{" "}
                        {
                          csvFileName
                        }
                      </small>
                    )}

                  </div>

                  {csvError && (
                    <div
                      className="teacher-csv-error"
                      role="alert"
                    >
                      {csvError}
                    </div>
                  )}

                  {csvRows.length >
                    0 && (
                    <>

                      <div className="teacher-csv-summary">

                        <div>
                          <span>
                            TOTAL
                          </span>

                          <strong>
                            {
                              csvRows.length
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            VALID
                          </span>

                          <strong className="valid">
                            {
                              csvValidCount
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            NEEDS FIX
                          </span>

                          <strong className="invalid">
                            {
                              csvInvalidCount
                            }
                          </strong>
                        </div>

                      </div>

                      <div className="teacher-csv-preview">

                        <table>

                          <thead>

                            <tr>
                              <th>
                                Row
                              </th>

                              <th>
                                Learner
                              </th>

                              <th>
                                Grade
                              </th>

                              <th>
                                Section
                              </th>

                              <th>
                                Age
                              </th>

                              <th>
                                Status
                              </th>
                            </tr>

                          </thead>

                          <tbody>

                            {csvRows.map(
                              (
                                row
                              ) => (
                                <tr
                                  key={
                                    row.rowNumber
                                  }
                                  className={
                                    row.errors.length >
                                    0
                                      ? "invalid"
                                      : ""
                                  }
                                >

                                  <td>
                                    {
                                      row.rowNumber
                                    }
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        row.firstName ||
                                        "—"
                                      }{" "}
                                      {
                                        row.lastName ||
                                        ""
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    {
                                      row.grade ||
                                      "—"
                                    }
                                  </td>

                                  <td>
                                    {
                                      row.section ||
                                      "—"
                                    }
                                  </td>

                                  <td>
                                    {
                                      row.age ||
                                      "—"
                                    }
                                  </td>

                                  <td>

                                    {row.errors.length ===
                                    0 ? (
                                      <span className="teacher-csv-status valid">
                                        Ready
                                      </span>
                                    ) : (
                                      <div className="teacher-csv-row-errors">

                                        <span className="teacher-csv-status invalid">
                                          Invalid
                                        </span>

                                        <small>
                                          {
                                            row.errors.join(
                                              ", "
                                            )
                                          }
                                        </small>

                                      </div>
                                    )}

                                  </td>

                                </tr>
                              )
                            )}

                          </tbody>

                        </table>

                      </div>

                    </>
                  )}

                </div>

                <div className="teacher-csv-actions">

                  <button
                    type="button"
                    className="teacher-csv-cancel"
                    disabled={
                      importing
                    }
                    onClick={
                      closeImport
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="teacher-csv-confirm"
                    disabled={
                      importing ||
                      csvRows.length ===
                        0 ||
                      csvInvalidCount >
                        0
                    }
                    onClick={() => {
                      void handleImportCsv();
                    }}
                  >
                    {importing
                      ? "Importing..."
                      : `Import ${
                          csvRows.length >
                          0
                            ? csvRows.length
                            : ""
                        } Learner${
                          csvRows.length ===
                          1
                            ? ""
                            : "s"
                        }`}
                  </button>

                </div>

              </>
            ) : (
              <div className="teacher-csv-success">

                <div className="teacher-csv-success-icon">
                  ✓
                </div>

                <h3>
                  Import Complete
                </h3>

                <p>
                  {
                    importSuccess
                  }
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/teacher/learners"
                    )
                  }
                >
                  View Learners
                </button>

              </div>
            )}

          </section>

        </div>
      )}

    </TeacherLayout>
  );
}

export default TeacherCreateLearnerPage;