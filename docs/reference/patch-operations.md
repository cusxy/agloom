---
title: Patch Operations
description: Reference for all patch operations used in .patch overlay files
prev: interpolation
next: transpilers
sidebar_position: 6
---

# Patch Operations

Patch operations provide fine-grained control over structured files (JSON, JSONC, YAML, TOML) in overlays. Instead of replacing a file entirely (override) or deep-merging it (overlay), a `.patch` file applies targeted modifications using declarative markers.

## File Naming Convention

Patch files use the naming pattern:

```text
<basename>.patch.<ext>
```

The `.patch` suffix is removed when determining the target file. For example, `settings.patch.yaml` applies to `settings.yaml`.

The format of the patch file may differ from the target. For example, `tsconfig.patch.yaml` can patch `tsconfig.json` — the patch is parsed as YAML, and the result is serialized as JSON.

Suffixes `.patch` and `.override` are mutually exclusive. A file with both suffixes (e.g., `settings.patch.override.json`) is an error.

## Operations

### $set

Replaces the value of a key entirely. Creates the key if it does not exist.

**Value type:** any

**Input:**

```json
{ "editor": { "fontSize": 14, "tabSize": 2 } }
```

**Patch:**

```yaml
editor:
  fontSize:
    $set: 16
```

**Result:**

```json
{ "editor": { "fontSize": 16, "tabSize": 2 } }
```

---

### $merge

Deep merges an object into the target. If the target does not exist, it is created as an empty object first.

**Value type:** object

**Input:**

```json
{ "editor": { "fontSize": 14, "tabSize": 2, "rulers": [80] } }
```

**Patch:**

```yaml
editor:
  $merge:
    fontSize: 16
    tabSize: 4
```

**Result:**

```json
{ "editor": { "fontSize": 16, "tabSize": 4, "rulers": [80] } }
```

---

### $mergeBy

Merges an array of objects by a key field (similar to Kustomize strategic merge patch).

**Value type:** object with fields:

| Field   | Type           | Description                                          |
| ------- | -------------- | ---------------------------------------------------- |
| `key`   | string         | Field name used for matching.                        |
| `items` | array\<object> | Objects to merge. Each must contain the `key` field. |

**Target:** must be an array of objects.

**Behavior:**

1. For each item in `items`, find an element in the target array where the `key` field matches.
2. If found, deep merge the target element with the incoming item.
3. If not found, append the incoming item to the end.

**Input:**

```json
{
  "tasks": [
    { "name": "build", "command": "tsc", "args": ["--strict"] },
    { "name": "test", "command": "vitest" }
  ]
}
```

**Patch:**

```yaml
tasks:
  $mergeBy:
    key: name
    items:
      - name: build
        args: ["--strict", "--noEmit"]
      - name: lint
        command: eslint
```

**Result:**

```json
{
  "tasks": [
    { "name": "build", "command": "tsc", "args": ["--strict", "--noEmit"] },
    { "name": "test", "command": "vitest" },
    { "name": "lint", "command": "eslint" }
  ]
}
```

---

### $append

Adds elements to the end of an array.

**Value type:** array

**Target:** must be an array.

**Input:**

```json
{ "editor": { "rulers": [80, 120] } }
```

**Patch:**

```yaml
editor:
  rulers:
    $append: [140]
```

**Result:**

```json
{ "editor": { "rulers": [80, 120, 140] } }
```

---

### $prepend

Adds elements to the beginning of an array. The order of elements in `$prepend` is preserved.

**Value type:** array

**Target:** must be an array.

**Input:**

```json
{ "plugins": ["existing-plugin"] }
```

**Patch:**

```yaml
plugins:
  $prepend: [first-plugin, second-plugin]
```

**Result:**

```json
{ "plugins": ["first-plugin", "second-plugin", "existing-plugin"] }
```

---

### $remove

Removes elements from an array by value. Uses strict equality (`===`) for scalars and deep equality for objects/arrays. Missing elements are silently skipped.

**Value type:** array

**Target:** must be an array.

**Input:**

```json
{ "files": { "exclude": ["node_modules", "dist", ".cache"] } }
```

**Patch:**

```yaml
files:
  exclude:
    $remove: [node_modules, .cache]
```

**Result:**

```json
{ "files": { "exclude": ["dist"] } }
```

---

### $unset

Removes keys from an object. Missing keys are silently skipped.

**Value type:** array\<string> (list of key names to remove)

**Target:** must be an object.

**Input:**

```json
{ "editor": { "fontSize": 14, "wordWrap": "on", "minimap": true } }
```

**Patch:**

```yaml
editor:
  $unset: [wordWrap, minimap]
```

**Result:**

```json
{ "editor": { "fontSize": 14 } }
```

---

### $insertAt

Inserts elements at a specific index in an array.

**Value type:** object with fields:

| Field   | Type    | Description                                                                                                            |
| ------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `index` | integer | 0-based insertion position. Negative values count from the end (`-1` = before last element). Clamped to `[0, length]`. |
| `items` | array   | Elements to insert.                                                                                                    |

**Target:** must be an array.

**Input:**

```json
{ "plugins": ["a", "b", "c"] }
```

**Patch:**

```yaml
plugins:
  $insertAt:
    index: 1
    items: [x, y]
```

**Result:**

```json
{ "plugins": ["a", "x", "y", "b", "c"] }
```

## Execution Order

When multiple markers appear in the same node, they are applied in this fixed order:

1. `$unset` — remove keys first.
2. `$merge` — deep merge objects.
3. `$mergeBy` — merge array by key.
4. `$set` — set value (overwrites previous operations).
5. `$remove` — remove array elements.
6. `$insertAt` — insert at position.
7. `$prepend` — add to beginning.
8. `$append` — add to end.

### Combination Restrictions

| Combination                          | Allowed?        |
| ------------------------------------ | --------------- |
| `$set` + `$merge`                    | **No** — error. |
| `$set` + `$mergeBy`                  | **No** — error. |
| `$merge` + `$mergeBy`                | Yes             |
| `$insertAt` + `$append` + `$prepend` | Yes             |
| `$append` + `$prepend` + `$remove`   | Yes             |

## Navigation

Non-marker keys in a patch file navigate the object hierarchy. To set a value, use `$set`; plain non-object values without markers have no effect.

```yaml
# This navigates to editor.fontSize, then sets it to 16
editor:
  fontSize:
    $set: 16

# This navigates but has no effect (no marker)
editor:
  fontSize: 16
```

## Non-Existent Target Fields

| Operation   | Behavior when target field does not exist            |
| ----------- | ---------------------------------------------------- |
| `$set`      | Creates the key with the given value.                |
| `$merge`    | Creates an empty object `{}`, then merges.           |
| `$mergeBy`  | Creates an empty array `[]`, all items are appended. |
| `$append`   | Warning in errors, operation skipped.                |
| `$prepend`  | Warning in errors, operation skipped.                |
| `$insertAt` | Warning in errors, operation skipped.                |
| `$remove`   | Silent no-op.                                        |
| `$unset`    | Silent no-op.                                        |

## Error Handling

Patch operations use a tolerant strategy: errors in individual files are collected in an `errors` array, and processing continues with remaining files.

| Condition                                               | Behavior                  |
| ------------------------------------------------------- | ------------------------- |
| Invalid patch file (parse error)                        | Error message, skip file. |
| `$append`/`$prepend`/`$remove`/`$insertAt` on non-array | Error message, skip file. |
| `$unset`/`$merge` on non-object                         | Error message, skip file. |
| `$mergeBy` on non-array                                 | Error message, skip file. |
| `$mergeBy` item missing key field                       | Error message, skip file. |
| `$mergeBy` item not an object                           | Error message, skip file. |
| Invalid marker value type                               | Error message, skip file. |
| Unknown marker (key starts with `$`)                    | Error message, skip file. |
| Both `$set` and `$merge` in same node                   | Error message, skip file. |
| Both `.patch` and `.override` suffixes                  | Error message, skip file. |
