#!/usr/bin/env node

import { rename, unlink, writeFile } from 'node:fs/promises';

const DEPARTMENT_ID = '323826714354839552';
const PAGE_SIZE = 200;
const OUTPUT_FILE = 'scripts/gate-live-2026-09-17-v44.tsv';
const COLUMNS = [
  'ticketNumber', 'title', 'displayStatusName', 'closeFlag', 'isSlaBreached', 'isOverdue',
  'customerName', 'customerEmail', 'priorityName', 'staffName', 'createTime', 'updateTime',
  'estDueDate', 'sourceChannel', 'topicTitle',
];

const baseUrl = process.env.TICKET_API_BASE_URL?.replace(/\/$/, '');
const authorization = process.env.ITEM_AUTHORIZATION;
const tenantId = process.env.ITEM_TENANT_ID;

if (!baseUrl || !authorization || !tenantId) {
  throw new Error('TICKET_API_BASE_URL, ITEM_AUTHORIZATION, and ITEM_TENANT_ID are required');
}

async function fetchPage(page) {
  const response = await fetch(`${baseUrl}/v1/iam/tickets/page`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
      'X-Tenant-Id': tenantId,
      'User-Agent': 'ccc-dashboard-ticket-refresh/44',
    },
    body: JSON.stringify({
      page,
      size: PAGE_SIZE,
      input: { departmentIds: [DEPARTMENT_ID], displayStatusSystemStatus: [10] },
    }),
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(`Ticket page ${page} returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(`Ticket page ${page} failed: HTTP ${response.status}, code ${payload.code}, ${payload.msg}`);
  }
  if (!Array.isArray(payload.data.records) || !Number.isInteger(payload.data.total)) {
    throw new Error(`Ticket page ${page} returned an unexpected shape`);
  }
  return payload.data;
}

const records = [];
const pages = [];
let stableTotal = null;
for (let page = 1; ; page += 1) {
  const data = await fetchPage(page);
  stableTotal ??= data.total;
  if (data.total !== stableTotal) {
    throw new Error(`Live total changed while paging: ${stableTotal} -> ${data.total} on page ${page}`);
  }
  records.push(...data.records);
  pages.push(page);
  if (records.length >= stableTotal || data.records.length === 0) break;
}

if (records.length !== stableTotal) throw new Error(`Read ${records.length} of ${stableTotal} records`);
if (new Set(records.map((record) => record.ticketNumber)).size !== records.length) {
  throw new Error('Live bucket contains duplicate ticket numbers');
}
if (records.some((record) => record.displayStatusSystemStatus !== 10)) {
  throw new Error('Live bucket contains a row outside displayStatusSystemStatus 10');
}

function tsvCell(record, column) {
  const value = record[column] == null ? '' : String(record[column]);
  if (/[\t\r\n]/.test(value)) {
    throw new Error(`${record.ticketNumber || '<unknown>'} ${column} contains a TSV control character`);
  }
  return value;
}

const tsv = `${COLUMNS.join('\t')}\n${records.map((record) => COLUMNS.map((column) => tsvCell(record, column)).join('\t')).join('\n')}\n`;
const temporary = `${OUTPUT_FILE}.tmp-${process.pid}`;
try {
  await writeFile(temporary, tsv, 'utf8');
  await rename(temporary, OUTPUT_FILE);
} catch (error) {
  await unlink(temporary).catch(() => {});
  throw error;
}

const statusCounts = Object.fromEntries([...new Set(records.map((record) => record.displayStatusName))]
  .sort().map((status) => [status, records.filter((record) => record.displayStatusName === status).length]));
console.log(JSON.stringify({
  capturedAt: new Date().toISOString(),
  outputFile: OUTPUT_FILE,
  query: {
    page: pages,
    size: PAGE_SIZE,
    input: { departmentIds: [DEPARTMENT_ID], displayStatusSystemStatus: [10] },
  },
  stableTotal,
  pages,
  statusCounts,
}, null, 2));
