import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, X, Send, SquarePen, Loader2, Sparkles } from 'lucide-react';
import { apiFetch } from '../api';

const WELCOME = { role: 'assistant', content: "Hi, I'm **MediBot**. Ask me about the hospital — patient counts, who a doctor is handling, bed status — or any medical question." };
const SUGGESTIONS = [
  'How many patients are there right now?',
  'Which doctor is handling the most patients?',
  'Show me any emergency patients',
  'What is the normal adult heart rate range?',
];

// Lightweight markdown → HTML (tables, headings, lists, bold, inline code).
function mdToHtml(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const cells = (line) => line.split('|').map((c) => c.trim())
    .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
  const lines = (src || '').split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/\|/.test(line) && i + 1 < lines.length && /-/.test(lines[i + 1]) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      html += '<table class="mdtable"><thead><tr>' + header.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>'
        + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { html += `<div class="mdh">${inline(m[2])}</div>`; i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      html += '<ul class="mdul">' + items.map((it) => `<li>${inline(it)}</li>`).join('') + '</ul>';
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      html += '<ol class="mdol">' + items.map((it) => `<li>${inline(it)}</li>`).join('') + '</ol>';
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    html += `<p>${inline(line)}</p>`;
    i++;
  }
  return html;
}

export default function MediBot() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const patientMatch = location.pathname.match(/\/patients\/([^/]+)/);
  const patientId = patientMatch ? patientMatch[1] : null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open, loading]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    const history = messages.filter((m) => m !== WELCOME);
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const data = await apiFetch('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: msg, history, patient_id: patientId }),
      });
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const onlyWelcome = messages.length === 1;

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xl flex items-center justify-center transition"
        title="MediBot">
        {open ? <X size={24} /> : <Bot size={26} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[94vw] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Bot size={18} /></div>
              <div className="leading-tight">
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  MediBot
                  {patientId && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Context: {patientId}</span>}
                </div>
                <div className="text-xs text-slate-400">Ask about patients, doctors or medicine</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMessages([WELCOME])} title="New chat" className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"><SquarePen size={17} /></button>
              <button onClick={() => setOpen(false)} title="Close" className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"><X size={18} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-sm bg-slate-900 text-white text-sm">{m.content}</div>
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5"><Bot size={15} className="text-slate-500" /></div>
                  <div className="medibot-md max-w-[88%] text-sm text-slate-800 bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5"
                    dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
                </div>
              )
            ))}

            {onlyWelcome && !loading && (
              <div className="pt-1 space-y-2">
                <div className="text-xs text-slate-400 flex items-center gap-1.5"><Sparkles size={13} /> Try asking</div>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="block w-full text-left text-sm px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0"><Bot size={15} className="text-slate-500" /></div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                  <span className="dot" /><span className="dot" style={{ animationDelay: '.15s' }} /><span className="dot" style={{ animationDelay: '.3s' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-slate-100 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask MediBot…"
              className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-900 bg-slate-50 focus:bg-white transition"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="p-2.5 bg-slate-900 text-white rounded-xl disabled:opacity-40 hover:bg-slate-800 transition">
              <Send size={17} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .medibot-md p { margin: 0 0 .4rem; }
        .medibot-md p:last-child { margin-bottom: 0; }
        .medibot-md strong { font-weight: 600; }
        .medibot-md code { background:#f1f5f9; padding:.05rem .3rem; border-radius:.3rem; font-size:.85em; }
        .medibot-md .mdh { font-weight:600; margin:.35rem 0 .25rem; }
        .medibot-md .mdul, .medibot-md .mdol { margin:.2rem 0 .4rem; padding-left:1.1rem; }
        .medibot-md .mdul { list-style:disc; } .medibot-md .mdol { list-style:decimal; }
        .medibot-md li { margin:.1rem 0; }
        .medibot-md .mdtable { border-collapse:collapse; width:100%; margin:.35rem 0; font-size:.8rem; display:block; overflow-x:auto; }
        .medibot-md .mdtable th, .medibot-md .mdtable td { border:1px solid #e2e8f0; padding:.3rem .5rem; text-align:left; white-space:nowrap; }
        .medibot-md .mdtable th { background:#f8fafc; font-weight:600; }
        .dot { width:6px; height:6px; border-radius:50%; background:#94a3b8; display:inline-block; animation: medibot-bounce .9s infinite ease-in-out; }
        @keyframes medibot-bounce { 0%,80%,100%{ transform: translateY(0); opacity:.5 } 40%{ transform: translateY(-4px); opacity:1 } }
      `}</style>
    </>
  );
}
