#!/usr/bin/env node

import { rename, unlink, writeFile } from 'node:fs/promises';

const DEPARTMENT_ID = '323826714354839552';
const PAGE_SIZE = 200;
const GATE_OUTPUT_FILE = 'scripts/gate-live-2026-09-19-v47.tsv';
const REOPEN_OUTPUT_FILE = 'scripts/reopen-live-2026-09-19-v47.tsv';
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

const baseHost = new URL(baseUrl).host;
console.log(`Resolved ticket API host: ${baseHost}`);

async function fetchPage(page) {
  const response = await fetch(`${baseUrl}/v1/iam/tickets/page`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
      'X-Tenant-Id': tenantId,
      'User-Agent': 'ccc-dashboard-ticket-refresh/47',
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
if (records.some((record) => record.displayStatusSystemStatus !== 10)) {
  throw new Error('Live bucket contains a row outside displayStatusSystemStatus 10');
}

function tsvCell(record, column) {
  const value = record[column] == null ? '' : String(record[column]);
  return value.replace(/[\t\r\n]+/g, ' ').trim();
}

function toTsv(selectedRecords, columns) {
  const rows = selectedRecords.map((record) => columns.map((column) => tsvCell(record, column)).join('\t'));
  return `${columns.join('\t')}\n${rows.length > 0 ? `${rows.join('\n')}\n` : ''}`;
}

async function atomicWrite(outputFile, contents) {
  const temporary = `${outputFile}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, contents, 'utf8');
    await rename(temporary, outputFile);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

const gateRecords = records.filter((record) => record.displayStatusName === 'New' || record.displayStatusName === 'Pending');
const reopenRecords = records.filter((record) => record.displayStatusName === 'Reopen' || record.displayStatusName === 'Reopened');

await atomicWrite(GATE_OUTPUT_FILE, toTsv(gateRecords, COLUMNS));
await atomicWrite(REOPEN_OUTPUT_FILE, toTsv(reopenRecords, ['ticketNumber']));

const statusCounts = Object.fromEntries([...new Set(records.map((record) => record.displayStatusName))]
  .sort().map((status) => [status, records.filter((record) => record.displayStatusName === status).length]));
const gateNumbers = gateRecords.map((record) => tsvCell(record, 'ticketNumber'));
const reopenNumbers = reopenRecords.map((record) => tsvCell(record, 'ticketNumber'));
const duplicateNumbersAcrossFiles = [...new Set(gateNumbers.filter((number) => reopenNumbers.includes(number)))];

console.log(JSON.stringify({
  capturedAt: new Date().toISOString(),
  resolvedBaseHost: baseHost,
  outputFiles: {
    gate: GATE_OUTPUT_FILE,
    reopen: REOPEN_OUTPUT_FILE,
  },
  query: {
    page: pages,
    size: PAGE_SIZE,
    input: { departmentIds: [DEPARTMENT_ID], displayStatusSystemStatus: [10] },
  },
  stableTotal,
  pages,
  statusCounts,
  writtenCounts: {
    New: gateRecords.filter((record) => record.displayStatusName === 'New').length,
    Pending: gateRecords.filter((record) => record.displayStatusName === 'Pending').length,
    Reopen: reopenRecords.filter((record) => record.displayStatusName === 'Reopen').length,
    Reopened: reopenRecords.filter((record) => record.displayStatusName === 'Reopened').length,
  },
  allGateTicketNumbersStartWithUfn: gateNumbers.every((number) => number.startsWith('UFN-')),
  duplicateNumbersAcrossFiles,
}, null, 2));
