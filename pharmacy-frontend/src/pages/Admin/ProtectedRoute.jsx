import React, { useMemo } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = () => {
  const location = useLocation();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  if (!user || !user.role) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "cashier") {
    // الكاشير يجب أن يرى فقط صفحة KasherAzure
    const allowedPaths = ["/KasherAzure", "/kasherazure"];
    if (!allowedPaths.includes(location.pathname)) {
      return <Navigate to="/KasherAzure" replace />;
    }
  }

  // للمسؤولين، يمكنهم الوصول إلى كل شيء
  return <Outlet />;
};

export default ProtectedRoute;
