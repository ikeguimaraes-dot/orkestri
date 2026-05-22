import { notFound } from "next/navigation";
import {
  getClient,
  listEventsForClient,
  listInteractions,
} from "@/app/(dashboard)/cliente/actions";
import { requireUser } from "@kph/auth/server";
import { ClienteDetalheClient } from "./detalhe-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClienteDetalhePage({ params }: Props) {
  await requireUser();
  const { id } = await params;
  const [client, interactions, events] = await Promise.all([
    getClient(id),
    listInteractions(id),
    listEventsForClient(id),
  ]);
  if (!client) notFound();
  return (
    <ClienteDetalheClient
      client={client}
      interactions={interactions}
      events={events}
    />
  );
}
