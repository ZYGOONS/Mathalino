import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({
  children,
}: Readonly<ProtectedRouteProps>) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // No Firebase user is logged in
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Look for the logged-in user in Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userRef);

        if (!userSnapshot.exists()) {
          await signOut(auth);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        const userData = userSnapshot.data();

        // Only administrators may access protected web pages
        if (userData.role !== "admin") {
          await signOut(auth);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error("Protected route error:", error);

        await signOut(auth);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        Checking administrator access...
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;