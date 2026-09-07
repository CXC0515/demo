/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dataFilePath } from '../context/workspaceContext';

const mapCaches = new Map<string, Map<string, unknown>>();
const arrayCaches = new Map<string, unknown[]>();
const atomicWrite = (target: string, value: unknown) => {
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, JSON.stringify(value));
  renameSync(temporary, target);
};

export const workspaceMapStore = <T>(fileName: string) => {
  const target = dataFilePath(fileName);
  let values = mapCaches.get(target) as Map<string, T> | undefined;
  if (!values) {
    try { values = new Map(JSON.parse(readFileSync(target, 'utf8')) as [string, T][]); }
    catch { values = new Map<string, T>(); }
    mapCaches.set(target, values as Map<string, unknown>);
  }
  return { values, persist: () => atomicWrite(target, [...values.entries()]) };
};

export const workspaceArrayStore = <T>(fileName: string) => {
  const target = dataFilePath(fileName);
  let values = arrayCaches.get(target) as T[] | undefined;
  if (!values) {
    try { values = JSON.parse(readFileSync(target, 'utf8')) as T[]; }
    catch { values = []; }
    arrayCaches.set(target, values as unknown[]);
  }
  return { values, persist: () => atomicWrite(target, values) };
};

export const clearWorkspaceFileStoreCaches = () => { mapCaches.clear(); arrayCaches.clear(); };
