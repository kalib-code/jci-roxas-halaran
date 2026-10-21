"use client";

import { useState, useTransition } from "react";

export function useSubmit(action) {
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();
  const submit = (input) =>
    start(async () => {
      try {
        setResult(await action(input));
      } catch (e) {
        setResult({ ok: false, errors: [`Something went wrong (${e.message}). Please try again.`] });
      }
    });
  return { submit, pending, result };
}
