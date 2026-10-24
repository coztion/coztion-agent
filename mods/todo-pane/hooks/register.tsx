import { atom, read, update } from "claude-code";
import type { Hook, Register } from "claude-code";

import type { TodoItem, TodoList } from "../types";

const PANE = "todo";
const PICK = "todo-pick";
const LISTS = "todo-lists";
const DEL = "todo-delete";
const COLUMNS = 40;
const LISTS_KEY = "lists";
const CURRENT_KEY = "currentTitle";
const FILTER_KEY = "isOpenOnly";
const TOOL = "mcp__todo-pane__todo_write";
const USAGE = [
  "Usage:",
  "  /todo create <content>  make a new to-do list from the content",
  "  /todo list              list the to-do lists",
  "  /todo open              show a list (pick one when there are several)",
  "  /todo close             hide the pane",
  "  /todo compact           show open items only",
  "  /todo expand            show all items",
  "  /todo update            mark items done from the conversation",
  "  /todo delete [number]   delete a list (pick one when no number)",
].join("\n");
const lists = atom({ plugin: "todo-pane", key: "lists" } as const, []);
const currentTitle = atom(
  { plugin: "todo-pane", key: "currentTitle" } as const,
  "",
);
const isOpenOnly = atom(
  { plugin: "todo-pane", key: "isOpenOnly" } as const,
  false,
);
const isOpen = atom({ plugin: "todo-pane", key: "isOpen" } as const, false);

const toItems = (raw: unknown): TodoItem[] =>
  Array.isArray(raw)
    ? raw
        .filter(
          (one) => typeof one?.text === "string" && one.text.trim() !== "",
        )
        .map((one) => ({ text: one.text.trim(), isDone: one.isDone === true }))
    : [];

const toLists = (raw: unknown): TodoList[] =>
  Array.isArray(raw)
    ? raw
        .filter(
          (one) => typeof one?.title === "string" && one.title.trim() !== "",
        )
        .map((one) => ({ title: one.title.trim(), items: toItems(one.items) }))
    : [];

const sessionKey = async (
  $: Parameters<Hook<"session.start">>[0],
  key: string,
) => `${key}:${await $.session.id()}`;

const count = (list: TodoList) =>
  `${list.items.filter((one) => !one.isDone).length} open / ${list.items.length}`;

async function current($: Parameters<Hook<"session.start">>[0]) {
  const title = await read($, currentTitle);

  return (await read($, lists)).find((one) => one.title === title);
}

async function open($: Parameters<Hook<"session.start">>[0]) {
  await update($, isOpen, () => true);
  const list = await current($);
  await $.ui.open({
    id: PANE,
    title: list?.title ?? "To-Do",
    columns: COLUMNS,
  });
}

function ask($: Parameters<Hook<"session.start">>[0], text: string) {
  $.clock.after(0, () => {
    $.prompt
      .submit({ text })
      .catch((error) => $.ui.log(`todo: prompt failed: ${error}`));
  });
}

async function remove($: Parameters<Hook<"session.start">>[0], title: string) {
  const left = await update($, lists, (old) =>
    old.filter((one) => one.title !== title),
  );
  await $.store.set(await sessionKey($, LISTS_KEY), left);
  if ((await read($, currentTitle)) !== title) return;
  const next = left[0]?.title ?? "";
  await update($, currentTitle, () => next);
  await $.store.set(await sessionKey($, CURRENT_KEY), next);
  if (await read($, isOpen)) {
    await $.ui.open({ id: PANE, title: next || "To-Do", columns: COLUMNS });
  }
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const saved = toLists(await $.store.get(await sessionKey($, LISTS_KEY)));
    await update($, lists, () => saved);
    const savedTitle = await $.store.get(await sessionKey($, CURRENT_KEY));
    await update($, currentTitle, () =>
      typeof savedTitle === "string" ? savedTitle : (saved[0]?.title ?? ""),
    );
    const savedFilter = (await $.store.get(FILTER_KEY)) === true;
    await update($, isOpenOnly, () => savedFilter);

    await $.tool.register({
      name: "todo_write",
      description:
        "Writes one of the user's to-do lists (TDL) and shows it in the pane beside the conversation. " +
        "Use it whenever the user asks to create, add to, check off, edit or clear a TDL, " +
        "and on your own as soon as work you did completes an item, " +
        "instead of printing the list in the reply. " +
        "A title that exists replaces that list; a new title makes a new list. " +
        "Pass the whole list each time.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "The list title, short" },
          items: {
            type: "array",
            description: "The full list, in order",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                isDone: { type: "boolean" },
              },
              required: ["text", "isDone"],
            },
          },
        },
        required: ["title", "items"],
      },
      isDeferred: false,
    });
    await $.command.register({
      name: "todo",
      description:
        "To-do lists: create, list, open, close, compact, expand, update",
    });
    $.ui.status(undefined);

    return next(e);
  });

  on("command.run", { command: "todo" }, async ($, e) => {
    const [sub = "", ...rest] = e.args.trim().split(/\s+/);
    const content = e.args.trim().slice(sub.length).trim();

    switch (sub) {
      case "create":
        if (rest.length === 0) return { text: "Usage: /todo create <content>" };
        ask(
          $,
          "Make a new to-do list from the content below, with a short title not used by another list, " +
            "and write it with the todo_write tool.\n\n" +
            content,
        );

        return { text: "Creating a to-do list." };
      case "list": {
        if ((await read($, lists)).length === 0)
          return { text: "No to-do lists yet." };
        await $.ui.open({
          id: LISTS,
          title: "To-do lists",
          focus: true,
          closeOnEscape: true,
        });

        return {};
      }
      case "open": {
        const all = await read($, lists);
        if (all.length > 1) {
          await $.ui.open({
            id: PICK,
            title: "Pick a to-do list",
            focus: true,
            closeOnEscape: true,
          });

          return { text: "Pick a to-do list." };
        }
        await open($);

        return { text: "To-Do pane opened." };
      }
      case "close":
        await update($, isOpen, () => false);
        await $.ui.close({ id: PANE });

        return { text: "To-Do pane closed." };
      case "compact":
      case "expand": {
        const next = sub === "compact";
        await update($, isOpenOnly, () => next);
        await $.store.set(FILTER_KEY, next);

        return {
          text: next ? "Showing open items only." : "Showing all items.",
        };
      }
      case "update":
        ask(
          $,
          "Check each item of the current to-do list against what was done in this conversation, " +
            "and write the list with the todo_write tool, marking finished items done.",
        );

        return { text: "Updating the to-do list." };
      case "delete": {
        const all = await read($, lists);
        if (all.length === 0) return { text: "No to-do lists yet." };
        if (rest.length === 0) {
          await $.ui.open({
            id: DEL,
            title: "Delete a to-do list",
            focus: true,
            closeOnEscape: true,
          });

          return { text: "Pick a to-do list to delete." };
        }
        const gone = all[Number(rest[0]) - 1];
        if (gone === undefined)
          return {
            text: "Usage: /todo delete [number]  (the number in /todo list)",
          };
        await remove($, gone.title);

        return { text: `Deleted "${gone.title}".` };
      }
      default:
        return { text: USAGE };
    }
  });

  on("ui.close", async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === "person")
      await update($, isOpen, () => false);

    return next(e);
  });

  on("prompt.compose", async ($, e, next) => {
    const composed = await next(e);
    const list = await current($);
    if (list === undefined) return composed;
    const others = (await read($, lists)).filter(
      (one) => one.title !== list.title,
    );
    const lines = list.items.map(
      (one, i) => `${i + 1}. [${one.isDone ? "x" : " "}] ${one.text}`,
    );

    return {
      sections: [
        ...composed.sections,
        {
          id: "todo-pane:list",
          text:
            `The user's current to-do list "${list.title}", shown in a pane beside the conversation:\n` +
            lines.join("\n") +
            (others.length > 0
              ? `\nOther lists: ${others.map((one) => `"${one.title}"`).join(", ")}.`
              : "") +
            "\nWhen work you do finishes an open item, mark it done with the todo_write tool right away.",
          scope: "session",
        },
      ],
    };
  });

  on("tool.call", { tool: TOOL }, async ($, e) => {
    const title =
      typeof e.title === "string" && e.title.trim() !== ""
        ? e.title.trim()
        : "To-Do";
    const list = { title, items: toItems(e.items) };
    const all = await update($, lists, (old) =>
      old.some((one) => one.title === title)
        ? old.map((one) => (one.title === title ? list : one))
        : [...old, list],
    );
    await update($, currentTitle, () => title);
    await $.store.set(await sessionKey($, LISTS_KEY), all);
    await $.store.set(await sessionKey($, CURRENT_KEY), title);
    if (await read($, isOpen))
      await $.ui.open({ id: PANE, title, columns: COLUMNS });

    return { result: `To-do list "${title}" saved: ${count(list)}.` };
  });

  on("ui.render", { component: "Pane", requestId: LISTS }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const all = await read($, lists);

    return (
      <Box flexDirection="column">
        {all.map((one, i) => (
          <Text>
            {i + 1}. {one.title} ({count(one)})
          </Text>
        ))}
        <Text dimColor>Esc to close</Text>
      </Box>
    );
  });

  on("ui.render", { component: "Pane", requestId: DEL }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e);
    const all = await read($, lists);

    return (
      <Box flexDirection="column">
        {all.map((one, i) => (
          <Button
            key={`delete:${i}`}
            label={`${i + 1}. ${one.title} (${count(one)})`}
            plain
            autoFocus={i === 0 ? true : undefined}
            onPress={async () => {
              await $.ui.close({ id: DEL });
              await remove($, one.title);
            }}
          />
        ))}
        <Text dimColor>Enter to delete, Esc to close</Text>
      </Box>
    );
  });

  on("ui.render", { component: "Pane", requestId: PICK }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e);
    const all = await read($, lists);
    const title = await read($, currentTitle);

    return (
      <Box flexDirection="column">
        {all.map((one, i) => (
          <Button
            key={`pick:${i}`}
            label={`${i + 1}. ${one.title} (${count(one)})`}
            plain
            autoFocus={one.title === title ? true : undefined}
            onPress={async () => {
              await update($, currentTitle, () => one.title);
              await $.store.set(await sessionKey($, CURRENT_KEY), one.title);
              await $.ui.close({ id: PICK });
              await open($);
            }}
          />
        ))}
        <Text dimColor>Enter to open, Esc to close</Text>
      </Box>
    );
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const list = await current($);
    const openOnly = await read($, isOpenOnly);
    const items = list?.items ?? [];
    const shown = items
      .map((one, i) => ({ ...one, i }))
      .filter((one) => !openOnly || !one.isDone);

    return (
      <Box flexDirection="column">
        {openOnly && <Text dimColor>(open items only)</Text>}
        {items.length === 0 && <Text dimColor>No to-dos yet.</Text>}
        {items.length > 0 && shown.length === 0 && (
          <Text dimColor>All done.</Text>
        )}
        {shown.map(({ i, ...one }) => (
          <Text dimColor={one.isDone} strikethrough={one.isDone}>
            {one.isDone ? "☑" : "☐"} {i + 1}. {one.text}
          </Text>
        ))}
      </Box>
    );
  });
};
