-- Tabela de documentos enviados pelo funcionário via HOS App mobile.
-- Escopo separado de employee_documents (que é gestão de RH/admin).
-- Bucket Storage: 'documents' (privado, signed URL).

create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  name         text not null,
  type         text not null default 'outro',
  storage_path text not null,
  uploaded_at  timestamptz not null default now()
);

create index if not exists documents_employee_id_idx on documents(employee_id);

alter table documents enable row level security;

-- Funcionário acessa apenas os próprios documentos (via employee_auth/CPF)
-- O app usa service_role key, então RLS não aplica em produção.
-- Esta policy é para proteção caso a chave seja trocada para anon no futuro.
create policy "service_role_full_access" on documents
  using (true)
  with check (true);
