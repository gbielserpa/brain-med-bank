## Visão geral

Aplicação web para registrar e resolver questões de residência médica. Banco de questões com cadastro em **Configurações**, navegação por lista filtrável, e **Modo Prova** com pontuação ao final.

## Stack e armazenamento

- **Lovable Cloud** (Postgres + Storage + Auth) como padrão, para suportar login, sincronização entre dispositivos e upload de imagens.
- Auth simples por e-mail/senha. Cada usuário enxerga apenas suas próprias questões (RLS).
- Bucket público `question-images` para imagens das questões.

## Modelo de dados

Tabela `questions`:
- `id`, `user_id`, `created_at`, `updated_at`
- `statement` (enunciado, texto longo)
- `image_url` (opcional)
- `alternatives` (jsonb: array de `{ letter, text }` com 4 ou 5 itens)
- `correct_letter` (A–E)
- `specialty` (texto)
- `institution` (texto), `year` (int)
- `relevance` (1–5, estrelas)
- `explanation` (comentário/resolução, opcional)
- `tags` (text[])

Tabela `exam_attempts` (para modo prova):
- `id`, `user_id`, `created_at`, `score`, `total`, `answers` (jsonb)

## Rotas (TanStack Start)

```
src/routes/
  __root.tsx        layout + header com nav
  index.tsx         dashboard: total de questões, filtros rápidos, CTA "Iniciar prova" e "Ver banco"
  login.tsx         e-mail/senha
  bank.tsx          lista filtrável (busca, especialidade, instituição, ano, tag, relevância)
  bank.$id.tsx      detalhe/edição de uma questão
  exam.tsx          setup do modo prova (filtros + qtd de questões)
  exam.run.tsx      execução: 1 questão por vez, navegação prev/next, marcação
  exam.result.tsx   resultado: pontuação, gabarito comentado, taxa de acerto
  settings.tsx      configurações + editor de cadastro de questões
```

## Editor de questões (em /settings)

Dois modos de cadastro selecionáveis por tab:

**Modo 1 — Campos separados**
- 1 textarea: enunciado
- Toggle 4 / 5 alternativas (A–D ou A–E)
- 4 ou 5 inputs: uma caixa por alternativa
- Radio ao lado de cada alternativa para marcar a correta
- Upload opcional de imagem (drag & drop ou seletor)
- Campos de metadados: especialidade, instituição, ano, relevância (1–5 estrelas), tags, comentário

**Modo 2 — Colar bloco único**
- 1 textarea: enunciado
- 1 textarea: alternativas coladas em formato corrido
- Parser reconhece formato brasileiro padrão:
  - `A)`, `B)` … / `a)`, `b)` …
  - `A -`, `A.` , `A:` 
  - `(A)`, `(a)`
- Preview ao vivo: mostra as alternativas parseadas em cards com radio para marcar a correta
- Mesmo bloco de metadados e imagem do Modo 1

Botões: **Salvar e criar nova** / **Salvar** / **Limpar**.

Lista das questões cadastradas abaixo do editor, com busca rápida, editar e excluir.

## Lista do banco (/bank)

- Filtros laterais: especialidade, instituição, ano, tag, relevância mínima (★).
- Busca textual sobre enunciado.
- Cada card: trecho do enunciado, badges (especialidade, ano, relevância), ações ver/editar.
- Estado dos filtros vive em **search params da URL** (compartilhável).

## Modo Prova (/exam)

- Setup: aplicar os mesmos filtros do banco + escolher quantidade (ex.: 10/20/50/todas) + ordem (aleatória/sequencial).
- Execução: 1 questão por tela com imagem (quando houver), alternativas clicáveis, barra de progresso, navegação prev/next, botão "Finalizar".
- Resultado: pontuação, % de acerto, lista revisável com sua resposta vs. gabarito + comentário; salva tentativa em `exam_attempts`.

## Configurações (/settings)

- Tabs: **Cadastrar questões** (editor acima) | **Conta** (logout, alterar senha) | **Preferências** (tema claro/escuro, embaralhar alternativas no modo prova sim/não).

## Design

Visual clínico e sóbrio, focado em leitura longa:
- Tipografia serifada para enunciados (legibilidade), sans para UI.
- Paleta neutra com 1 accent (azul-petróleo) para ações primárias; verde p/ acerto, vermelho p/ erro.
- Cartões com bastante respiro; estrelas para relevância; badges discretos.
- Mobile-first: editor e modo prova precisam funcionar bem em celular.

## Detalhes técnicos

- Validação com **zod** em todos os formulários (limites de tamanho, ano entre 1980–ano atual, alternativas únicas A–E, correta obrigatória entre as existentes).
- Parser de alternativas implementado em util puro com testes mentais para edge cases (alternativas com quebras de linha internas, números soltos no texto).
- Upload de imagem via Supabase Storage; salva URL pública em `image_url`.
- RLS: políticas `user_id = auth.uid()` em select/insert/update/delete.
- Server functions (`createServerFn`) para create/update/list/delete questões; loader usa `ensureQueryData` + `useSuspenseQuery`.
- Filtros do banco e config da prova ficam em URL search params (`validateSearch` + `loaderDeps`).

## Entrega faseada

1. Cloud + auth + schema + RLS + bucket de imagens
2. Editor em /settings (ambos os modos) + parser + upload
3. /bank com filtros e edição
4. /exam (setup → run → result) + persistência das tentativas
5. Polimento visual, dashboard em /index, preferências