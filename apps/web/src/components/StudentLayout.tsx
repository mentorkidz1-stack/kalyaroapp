import { Outlet } from "react-router-dom";
import { StudentTabBar } from "./StudentTabBar";

export function StudentLayout() {
  return (
    <div className="pb-16">
      <Outlet />
      <StudentTabBar />
    </div>
  );
}
