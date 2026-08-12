/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkbenchTask } from '../../src/domain/types';
import { upsertGradingTask } from './gradingTaskRepository';

test('upserts a grading task instead of creating duplicate frontend tasks', () => {
  const task = {
    id: 'repository-test-task', name: '真实任务', classId: 'c5', className: '七年级 5 班',
    node: 'setup', nodeName: '待准备', deadline: '', createdAt: '', collectionDeadlineAt: '', status: 'pending'
  } as WorkbenchTask;
  const stored = upsertGradingTask([task], { ...task, node: 'upload', nodeName: '待上传' }).filter(item => item.id === task.id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].node, 'upload');
});
