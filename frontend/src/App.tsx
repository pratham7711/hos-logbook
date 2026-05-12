import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout/Layout";
import { PlanPage } from "@/pages/PlanPage";
import { TripPage } from "@/pages/TripPage";
import { LogsPage } from "@/pages/LogsPage";
import { TripsListPage } from "@/pages/TripsListPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/plan" replace />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/trips" element={<TripsListPage />} />
          <Route path="/trip/:id" element={<TripPage />} />
          <Route path="/trip/:id/logs" element={<LogsPage />} />
          <Route path="/trip/:id/logs/:date" element={<LogsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </div>
  );
}
