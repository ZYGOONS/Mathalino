import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { Navigate } from "react-router";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole: "admin" | "teacher";
}

type AccessStatus =
  | "checking"
  | "allowed"
  | "denied";

function ProtectedRoute({
  children,
  allowedRole,
}: Readonly<ProtectedRouteProps>) {
  const [accessStatus, setAccessStatus] =
    useState<AccessStatus>("checking");

  useEffect(() => {
    let active = true;

    const checkUserRole = async (
      user: User
    ) => {
      try {
        const userReference = doc(
          db,
          "users",
          user.uid
        );

        const userSnapshot =
          await getDoc(userReference);

        if (!active) {
          return;
        }

        if (!userSnapshot.exists()) {
          console.error(
            "No Firestore user document found for:",
            user.uid
          );

          setAccessStatus("denied");
          return;
        }

        const userData =
          userSnapshot.data();

        const userRole =
          userData.role;

        console.log(
          "Authenticated UID:",
          user.uid
        );

        console.log(
          "Firestore role:",
          userRole
        );

        console.log(
          "Required role:",
          allowedRole
        );

        if (userRole === allowedRole) {
          setAccessStatus("allowed");
          return;
        }

        setAccessStatus("denied");
      } catch (error) {
        console.error(
          "Protected route error:",
          error
        );

        if (active) {
          setAccessStatus("denied");
        }
      }
    };

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          if (!active) {
            return;
          }

          if (!user) {
            setAccessStatus("denied");
            return;
          }

          void checkUserRole(user);
        }
      );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [allowedRole]);

  if (accessStatus === "checking") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f8f7",
          color: "#102d3c",
          fontFamily: "inherit",
        }}
      >
        Checking account access...
      </div>
    );
  }

  if (accessStatus === "denied") {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;