"use client";

import { Suspense } from "react";
import { EducationSurface } from "@/components/knowledge/education-surface";

export default function EducationPage() {
  return (
    <Suspense fallback={null}>
      <EducationSurface />
    </Suspense>
  );
}
