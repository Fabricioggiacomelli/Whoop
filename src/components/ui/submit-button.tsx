"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./button";

/** Botão de submit que se desabilita e mostra texto de carregamento enquanto o form
 * (uma Server Action ligada direto via `<form action={...}>`, sem useActionState) está em
 * andamento — evita duplo envio em forms simples que não precisam de estado de retorno. */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}
