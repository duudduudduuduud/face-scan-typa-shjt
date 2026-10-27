import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Training } from './pages/Training';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const json = (body: unknown) => new Response(JSON.stringify(body), {headers:{'Content-Type':'application/json'}});
it('disables training when independent capture data is insufficient', async () => {
  vi.stubGlobal('fetch',vi.fn(async () => json({dataset:[{studentCode:'SV001',images:5,sessions:1}],versions:[],activeId:null,job:null})));
  render(<MemoryRouter><Training/></MemoryRouter>);
  await screen.findByText('SV001');
  expect(screen.getByRole('button',{name:'Bắt đầu huấn luyện'}).hasAttribute('disabled')).toBe(true);
});
it('starts real API jobs and activates the selected evaluated model', async () => {
  const version={id:'a'.repeat(32),createdAt:'2026-10-12T01:00:00Z',algorithm:'SFace + LinearSVC',classes:['A','B'],trainCount:10,testCount:10,accuracy:1,precision:1,recall:1,f1:1,stale:false,confusionLabels:['A','B','unknown'],confusionMatrix:[[5,0,0],[0,5,0],[0,0,0]],rejected:[]};
  const fetcher=vi.fn<typeof fetch>(async () => json({dataset:[{studentCode:'A',images:10,sessions:2},{studentCode:'B',images:10,sessions:2}],versions:[version],activeId:null,job:null}));
  vi.stubGlobal('fetch',fetcher);
  render(<MemoryRouter><Training/></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Bắt đầu huấn luyện'}));
  await waitFor(() => expect(fetcher.mock.calls.some(call => String(call[0]).endsWith('/ai-training/jobs'))).toBe(true));
  await waitFor(() => expect(screen.getByRole('button',{name:'Áp dụng vào điểm danh'}).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Áp dụng vào điểm danh'}));
  await waitFor(() => expect(fetcher.mock.calls.some(call => String(call[0]).endsWith('/ai-training/activate'))).toBe(true));
});
